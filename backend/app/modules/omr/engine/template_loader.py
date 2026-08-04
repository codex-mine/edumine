"""
app/modules/omr/engine/template_loader.py
==========================
Loads the calibrated template JSON and builds every bubble coordinate map
needed by the reader:
  - answer_bubble_map:  {question_num: {option: {x,y,radius}}}
  - class_bubble_map:   {class_value: {x,y,radius}}
  - roll_bubble_map:    {digit_pos: {digit_value: {x,y,radius}}}
  - subject_bubble_map: {digit_pos: {digit_value: {x,y,radius}}}
  - set_code_bubble_map:{value_str: {x,y,radius}}

All maps use GLOBAL pixel coordinates in the 2550×3300 reference space.
When the aligned image is at a different scale, pass scale_x / scale_y.
"""
from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

REQUIRED_KEYS = {"reference_width", "reference_height", "answer_section",
                 "roll_number_box", "subject_code_box", "set_code_box", "class_box"}


class TemplateLoader:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            raise FileNotFoundError(f"Template not found: {self.path}")
        with open(self.path, "r", encoding="utf-8") as f:
            tmpl = json.load(f)
        missing = REQUIRED_KEYS - set(tmpl.keys())
        if missing:
            raise KeyError(f"Template missing fields: {missing}")
        logger.info("Template loaded: %s", tmpl.get("name", self.path.stem))
        return tmpl

    # ------------------------------------------------------------------ #
    # Map builders                                                         #
    # ------------------------------------------------------------------ #

    def build_answer_map(
        self, tmpl: dict, scale_x: float = 1.0, scale_y: float = 1.0
    ) -> dict[int, dict[str, dict]]:
        """
        Returns:
            {question_int: {"Ka": {x,y,radius}, "Kha": ..., "Ga": ..., "Gha": ...}}
        """
        sec = tmpl["answer_section"]
        ox = int(sec["answer_area_origin_x"] * scale_x)
        oy = int(sec["answer_area_origin_y"] * scale_y)
        r  = max(4, int(sec["bubble_radius"] * min(scale_x, scale_y)))
        options = sec["options"]
        row_ys  = sec["row_local_ys"]

        bubble_map: dict[int, dict[str, dict]] = {}
        for sub_col in sec["sub_columns"]:
            q_start = sub_col["questions_start"]
            q_end   = sub_col["questions_end"]
            lxs     = sub_col["option_local_xs"]
            for row_idx, q_num in enumerate(range(q_start, q_end + 1)):
                ly = row_ys[row_idx]
                bubble_map[q_num] = {}
                for opt, lx in zip(options, lxs):
                    bubble_map[q_num][opt] = {
                        "x": ox + int(lx * scale_x),
                        "y": oy + int(ly * scale_y),
                        "radius": r,
                    }
        return bubble_map

    def build_class_map(
        self, tmpl: dict, scale_x: float = 1.0, scale_y: float = 1.0
    ) -> dict[int, dict]:
        """Returns: {class_value_int: {x, y, radius}}"""
        cb = tmpl["class_box"]
        cx = int(cb["col_x"] * scale_x)
        r  = max(4, int(cb["radius"] * min(scale_x, scale_y)))
        return {
            int(val): {"x": cx, "y": int(gy * scale_y), "radius": r}
            for val, gy in zip(cb["values"], cb["row_ys"])
        }

    def build_roll_map(
        self, tmpl: dict, scale_x: float = 1.0, scale_y: float = 1.0
    ) -> dict[int, dict[int, dict]]:
        """
        Returns: {digit_position (0-5): {digit_value (0-9): {x,y,radius}}}
        digit_position 0 = leftmost digit of the roll number.
        """
        rb = tmpl["roll_number_box"]
        r  = max(4, int(rb["radius"] * min(scale_x, scale_y)))
        roll_map: dict[int, dict[int, dict]] = {}
        for ci, gx_ref in enumerate(rb["col_xs"]):
            roll_map[ci] = {}
            for ri, gy_ref in enumerate(rb["row_ys"]):
                digit_val = rb["digit_values"][ri]
                roll_map[ci][digit_val] = {
                    "x": int(gx_ref * scale_x),
                    "y": int(gy_ref * scale_y),
                    "radius": r,
                }
        return roll_map

    def build_subject_map(
        self, tmpl: dict, scale_x: float = 1.0, scale_y: float = 1.0
    ) -> dict[int, dict[int, dict]]:
        """Returns: {digit_position (0-2): {digit_value (0-9): {x,y,radius}}}"""
        sb = tmpl["subject_code_box"]
        r  = max(4, int(sb["radius"] * min(scale_x, scale_y)))
        subj_map: dict[int, dict[int, dict]] = {}
        for ci, gx_ref in enumerate(sb["col_xs"]):
            subj_map[ci] = {}
            for ri, gy_ref in enumerate(sb["row_ys"]):
                digit_val = sb["digit_values"][ri]
                subj_map[ci][digit_val] = {
                    "x": int(gx_ref * scale_x),
                    "y": int(gy_ref * scale_y),
                    "radius": r,
                }
        return subj_map

    def build_set_code_map(
        self, tmpl: dict, scale_x: float = 1.0, scale_y: float = 1.0
    ) -> dict[str, dict]:
        """Returns: {"Ka": {x,y,radius}, "Kha": ..., ...}"""
        sc = tmpl["set_code_box"]
        gx = int(sc["col_x"] * scale_x)
        r  = max(4, int(sc["radius"] * min(scale_x, scale_y)))
        return {
            val: {"x": gx, "y": int(gy * scale_y), "radius": r}
            for val, gy in zip(sc["values"], sc["row_ys"])
        }
