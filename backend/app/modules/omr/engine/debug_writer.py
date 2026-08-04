"""
app/modules/omr/engine/debug_writer.py
======================================
Renders annotated debug overlays for pipeline stages.

Originally wrote 12 JPEGs per sheet into a `debug/<student_id>/` directory. The
deployment runs multiple uvicorn workers and stores sheet images on Cloudinary,
so nothing here touches the filesystem any more: overlays are encoded to PNG
bytes in memory and handed back on the pipeline result (see `images` /
`result_png`). The drawing logic for every stage is unchanged.

The pipeline only renders stage 11 (the scored result overlay) — that is the one
overlay a human reviewer needs. The remaining stage renderers are retained
because they are the tool for calibrating a new sheet template, which is the
expected path for onboarding a second school (see the template risk in
docs/omr-implementation.md §5).
"""
from __future__ import annotations
import logging
from typing import Any
import cv2
import numpy as np

logger = logging.getLogger(__name__)

_GREEN  = (0, 200, 0)
_RED    = (0, 0, 220)
_BLUE   = (220, 100, 0)
_YELLOW = (0, 200, 200)
_WHITE  = (255, 255, 255)
_BLACK  = (0, 0, 0)
_ORANGE = (0, 140, 255)
_PURPLE = (200, 0, 200)
_CYAN   = (200, 200, 0)


