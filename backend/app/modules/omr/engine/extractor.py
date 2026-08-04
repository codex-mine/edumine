"""
app/modules/omr/engine/extractor.py
====================
Converts raw bubble fill readings into structured values.

Sections extracted:
  - class_value:    single integer (6-12)
  - roll_number:    string of 6 digits  (e.g. "042315")
  - subject_code:   string of 3 digits  (e.g. "108")
  - set_code:       single string       (e.g. "Ka")
  - answers:        {question_int: {answer, fill_score, status, confidence}}

Thresholds (calibrated for this template):
  MIN_FILL      = 0.35   – well above blank noise (0.08-0.18)
  MULTI_MARGIN  = 0.12   – if top-2 options within this → MULTIPLE
"""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

MIN_FILL     = 0.35
MULTI_MARGIN = 0.12
HIGH_CONF    = 0.55


class Extractor:
    """Interprets fill readings for all sections of the OMR sheet."""

    def __init__(
        self,
        min_fill:     float = MIN_FILL,
        multi_margin: float = MULTI_MARGIN,
        high_conf:    float = HIGH_CONF,
    ) -> None:
        self.min_fill     = min_fill
        self.multi_margin = multi_margin
        self.high_conf    = high_conf

    # ------------------------------------------------------------------ #
    # Section extractors                                                   #
    # ------------------------------------------------------------------ #

    def extract_class(self, class_readings: dict[int, dict]) -> dict[str, Any]:
        """
        Args:
            class_readings: {class_value_int: {fill_score, ...}}

        Returns:
            {"value": int | None, "fill_score": float, "status": str}
        """
        best_val, best_score = self._best_single(class_readings)
        if best_score < self.min_fill:
            return {"value": None, "fill_score": round(best_score, 4), "status": "blank"}

        # Multiple classes selected?
        second_score = self._second_best_score(class_readings)
        if second_score >= self.min_fill and (best_score - second_score) <= self.multi_margin:
            return {"value": None, "fill_score": round(best_score, 4), "status": "multiple"}

        return {
            "value":      int(best_val),
            "fill_score": round(best_score, 4),
            "status":     "answered",
        }

    def extract_roll_number(
        self, roll_readings: dict[int, dict[int, dict]]
    ) -> dict[str, Any]:
        """
        Args:
            roll_readings: {digit_pos: {digit_val: {fill_score, ...}}}
                           digit_pos 0 = leftmost digit

        Returns:
            {"roll_number": str, "digits": list[int|None], "status": str}
        """
        digits: list[int | None] = []
        all_valid = True

        for col in sorted(roll_readings.keys()):
            col_data = roll_readings[col]
            digit, score = self._best_single(col_data)
            if score < self.min_fill:
                digits.append(None)
                all_valid = False
            else:
                # Check multiple
                second = self._second_best_score(col_data)
                if second >= self.min_fill and (score - second) <= self.multi_margin:
                    digits.append(None)
                    all_valid = False
                else:
                    digits.append(int(digit))

        roll_str = "".join(str(d) if d is not None else "?" for d in digits)
        status = "complete" if all_valid else "incomplete"
        return {"roll_number": roll_str, "digits": digits, "status": status}

    def extract_subject_code(
        self, subject_readings: dict[int, dict[int, dict]]
    ) -> dict[str, Any]:
        """Same structure as roll number but 3 digits."""
        digits: list[int | None] = []
        all_valid = True

        for col in sorted(subject_readings.keys()):
            col_data = subject_readings[col]
            digit, score = self._best_single(col_data)
            if score < self.min_fill:
                digits.append(None)
                all_valid = False
            else:
                second = self._second_best_score(col_data)
                if second >= self.min_fill and (score - second) <= self.multi_margin:
                    digits.append(None)
                    all_valid = False
                else:
                    digits.append(int(digit))

        code_str = "".join(str(d) if d is not None else "?" for d in digits)
        return {"subject_code": code_str, "digits": digits,
                "status": "complete" if all_valid else "incomplete"}

    def extract_set_code(self, set_readings: dict[str, dict]) -> dict[str, Any]:
        """
        Args:
            set_readings: {"Ka": {fill_score,...}, "Kha": {...}, ...}

        Returns:
            {"value": str | None, "fill_score": float, "status": str}
        """
        best_val, best_score = self._best_single(set_readings)
        if best_score < self.min_fill:
            return {"value": None, "fill_score": round(best_score, 4), "status": "blank"}

        second = self._second_best_score(set_readings)
        if second >= self.min_fill and (best_score - second) <= self.multi_margin:
            return {"value": None, "fill_score": round(best_score, 4), "status": "multiple"}

        return {
            "value":      str(best_val),
            "fill_score": round(best_score, 4),
            "status":     "answered",
        }

    def extract_answers(
        self, answer_readings: dict[int, dict[str, dict]]
    ) -> dict[int, dict[str, Any]]:
        """
        Args:
            answer_readings: {q_num: {option_str: {fill_score,...}}}

        Returns:
            {q_num: {answer, fill_score, status, confidence, all_scores}}
        """
        results: dict[int, dict[str, Any]] = {}
        for q_num, options in answer_readings.items():
            scores = {
                opt.upper(): float(data.get("fill_score", data.get("percentage", 0.0)))
                for opt, data in options.items()
            }
            results[q_num] = self._interpret_answer(q_num, scores)
        return results

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _interpret_answer(self, q_num: int, scores: dict[str, float]) -> dict[str, Any]:
        if not scores:
            return self._ans_result("BLANK", 0.0, "blank", "LOW", {})

        sorted_opts = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        best_opt, best_score = sorted_opts[0]
        all_scores = dict(sorted_opts)

        # BLANK
        if best_score < self.min_fill:
            logger.debug("Q%d → BLANK (%.3f)", q_num, best_score)
            return self._ans_result("BLANK", best_score, "blank", "LOW", all_scores)

        # AMBIGUOUS: 3+ options above threshold
        if len(sorted_opts) >= 3 and sorted_opts[2][1] >= self.min_fill:
            logger.debug("Q%d → AMBIGUOUS", q_num)
            return self._ans_result("MULTIPLE", best_score, "ambiguous", "LOW", all_scores)

        # MULTIPLE: top 2 both above threshold and close
        if len(sorted_opts) >= 2:
            second_opt, second_score = sorted_opts[1]
            if (second_score >= self.min_fill
                    and (best_score - second_score) <= self.multi_margin):
                logger.debug("Q%d → MULTIPLE (%.3f vs %.3f)", q_num, best_score, second_score)
                return self._ans_result("MULTIPLE", best_score, "multiple", "LOW", all_scores)

        # SINGLE
        confidence = (
            "HIGH"   if best_score >= self.high_conf else
            "MEDIUM" if best_score >= self.min_fill  else
            "LOW"
        )
        logger.debug("Q%d → %s (%.3f, %s)", q_num, best_opt, best_score, confidence)
        return self._ans_result(best_opt, best_score, "answered", confidence, all_scores)

    @staticmethod
    def _best_single(readings: dict) -> tuple[Any, float]:
        """Return (key, fill_score) of the entry with the highest fill_score."""
        best_key, best_score = None, -1.0
        for key, data in readings.items():
            if isinstance(data, dict):
                score = float(data.get("fill_score", data.get("percentage", 0.0)))
            else:
                score = float(data)
            if score > best_score:
                best_score = score
                best_key = key
        return best_key, best_score

    @staticmethod
    def _second_best_score(readings: dict) -> float:
        scores = sorted(
            (float(d.get("fill_score", d.get("percentage", 0.0))) if isinstance(d, dict) else float(d))
            for d in readings.values()
        )
        return scores[-2] if len(scores) >= 2 else 0.0

    @staticmethod
    def _ans_result(
        answer: str, fill_score: float, status: str,
        confidence: str, all_scores: dict
    ) -> dict[str, Any]:
        return {
            "answer":     answer,
            "fill_score": round(fill_score, 4),
            "status":     status,
            "confidence": confidence,
            "all_scores": {k: round(v, 4) for k, v in all_scores.items()},
        }
