"""
app/modules/omr/exporter.py
===================
Exports batch OMR results to professional Excel (3 sheets) and CSV.

Excel sheets:
  1. Summary        — one row per student with all metadata + score
  2. Answer Details — Q-by-Q answer status coloured green/red/yellow
  3. Statistics     — class averages, grade distribution, pass rate
"""
from __future__ import annotations
import csv
import logging
import os
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)

# ── Style constants ──────────────────────────────────────────────────────────
_HDR_FILL  = PatternFill("solid", fgColor="1F4E79")
_CORR_FILL = PatternFill("solid", fgColor="C6EFCE")
_WRONG_FILL= PatternFill("solid", fgColor="FFC7CE")
_BLNK_FILL = PatternFill("solid", fgColor="FFEB9C")
_MULT_FILL = PatternFill("solid", fgColor="D9D9D9")
_ALT_FILL  = PatternFill("solid", fgColor="EBF3FB")

_HDR_FONT  = Font(color="FFFFFF", bold=True, size=10, name="Calibri")
_BODY_FONT = Font(size=10, name="Calibri")
_TITLE_FONT= Font(bold=True, size=13, name="Calibri")

_THIN = Side(style="thin", color="BFBFBF")
_BORDER= Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
_CENTER= Alignment(horizontal="center", vertical="center")
_LEFT  = Alignment(horizontal="left",   vertical="center")


