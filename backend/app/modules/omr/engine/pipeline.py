"""
app/modules/omr/engine/pipeline.py
==================================
Complete 12-stage OMR pipeline for the Plus Coaching Center answer sheet.

Stages:
  01  Load image
  02  Align to reference (corner-marker → contour → resize fallback)
  03  Grayscale (OMR-optimised channel weights)
  04  Threshold (CLAHE + Otsu)
  05  Build class bubble map
  06  Build roll / subject bubble maps
  07  Build set-code bubble map
  08  Build answer bubble map
  09  Read all bubble fill scores
  10  Extract class / roll / subject / set-code / answers
  11  Score against answer key (optional)
  12  Render the scored result overlay (optional, in memory)

The image is aligned to exactly 2550 × 3300 pixels after stage 02,
so all coordinates in the calibrated template JSON are valid
pixel addresses with no further scaling.

Nothing here touches the filesystem beyond reading the template and, when a path
is passed, the image: the answer key arrives as a dict, sheets may be handed over
as raw bytes, and the stage-11 overlay comes back as encoded PNG bytes on the
result rather than as a directory of debug files. Sheet images live on Cloudinary
and the deployment runs multiple uvicorn workers, so worker-local files would be
both unreachable and unbounded.
"""
from __future__ import annotations
import logging
import time
from pathlib import Path
from typing import Any

from app.modules.omr.engine.image_loader    import load_image, load_image_bytes
from app.modules.omr.engine.preprocessor    import (to_grayscale_omr, to_grayscale_standard,
                                                    threshold_for_reading)
from app.modules.omr.engine.aligner         import Aligner
from app.modules.omr.engine.template_loader import TemplateLoader
from app.modules.omr.engine.bubble_reader   import BubbleReader
from app.modules.omr.engine.extractor       import Extractor
from app.modules.omr.engine.scorer          import OMRScorer, ScoringConfig
from app.modules.omr.engine.debug_writer    import DebugWriter

logger = logging.getLogger(__name__)