class DebugWriter:
    def __init__(self, enabled: bool = False) -> None:
        self.enabled = enabled
        self.images: dict[str, bytes] = {}

    def save(self, filename: str, image: np.ndarray) -> None:
        if not self.enabled:
            return
        # Scale down large high-res images for debug storage
        h, w = image.shape[:2]
        if w > 1200:
            scale = 1200 / w
            image = cv2.resize(image, (1200, int(h * scale)), interpolation=cv2.INTER_AREA)
        success, buffer = cv2.imencode(".png", image)
        if not success:
            logger.warning("Failed to encode debug overlay %s", filename)
            return
        self.images[filename] = buffer.tobytes()

    @property
    def result_png(self) -> bytes | None:
        """The stage-11 scored overlay, or None when debug rendering is off."""
        return self.images.get("11_result.png")

    # ── Stage writers ────────────────────────────────────────────────────

    def stage_01_original(self, img: np.ndarray) -> None:
        self.save("01_original.png", img)

    def stage_02_aligned(self, img: np.ndarray, method: str) -> None:
        if not self.enabled:
            return
        debug = img.copy()
        cv2.putText(debug, f"Alignment: {method}", (30, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, _GREEN, 3)
        self.save("02_aligned.png", debug)

    def stage_03_grayscale(self, img: np.ndarray) -> None:
        self.save("03_grayscale.png", img)

    def stage_04_threshold(self, img: np.ndarray) -> None:
        self.save("04_threshold.png", img)

    def stage_05_class_map(self, img: np.ndarray, class_map: dict) -> None:
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        for val, bub in class_map.items():
            cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], _YELLOW, 3)
            cv2.putText(debug, str(val), (bub["x"] - 15, bub["y"] + 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, _YELLOW, 2)
        self.save("05_class_map.png", debug)

    def stage_06_roll_map(self, img: np.ndarray,
                          roll_map: dict, subject_map: dict) -> None:
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        for col, digit_map in roll_map.items():
            for digit, bub in digit_map.items():
                cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], _BLUE, 2)
                cv2.putText(debug, str(digit), (bub["x"] - 10, bub["y"] + 6),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, _BLUE, 1)
        for col, digit_map in subject_map.items():
            for digit, bub in digit_map.items():
                cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], _PURPLE, 2)
        self.save("06_roll_subject_map.png", debug)

    def stage_07_set_code_map(self, img: np.ndarray, set_map: dict) -> None:
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        for val, bub in set_map.items():
            cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], _RED, 3)
            cv2.putText(debug, str(val), (bub["x"] - 20, bub["y"] + 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, _RED, 2)
        self.save("07_set_code_map.png", debug)

    def stage_08_answer_map(self, img: np.ndarray,
                            answer_map: dict[int, dict]) -> None:
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        opt_colors = {"KA": _GREEN, "KHA": _BLUE, "GA": _YELLOW, "GHA": _ORANGE}
        for q_num, options in answer_map.items():
            for opt, bub in options.items():
                color = opt_colors.get(opt.upper(), _WHITE)
                cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], color, 2)
        self.save("08_answer_map.png", debug)

    def stage_09_readings(self, img: np.ndarray,
                          answer_map: dict, readings: dict) -> None:
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        for q_num, options in answer_map.items():
            for opt, bub in options.items():
                r_data = readings.get(q_num, {}).get(opt, {})
                fill   = r_data.get("fill_score", 0.0)
                intensity = int(fill * 255)
                color = (0, intensity, 255 - intensity)
                cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"] - 3, color, -1)
                cv2.putText(debug, f"{fill:.2f}",
                            (bub["x"] - 18, bub["y"] + 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, _BLACK, 1)
        self.save("09_readings.png", debug)

    def stage_10_answers(self, img: np.ndarray,
                         answer_map: dict, answers: dict) -> None:
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        status_colors = {
            "answered": _GREEN, "blank": _YELLOW,
            "multiple": _ORANGE, "ambiguous": _ORANGE,
        }
        for q_num, ans_data in answers.items():
            answer = ans_data.get("answer", "BLANK").upper()
            status = ans_data.get("status", "blank")
            color  = status_colors.get(status, _WHITE)
            options = answer_map.get(q_num, {})
            for opt, bub in options.items():
                if opt.upper() == answer and status == "answered":
                    cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], color, -1)
                    cv2.putText(debug, opt[:2],
                                (bub["x"] - 12, bub["y"] + 6),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, _WHITE, 1)
                else:
                    cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], (160, 160, 160), 1)
        self.save("10_answers.png", debug)

    def stage_11_result(self, img: np.ndarray, answer_map: dict,
                        answers: dict, score: dict | None) -> None:
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if score:
            details = score.get("details", {})
            fill_correct  = (0, 200, 0)
            fill_wrong    = (0, 0, 200)
            fill_blank    = (0, 200, 200)
            fill_multiple = (200, 0, 200)
            status_fill   = {"correct": fill_correct, "wrong": fill_wrong,
                             "blank": fill_blank, "multiple": fill_multiple,
                             "ambiguous": fill_multiple}
            for q_num, ans_data in answers.items():
                ans    = ans_data.get("answer", "BLANK").upper()
                detail = details.get(str(q_num), {})
                st     = detail.get("status", "blank")
                color  = status_fill.get(st, _WHITE)
                for opt, bub in answer_map.get(q_num, {}).items():
                    if opt.upper() == ans and st not in ("blank",):
                        cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], color, -1)
                    else:
                        cv2.circle(debug, (bub["x"], bub["y"]), bub["radius"], (160,160,160), 1)

            banner = (
                f"Score: {score.get('adjusted_score',0)}/{score.get('max_marks',0)}  "
                f"({score.get('percentage',0):.1f}%)  Grade: {score.get('grade','?')}"
            )
            cv2.rectangle(debug, (0, 0), (debug.shape[1], 55), (20, 20, 20), -1)
            cv2.putText(debug, banner, (20, 38),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, _WHITE, 2)
        self.save("11_result.png", debug)

    def stage_12_metadata(self, img: np.ndarray, metadata: dict[str, Any]) -> None:
        """Overlay extracted class / roll / subject / set-code on the image."""
        if not self.enabled:
            return
        debug = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        lines = [
            f"Class:   {metadata.get('class_value', {}).get('value', '?')}",
            f"Roll:    {metadata.get('roll_number', {}).get('roll_number', '?')}",
            f"Subject: {metadata.get('subject_code', {}).get('subject_code', '?')}",
            f"Set:     {metadata.get('set_code', {}).get('value', '?')}",
        ]
        y = 80
        cv2.rectangle(debug, (0, 0), (500, 200), (20, 20, 20), -1)
        for line in lines:
            cv2.putText(debug, line, (15, y), cv2.FONT_HERSHEY_SIMPLEX, 0.9, _WHITE, 2)
            y += 40
        self.save("12_metadata.png", debug)