class ResultExporter:
    def __init__(self, output_dir: str | Path = "exports") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ #
    # CSV                                                                  #
    # ------------------------------------------------------------------ #

    def export_csv(
        self, results: list[dict[str, Any]], filename: str = "results.csv"
    ) -> Path:
        filepath = self.output_dir / filename
        with open(filepath, "w", newline="", encoding="utf-8-sig") as fh:
            writer = csv.writer(fh)
            writer.writerow([
                "Student ID", "Class", "Roll Number", "Subject Code", "Set Code",
                "Correct", "Wrong", "Blank", "Multiple",
                "Raw Score", "Adjusted Score", "Max Marks", "Percentage", "Grade",
            ])
            for row in results:
                meta  = row.get("metadata", {})
                score = row.get("score") or {}
                writer.writerow([
                    row.get("student_id", ""),
                    meta.get("class_value", {}).get("value", ""),
                    meta.get("roll_number", {}).get("roll_number", ""),
                    meta.get("subject_code", {}).get("subject_code", ""),
                    meta.get("set_code", {}).get("value", ""),
                    score.get("correct", 0),
                    score.get("wrong", 0),
                    score.get("blank", 0),
                    score.get("multiple", 0),
                    score.get("raw_score", 0),
                    score.get("adjusted_score", 0),
                    score.get("max_marks", 0),
                    score.get("percentage", 0),
                    score.get("grade", ""),
                ])
        logger.info("CSV exported: %s", filepath)
        return filepath

    # ------------------------------------------------------------------ #
    # Excel                                                                #
    # ------------------------------------------------------------------ #

    def export_excel(
        self,
        results: list[dict[str, Any]],
        filename: str = "results.xlsx",
        exam_title: str = "OMR Examination Results",
    ) -> Path:
        wb = Workbook()
        wb.remove(wb.active)  # type: ignore
        self._summary_sheet(wb, results, exam_title)
        self._answer_sheet(wb, results, exam_title)
        self._stats_sheet(wb, results, exam_title)

        filepath = self.output_dir / filename
        self._safe_save(wb, filepath)
        logger.info("Excel exported: %s", filepath)
        return filepath

    # ── Sheet: Summary ───────────────────────────────────────────────────

    def _summary_sheet(self, wb: Workbook, results: list, title: str) -> None:
        ws = wb.create_sheet("Summary")
        headers = [
            "Student ID", "Class", "Roll Number", "Subject Code", "Set Code",
            "Correct", "Wrong", "Blank", "Multiple",
            "Raw Score", "Adjusted Score", "Max Marks", "Percentage (%)", "Grade",
        ]
        n = len(headers)
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=n)
        tc = ws.cell(1, 1, title); tc.font = _TITLE_FONT; tc.alignment = _CENTER
        ws.row_dimensions[1].height = 26

        self._hdr_row(ws, 2, headers)

        for ri, row in enumerate(results, 3):
            meta  = row.get("metadata", {})
            score = row.get("score") or {}
            data  = [
                row.get("student_id", f"Student_{ri-2}"),
                meta.get("class_value", {}).get("value", ""),
                meta.get("roll_number", {}).get("roll_number", ""),
                meta.get("subject_code", {}).get("subject_code", ""),
                meta.get("set_code", {}).get("value", ""),
                score.get("correct", 0),
                score.get("wrong", 0),
                score.get("blank", 0),
                score.get("multiple", 0),
                score.get("raw_score", 0),
                score.get("adjusted_score", 0),
                score.get("max_marks", 0),
                score.get("percentage", 0.0),
                score.get("grade", ""),
            ]
            alt = _ALT_FILL if ri % 2 == 0 else None
            for ci, val in enumerate(data, 1):
                cell = ws.cell(ri, ci, val)
                cell.font = _BODY_FONT; cell.border = _BORDER; cell.alignment = _CENTER
                if alt:
                    cell.fill = alt
                if ci == 14 and isinstance(val, str):
                    cell.fill = _CORR_FILL if val in ("A+", "A") else (_WRONG_FILL if val == "F" else _ALT_FILL)

        self._auto_width(ws)

    # ── Sheet: Answer Details ────────────────────────────────────────────

    def _answer_sheet(self, wb: Workbook, results: list, title: str) -> None:
        ws = wb.create_sheet("Answer Details")

        q_numbers: list[str] = []
        for row in results:
            details = (row.get("score") or {}).get("details", {})
            if details:
                q_numbers = sorted(details.keys(), key=lambda x: int(x))
                break
        if not q_numbers:
            ws["A1"] = "No answer details available."
            return

        nc = 1 + len(q_numbers)
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=nc)
        tc = ws.cell(1, 1, title); tc.font = _TITLE_FONT; tc.alignment = _CENTER
        ws.row_dimensions[1].height = 26

        self._hdr_row(ws, 2, ["Student ID"] + [f"Q{q}" for q in q_numbers])

        status_fill = {
            "correct": _CORR_FILL, "wrong": _WRONG_FILL,
            "blank": _BLNK_FILL,   "multiple": _MULT_FILL, "ambiguous": _MULT_FILL,
        }
        for ri, row in enumerate(results, 3):
            details = (row.get("score") or {}).get("details", {})
            cell = ws.cell(ri, 1, row.get("student_id", f"Student_{ri-2}"))
            cell.font = _BODY_FONT; cell.border = _BORDER; cell.alignment = _CENTER

            for ci, q_str in enumerate(q_numbers, 2):
                d    = details.get(q_str, {})
                ans  = d.get("student", "?")
                st   = d.get("status", "blank")
                c    = ws.cell(ri, ci, ans)
                c.font = _BODY_FONT; c.border = _BORDER; c.alignment = _CENTER
                c.fill = status_fill.get(st, PatternFill())

        self._auto_width(ws, min_w=5, max_w=10)

    # ── Sheet: Statistics ────────────────────────────────────────────────

    def _stats_sheet(self, wb: Workbook, results: list, title: str) -> None:
        ws = wb.create_sheet("Statistics")
        pcts    = [(r.get("score") or {}).get("percentage", 0.0) for r in results]
        grades  = [(r.get("score") or {}).get("grade", "F") for r in results]
        n       = len(results)
        avg     = sum(pcts) / n if n else 0
        pass_r  = sum(1 for p in pcts if p >= 40) / n * 100 if n else 0

        ws.merge_cells("A1:C1")
        tc = ws.cell(1, 1, f"{title} — Statistics"); tc.font = _TITLE_FONT; tc.alignment = _CENTER
        ws.row_dimensions[1].height = 26

        stats = [
            ("Total Students",    n),
            ("Average Score (%)", round(avg, 2)),
            ("Highest Score (%)", round(max(pcts), 2) if pcts else 0),
            ("Lowest Score (%)",  round(min(pcts), 2) if pcts else 0),
            ("Pass Rate (≥40%)",  f"{pass_r:.1f}%"),
        ]
        for ri, (label, val) in enumerate(stats, 2):
            lc = ws.cell(ri, 1, label); lc.font = Font(bold=True, size=10, name="Calibri"); lc.border = _BORDER; lc.alignment = _LEFT
            vc = ws.cell(ri, 2, val);   vc.font = _BODY_FONT; vc.border = _BORDER; vc.alignment = _CENTER

        start = len(stats) + 3
        ws.cell(start, 1, "Grade Distribution").font = Font(bold=True, size=10, name="Calibri")
        self._hdr_row(ws, start + 1, ["Grade", "Count", "Percentage"])
        grade_dist: dict[str, int] = {}
        for g in grades:
            grade_dist[g] = grade_dist.get(g, 0) + 1
        for ro, (grade, cnt) in enumerate(sorted(grade_dist.items()), start + 2):
            ws.cell(ro, 1, grade).border  = _BORDER
            ws.cell(ro, 2, cnt).border    = _BORDER
            ws.cell(ro, 3, f"{cnt/n*100:.1f}%" if n else "0%").border = _BORDER

        self._auto_width(ws)

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _hdr_row(ws: Any, row: int, headers: list[str]) -> None:
        for ci, h in enumerate(headers, 1):
            c = ws.cell(row, ci, h)
            c.font = _HDR_FONT; c.fill = _HDR_FILL; c.border = _BORDER; c.alignment = _CENTER
        ws.row_dimensions[row].height = 18

    @staticmethod
    def _auto_width(ws: Any, min_w: int = 8, max_w: int = 28) -> None:
        for col_cells in ws.columns:
            max_len = max(
                (len(str(c.value)) if c.value is not None else 0) for c in col_cells
            )
            ws.column_dimensions[get_column_letter(col_cells[0].column)].width = max(
                min_w, min(max_len + 3, max_w)
            )

    @staticmethod
    def _safe_save(wb: Workbook, filepath: Path) -> None:
        tmp = filepath.with_suffix(".tmp.xlsx")
        try:
            wb.save(str(tmp))
            if filepath.exists():
                filepath.unlink()
            os.rename(str(tmp), str(filepath))
        except Exception:
            if tmp.exists():
                tmp.unlink()
            raise
