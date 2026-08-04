"""
app/modules/omr/engine/bubble_reader.py
========================
Reads bubble fill level using brightness-inversion as the primary signal.

Key insight for THIS template:
  - Circles are printed in RED/PINK ink with Bengali letters inside (ক,খ,গ,ঘ)
  - Blank bubble: paper white interior → mean brightness ≈ 210-240 → fill_score ≈ 0.08-0.17
  - Filled bubble: student covers entire circle with black pen → mean brightness ≈ 40-100 → fill_score ≈ 0.58-0.83
  - Decision threshold: 0.35 (leaves wide margin above blank noise floor)

fill_score formula:
  brightness_score = 1.0 - (mean_pixel / PAPER_BASELINE)
  combined with Otsu pixel-count (secondary) and std-uniformity bonus.
"""
from __future__ import annotations
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)

PAPER_BASELINE: float = 245.0   # typical blank paper brightness in scanned OMR


class BubbleReader:
    """
    Multi-signal bubble fill reader.

    Primary signal:   brightness inversion  (weight 0.70)
    Secondary signal: Otsu pixel count      (weight 0.20)
    Bonus signal:     uniformity (low std)  (weight 0.10)
    """

    def __init__(
        self,
        brightness_weight: float = 0.70,
        otsu_weight:       float = 0.20,
        uniformity_bonus:  float = 0.10,
    ) -> None:
        self.bw = brightness_weight
        self.ow = otsu_weight
        self.ub = uniformity_bonus

    # ------------------------------------------------------------------ #
    # Public                                                               #
    # ------------------------------------------------------------------ #

    def read_map(
        self,
        image: np.ndarray,
        bubble_map: dict,
    ) -> dict:
        """
        Generic reader for ANY bubble map of the form:
            {key: {x, y, radius}}   or
            {key: {sub_key: {x, y, radius}}}

        Detects which form is used and recurses accordingly.

        Returns a parallel structure with fill data added:
            {key: {fill_score, brightness, otsu_pct, percentage}}   or
            {key: {sub_key: {fill_score, ...}}}
        """
        gray = self._to_gray(image)
        return self._read_any(gray, bubble_map)

    def read_answer_map(
        self,
        image: np.ndarray,
        answer_map: dict[int, dict[str, dict]],
    ) -> dict[int, dict[str, dict]]:
        """
        Read the answer bubble map.
        Returns: {question_int: {option_str: {fill_score, brightness, otsu_pct, percentage}}}
        """
        gray = self._to_gray(image)
        results: dict[int, dict[str, dict]] = {}
        for q_num, options in answer_map.items():
            results[q_num] = {}
            for opt, bub in options.items():
                results[q_num][opt] = self._measure(gray, bub["x"], bub["y"], bub["radius"])
        return results

    def read_single_col_map(
        self,
        image: np.ndarray,
        col_map: dict,
    ) -> dict:
        """
        Read a single-column map: {value: {x, y, radius}}.
        Returns: {value: {fill_score, ...}}
        """
        gray = self._to_gray(image)
        return {val: self._measure(gray, bub["x"], bub["y"], bub["radius"])
                for val, bub in col_map.items()}

    def read_multi_col_map(
        self,
        image: np.ndarray,
        multi_map: dict[int, dict[int, dict]],
    ) -> dict[int, dict[int, dict]]:
        """
        Read a multi-column digit map: {col_pos: {digit: {x,y,radius}}}.
        Returns parallel structure with fill data.
        """
        gray = self._to_gray(image)
        results: dict[int, dict[int, dict]] = {}
        for col_pos, digit_map in multi_map.items():
            results[col_pos] = {}
            for digit_val, bub in digit_map.items():
                results[col_pos][digit_val] = self._measure(
                    gray, bub["x"], bub["y"], bub["radius"]
                )
        return results

    # ------------------------------------------------------------------ #
    # Private                                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _to_gray(image: np.ndarray) -> np.ndarray:
        if image.ndim == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return image.copy()

    def _read_any(self, gray: np.ndarray, bubble_map: dict) -> dict:
        """Recursively read any bubble map structure."""
        result = {}
        for key, val in bubble_map.items():
            if isinstance(val, dict) and "x" in val and "y" in val:
                result[key] = self._measure(gray, val["x"], val["y"], val["radius"])
            elif isinstance(val, dict):
                result[key] = self._read_any(gray, val)
            else:
                result[key] = val
        return result

    def _measure(
        self, gray: np.ndarray, cx: int, cy: int, r: int
    ) -> dict:
        """Measure fill at a single bubble location."""
        img_h, img_w = gray.shape

        # Clamp radius to ensure ROI stays in bounds
        r = min(r, cx - 1, cy - 1, img_w - cx - 1, img_h - cy - 1)
        if r < 3:
            return self._empty()

        # Tight square ROI
        x0, y0 = cx - r - 1, cy - r - 1
        x1, y1 = cx + r + 1, cy + r + 1
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(img_w, x1), min(img_h, y1)
        roi = gray[y0:y1, x0:x1]

        lx, ly = cx - x0, cy - y0

        # Circular mask
        mask = np.zeros(roi.shape, dtype=np.uint8)
        cv2.circle(mask, (lx, ly), r, 255, -1)

        pixels = roi[mask > 0].astype(np.float32)
        if len(pixels) == 0:
            return self._empty()

        # ── Signal 1: brightness inversion ──────────────────────────────
        mean_brightness = float(np.mean(pixels))
        brightness_score = max(0.0, (PAPER_BASELINE - mean_brightness) / PAPER_BASELINE)

        # ── Signal 2: Otsu dark-pixel fraction ──────────────────────────
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
        enhanced = clahe.apply(roi)
        _, thresh = cv2.threshold(
            enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        masked_thresh = cv2.bitwise_and(thresh, thresh, mask=mask)
        filled_px = int(cv2.countNonZero(masked_thresh))
        total_px  = int(cv2.countNonZero(mask))
        otsu_pct  = filled_px / total_px if total_px > 0 else 0.0

        # ── Signal 3: uniformity bonus ───────────────────────────────────
        std_val = float(np.std(pixels))
        # blank ≈ std 55-65; filled ≈ std 10-25
        uniformity = max(0.0, (55.0 - std_val) / 55.0)
        bonus = uniformity * self.ub

        # ── Combined score ───────────────────────────────────────────────
        raw = self.bw * brightness_score + self.ow * otsu_pct + bonus
        fill_score = float(np.clip(raw, 0.0, 1.0))

        return {
            "fill_score":    round(fill_score, 4),
            "brightness":    round(mean_brightness, 2),
            "otsu_pct":      round(otsu_pct, 4),
            "filled_pixels": filled_px,
            "total_pixels":  total_px,
            "percentage":    round(fill_score, 4),   # legacy alias
        }

    @staticmethod
    def _empty() -> dict:
        return {
            "fill_score": 0.0, "brightness": PAPER_BASELINE,
            "otsu_pct": 0.0, "filled_pixels": 0,
            "total_pixels": 0, "percentage": 0.0,
        }
