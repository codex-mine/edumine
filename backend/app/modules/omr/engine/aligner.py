"""
app/modules/omr/engine/aligner.py
==================
Aligns a scanned/photographed OMR sheet to the reference dimensions
(2550 × 3300) using TWO strategies:

Strategy A — Corner-marker alignment (preferred):
  Detects the 4 black square registration marks printed at the corners
  of the sheet, then applies a perspective transform so that each marker
  lands at its reference coordinate.  This is pixel-accurate even on
  phone photos taken at an angle.

Strategy B — Document-contour fallback:
  If the corner markers are not found (e.g. the markers are cut off),
  falls back to finding the largest 4-point white rectangle in the image
  (the sheet itself) and warping it to fill the reference canvas.

Strategy C — Direct resize (last resort):
  If neither A nor B succeeds, the image is simply resized to
  2550 × 3300.  Accuracy degrades for angled photos but still works
  for straight scans where the sheet fills the frame.
"""
from __future__ import annotations
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class Aligner:
    """
    Perspective-aligns an OMR image to a fixed reference size.

    Args:
        ref_w: Reference width  (default 2550).
        ref_h: Reference height (default 3300).
        marker_size: Approximate side length of the square corner markers
                     in reference pixels (default 118).
    """

    def __init__(
        self,
        ref_w: int = 2550,
        ref_h: int = 3300,
        marker_size: int = 118,
    ) -> None:
        self.ref_w = ref_w
        self.ref_h = ref_h
        self.marker_size = marker_size

        # Reference corner positions (centres of the 4 black squares)
        half = marker_size // 2
        self._ref_tl = (233, 118)
        self._ref_tr = (2323, 118)
        self._ref_bl = (233, 2013)
        self._ref_br = (2323, 2013)

    # ------------------------------------------------------------------ #
    # Public                                                               #
    # ------------------------------------------------------------------ #

    def align(self, image: np.ndarray) -> tuple[np.ndarray, str]:
        """
        Align *image* to the reference canvas.

        Returns:
            (aligned_image, method_used)
            method_used is one of: "markers", "contour", "resize"
        """
        result, method = self._try_marker_alignment(image)
        if result is not None:
            return result, method

        result, method = self._try_contour_alignment(image)
        if result is not None:
            return result, method

        logger.warning("Alignment fallback: direct resize to %dx%d", self.ref_w, self.ref_h)
        resized = cv2.resize(image, (self.ref_w, self.ref_h), interpolation=cv2.INTER_LANCZOS4)
        return resized, "resize"

    # ------------------------------------------------------------------ #
    # Strategy A: corner markers                                           #
    # ------------------------------------------------------------------ #

    def _try_marker_alignment(
        self, image: np.ndarray
    ) -> tuple[np.ndarray | None, str]:
        """Detect 4 black square registration marks and warp to reference."""
        ih, iw = image.shape[:2]
        scale_x = iw / self.ref_w
        scale_y = ih / self.ref_h

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
        _, binary = cv2.threshold(gray, 60, 255, cv2.THRESH_BINARY_INV)

        # Morphological close to fill small gaps inside markers
        kernel = np.ones((5, 5), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Filter: roughly square, right size range
        min_area = (self.marker_size * scale_x * 0.4) ** 2
        max_area = (self.marker_size * max(scale_x, scale_y) * 2.5) ** 2

        squares: list[tuple[float, float]] = []  # (cx, cy)
        for c in contours:
            area = cv2.contourArea(c)
            if area < min_area or area > max_area:
                continue
            x, y, w, h = cv2.boundingRect(c)
            if w == 0 or h == 0:
                continue
            aspect = w / h
            if not (0.6 < aspect < 1.7):
                continue
            squares.append((x + w / 2, y + h / 2))

        if len(squares) < 4:
            logger.debug("Marker alignment: only %d markers found (need 4)", len(squares))
            return None, ""

        # Pick the 4 corners from all candidates
        corners = self._pick_four_corners(squares, iw, ih)
        if corners is None:
            return None, ""

        src = np.array(corners, dtype=np.float32)
        dst = np.array([
            self._ref_tl, self._ref_tr, self._ref_br, self._ref_bl
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(
            image, M, (self.ref_w, self.ref_h),
            flags=cv2.INTER_LANCZOS4,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255),
        )
        logger.info("Alignment: corner-marker perspective warp")
        return warped, "markers"

    @staticmethod
    def _pick_four_corners(
        points: list[tuple[float, float]], img_w: int, img_h: int
    ) -> list[tuple[float, float]] | None:
        """
        From a set of candidate square centres, pick TL, TR, BR, BL
        using image-quadrant assignment.
        """
        cx_mid = img_w / 2
        cy_mid = img_h / 2

        tl = [p for p in points if p[0] < cx_mid and p[1] < cy_mid]
        tr = [p for p in points if p[0] >= cx_mid and p[1] < cy_mid]
        bl = [p for p in points if p[0] < cx_mid and p[1] >= cy_mid]
        br = [p for p in points if p[0] >= cx_mid and p[1] >= cy_mid]

        if not (tl and tr and bl and br):
            return None

        pick = lambda pts, key: sorted(pts, key=key)[0]
        tl_pt = pick(tl, lambda p: p[0] + p[1])
        tr_pt = pick(tr, lambda p: -p[0] + p[1])
        br_pt = pick(br, lambda p: -(p[0] + p[1]))
        bl_pt = pick(bl, lambda p: p[0] - p[1])

        return [tl_pt, tr_pt, br_pt, bl_pt]

    # ------------------------------------------------------------------ #
    # Strategy B: document contour                                         #
    # ------------------------------------------------------------------ #

    def _try_contour_alignment(
        self, image: np.ndarray
    ) -> tuple[np.ndarray | None, str]:
        """Find the sheet's outer border and warp it to reference size."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image

        # Work on a downscaled copy for speed
        small = cv2.resize(gray, (min(image.shape[1], 1200),
                                  min(image.shape[0], 1600)),
                           interpolation=cv2.INTER_AREA)
        sx = image.shape[1] / small.shape[1]
        sy = image.shape[0] / small.shape[0]

        blurred = cv2.GaussianBlur(small, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None, ""

        contours = sorted(contours, key=cv2.contourArea, reverse=True)

        for contour in contours[:5]:
            if cv2.contourArea(contour) < small.shape[0] * small.shape[1] * 0.1:
                break
            for eps_factor in (0.02, 0.04, 0.06):
                eps = eps_factor * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, eps, True)
                if len(approx) == 4:
                    # Scale back to original coords
                    scaled = approx.astype(np.float32)
                    scaled[:, 0, 0] *= sx
                    scaled[:, 0, 1] *= sy
                    pts = self._order_points(scaled)
                    dst = np.array([[0, 0],
                                    [self.ref_w - 1, 0],
                                    [self.ref_w - 1, self.ref_h - 1],
                                    [0, self.ref_h - 1]], dtype=np.float32)
                    M = cv2.getPerspectiveTransform(pts, dst)
                    warped = cv2.warpPerspective(
                        image, M, (self.ref_w, self.ref_h),
                        flags=cv2.INTER_LANCZOS4,
                        borderMode=cv2.BORDER_CONSTANT,
                        borderValue=(255, 255, 255),
                    )
                    logger.info("Alignment: document-contour warp")
                    return warped, "contour"

        return None, ""

    @staticmethod
    def _order_points(pts: np.ndarray) -> np.ndarray:
        pts = pts.reshape(4, 2).astype(np.float32)
        rect = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]
        d = np.diff(pts, axis=1).ravel()
        rect[1] = pts[np.argmin(d)]
        rect[3] = pts[np.argmax(d)]
        return rect
