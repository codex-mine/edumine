"""app/modules/omr/engine/image_loader.py — Load and validate images."""
from __future__ import annotations
import logging
from pathlib import Path
import cv2
import numpy as np

logger = logging.getLogger(__name__)

MIN_WIDTH  = 600
MIN_HEIGHT = 800


def load_image(image_path: str | Path) -> np.ndarray:
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"OpenCV cannot decode: {path}")
    h, w = image.shape[:2]
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        raise ValueError(f"Image too small ({w}×{h}). Min: {MIN_WIDTH}×{MIN_HEIGHT}")
    logger.debug("Loaded %s  (%dx%d)", path.name, w, h)
    return image


def load_image_bytes(data: bytes) -> np.ndarray:
    """Decode an in-memory image, applying the same validation as `load_image`.

    Sheets arrive as bytes from the upload/Cloudinary path rather than as files
    on disk, so this mirrors `load_image` without ever touching the filesystem.
    """
    if not data:
        raise ValueError("Empty image payload")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("OpenCV cannot decode the supplied image bytes")
    h, w = image.shape[:2]
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        raise ValueError(f"Image too small ({w}×{h}). Min: {MIN_WIDTH}×{MIN_HEIGHT}")
    logger.debug("Loaded image from bytes  (%dx%d)", w, h)
    return image


def get_image_info(image: np.ndarray) -> dict:
    h, w = image.shape[:2]
    return {
        "width": w, "height": h,
        "channels": 1 if image.ndim == 2 else image.shape[2],
        "dtype": str(image.dtype),
    }