class OMRPipeline:
    """
    End-to-end OMR pipeline for the Plus Coaching Center fixed template.

    Args:
        template_path:   Path to the calibrated JSON template.
        answer_key:      Answer key dict (None → skip scoring), shaped
                         {"answers": {"1": "Ka", ...}}.
        scoring_config:  ScoringConfig (default: 1 mark, no negatives).
        debug:           Render the stage-11 result overlay onto the result dict.
    """

    def __init__(
        self,
        template_path:   str | Path,
        answer_key:      dict | None = None,
        scoring_config:  ScoringConfig | None = None,
        debug:           bool = False,
    ) -> None:
        self.debug = debug

        # ── Template ────────────────────────────────────────────────────
        self._tl  = TemplateLoader(template_path)
        self.tmpl = self._tl.load()
        self._ref_w: int = self.tmpl["reference_width"]   # 2550
        self._ref_h: int = self.tmpl["reference_height"]  # 3300

        # ── CV components ────────────────────────────────────────────────
        self._aligner  = Aligner(ref_w=self._ref_w, ref_h=self._ref_h)
        self._reader   = BubbleReader()
        self._extractor= Extractor()
        self._scorer   = OMRScorer(config=scoring_config)

        # ── Answer key ───────────────────────────────────────────────────
        self._answer_key: dict | None = answer_key
        if answer_key is not None:
            logger.info("Answer key supplied: %d questions",
                        len(answer_key.get("answers", {})))

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def process(
        self,
        image: bytes | str | Path,
        student_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Process a single OMR sheet, supplied either as raw bytes or as a path.

        Returns:
            {success, student_id, metadata, answers, score,
             alignment_method, processing_time_ms, annotated_png}
        """
        if student_id is None:
            student_id = "sheet" if isinstance(image, bytes) else Path(image).stem
        t0 = time.perf_counter()

        dbg = DebugWriter(enabled=self.debug)

        logger.info("━" * 60)
        logger.info("Processing sheet  (id=%s)", student_id)

        try:
            result = self._run(image, student_id, dbg)
        except Exception as exc:
            logger.exception("Pipeline failed: %s", exc)
            result = {
                "success": False, "student_id": student_id,
                "message": str(exc), "metadata": {}, "answers": {},
                "score": None, "annotated_png": None,
            }

        result["processing_time_ms"] = int((time.perf_counter() - t0) * 1000)
        logger.info("Done in %d ms", result["processing_time_ms"])
        return result

    def process_batch(
        self,
        images: list[bytes | str | Path],
        student_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Process multiple sheets sequentially."""
        if student_ids is None:
            student_ids = [
                f"sheet_{i}" if isinstance(img, bytes) else Path(img).stem
                for i, img in enumerate(images, 1)
            ]
        total = len(images)
        results = []
        for i, (img, sid) in enumerate(zip(images, student_ids), 1):
            logger.info("Batch %d/%d", i, total)
            results.append(self.process(img, student_id=sid))
        return results

    # ------------------------------------------------------------------ #
    # Internal pipeline                                                    #
    # ------------------------------------------------------------------ #

    def _run(
        self, image_source: bytes | str | Path, student_id: str, dbg: DebugWriter
    ) -> dict[str, Any]:

        # ── 01 Load ─────────────────────────────────────────────────────
        image = (
            load_image_bytes(image_source)
            if isinstance(image_source, bytes)
            else load_image(image_source)
        )
        logger.info("[01] Loaded  %dx%d", image.shape[1], image.shape[0])

        # ── 02 Align ─────────────────────────────────────────────────────
        aligned, method = self._aligner.align(image)
        logger.info("[02] Aligned → %dx%d  (%s)", aligned.shape[1], aligned.shape[0], method)

        # ── 03 Grayscale ─────────────────────────────────────────────────
        # Both conversions are retained from the calibrated pipeline: gray_omr
        # suppresses red ink for detection, gray_std keeps all ink visible for
        # bubble reading. BubbleReader does its own conversion internally, so
        # these stand as the documented preprocessing contract for stage 04.
        gray_omr = to_grayscale_omr(aligned)      # noqa: F841 — see above
        gray_std = to_grayscale_standard(aligned)
        logger.info("[03] Grayscale done")

        # ── 04 Threshold ─────────────────────────────────────────────────
        thresh = threshold_for_reading(gray_std)  # noqa: F841 — see stage 03 note
        logger.info("[04] Threshold done")

        # ── 05-08 Build bubble maps from template ─────────────────────────
        # Image is already exactly ref_w × ref_h → scale = 1.0
        class_map   = self._tl.build_class_map(self.tmpl)
        roll_map    = self._tl.build_roll_map(self.tmpl)
        subject_map = self._tl.build_subject_map(self.tmpl)
        set_map     = self._tl.build_set_code_map(self.tmpl)
        answer_map  = self._tl.build_answer_map(self.tmpl)

        logger.info("[05-08] Bubble maps built: %d answer bubbles", len(answer_map) * 4)

        # ── 09 Read bubble fill scores ────────────────────────────────────
        class_readings   = self._reader.read_single_col_map(aligned, class_map)
        roll_readings    = self._reader.read_multi_col_map(aligned, roll_map)
        subject_readings = self._reader.read_multi_col_map(aligned, subject_map)
        set_readings     = self._reader.read_single_col_map(aligned, set_map)
        answer_readings  = self._reader.read_answer_map(aligned, answer_map)

        logger.info("[09] Bubble readings complete")

        # ── 10 Extract values ─────────────────────────────────────────────
        class_result   = self._extractor.extract_class(class_readings)
        roll_result    = self._extractor.extract_roll_number(roll_readings)
        subject_result = self._extractor.extract_subject_code(subject_readings)
        set_result     = self._extractor.extract_set_code(set_readings)
        answers        = self._extractor.extract_answers(answer_readings)

        metadata = {
            "class_value":   class_result,
            "roll_number":   roll_result,
            "subject_code":  subject_result,
            "set_code":      set_result,
        }

        logger.info("[10] Extracted — class=%s  roll=%s  subject=%s  set=%s",
                    class_result.get("value"),
                    roll_result.get("roll_number"),
                    subject_result.get("subject_code"),
                    set_result.get("value"))

        # ── 11 Score ──────────────────────────────────────────────────────
        score: dict | None = None
        if self._answer_key is not None:
            score = self._scorer.score(answers, self._answer_key)
            logger.info("[11] Score: %s/%s (%.1f%%) Grade=%s",
                        score["adjusted_score"], score["max_marks"],
                        score["percentage"], score["grade"])
        else:
            logger.info("[11] Scoring skipped (no answer key).")

        # ── 12 Render the scored overlay in memory (opt-in) ────────────────
        dbg.stage_11_result(aligned, answer_map, answers, score)

        return {
            "success":          True,
            "student_id":       student_id,
            "alignment_method": method,
            "metadata":         metadata,
            "answers":          answers,
            "score":            score,
            "annotated_png":    dbg.result_png,
        }
