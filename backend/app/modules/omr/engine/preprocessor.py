"""
app/modules/omr/engine/preprocessor.py
=======================
All image preprocessing steps: resize, grayscale, blur, threshold.

For this OMR sheet:
- Red/pink ink for circle outlines → suppress with green-channel weighting
- White paper background → high brightness, easy to separate from fill
- Bubble radius ~24px at 2550×3300 reference
"""
from __future__ import annotations
import cv2
import numpy as np


# ── Resize ──────────────────────────────────────────────────────────────────

def resize_to_reference(image: np.ndarray, ref_w: int, ref_h: int) -> np.ndarray:
    """Scale image to exact reference dimensions (2550×3300)."""
    if image.shape[1] == ref_w and image.shape[0] == ref_h:
        return image.copy()
    ratio_w = ref_w / image.shape[1]
    ratio_h = ref_h / image.shape[0]
    interp = cv2.INTER_LANCZOS4 if (ratio_w <= 1 and ratio_h <= 1) else cv2.INTER_CUBIC
    return cv2.resize(image, (ref_w, ref_h), interpolation=interp)


def resize_for_detection(image: np.ndarray, max_width: int = 1400) -> np.ndarray:
    """Shrink image for fast document-border detection."""
    h, w = image.shape[:2]
    if w <= max_width:
        return image.copy()
    ratio = max_width / w
    return cv2.resize(image, (max_width, int(h * ratio)), interpolation=cv2.INTER_LANCZOS4)


# ── Grayscale ────────────────────────────────────────────────────────────────

def to_grayscale_omr(image: np.ndarray) -> np.ndarray:
    """
    Weighted grayscale that suppresses red/pink ink (the printed circle outlines)
    and emphasises pencil/pen fill (dark in all channels).

    Weights:  R=0.10, G=0.65, B=0.25
    Red ink:  R≈220 G≈60  B≈60  → weighted ≈ 83  (darker than standard)
    Black pen: R≈40  G≈40  B≈40  → weighted ≈ 40  (stays dark)
    White paper: R≈255 G≈255 B≈255 → weighted ≈ 255 (stays bright)
    """
    if image.ndim == 2:
        return image.copy()
    b = image[:, :, 0].astype(np.float32)
    g = image[:, :, 1].astype(np.float32)
    r = image[:, :, 2].astype(np.float32)
    gray = 0.10 * r + 0.65 * g + 0.25 * b
    return np.clip(gray, 0, 255).astype(np.uint8)


def to_grayscale_standard(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image.copy()
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


# ── Blur ─────────────────────────────────────────────────────────────────────

def blur_for_detection(gray: np.ndarray) -> np.ndarray:
    """Mild blur for document contour detection."""
    noise = float(np.std(gray[gray.shape[0]//4: 3*gray.shape[0]//4,
                               gray.shape[1]//4: 3*gray.shape[1]//4]))
    kernel = (5, 5) if noise > 25 else (3, 3)
    return cv2.GaussianBlur(gray, kernel, 0)


def blur_for_reading(gray: np.ndarray) -> np.ndarray:
    """Very mild blur for bubble reading — preserve fill detail."""
    return cv2.GaussianBlur(gray, (3, 3), 0.8)


# ── Threshold ────────────────────────────────────────────────────────────────

def threshold_for_detection(gray: np.ndarray) -> np.ndarray:
    """Binarise for document border / contour detection."""
    norm = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    _, t = cv2.threshold(norm, 100, 255, cv2.THRESH_BINARY_INV)
    return t


def threshold_for_reading(gray: np.ndarray) -> np.ndarray:
    """CLAHE + Otsu binarisation for bubble fill reading."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    _, t = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return t
