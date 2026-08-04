"""
app/modules/omr/engine/scorer.py
=================
Scores extracted answers against an answer key.

Supports:
  - Simple answer key:   {"answers": {"1": "Ka", "2": "Kha", ...}}
  - Extended answer key: {"answers": {"1": {"correct": "Ka", "marks": 1, "negative": 0.25}}}
  - Global ScoringConfig (marks per correct, negative deduction, grade boundaries)
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ScoringConfig:
    marks_per_correct: float = 1.0
    negative_marks:    float = 0.0      # deducted per wrong answer
    marks_for_blank:   float = 0.0
    marks_for_multiple: float = 0.0
    grade_boundaries: dict[str, float] = field(default_factory=lambda: {
        "A+": 90.0, "A": 80.0, "B": 70.0, "C": 60.0, "D": 50.0, "F": 0.0,
    })


class OMRScorer:
    def __init__(self, config: ScoringConfig | None = None) -> None:
        self.config = config or ScoringConfig()

    def score(
        self,
        student_answers: dict[int, dict],
        answer_key: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Compare student answers with the answer key.

        Returns:
            {correct, wrong, blank, multiple, raw_score, adjusted_score,
             max_marks, percentage, grade, details}
        """
        answers_data: dict[str, Any] = answer_key.get("answers", {})
        total_questions = len(answers_data)

        result: dict[str, Any] = {
            "correct": 0, "wrong": 0, "blank": 0, "multiple": 0,
            "raw_score": 0.0, "adjusted_score": 0.0,
            "max_marks": 0.0, "percentage": 0.0, "grade": "F",
            "details": {},
        }

        max_marks = 0.0

        for q_str, key_value in answers_data.items():
            q_num = int(q_str)

            # Parse key entry
            if isinstance(key_value, dict):
                correct_answer = str(key_value["correct"]).upper()
                q_marks  = float(key_value.get("marks",    self.config.marks_per_correct))
                q_neg    = float(key_value.get("negative", self.config.negative_marks))
            else:
                correct_answer = str(key_value).upper()
                q_marks  = self.config.marks_per_correct
                q_neg    = self.config.negative_marks

            max_marks += q_marks
            student_entry = student_answers.get(q_num)

            if student_entry is None:
                status         = "blank"
                student_answer = "BLANK"
                marks_awarded  = self.config.marks_for_blank
                result["blank"] += 1
            else:
                student_answer = str(student_entry.get("answer", "BLANK")).upper()
                ans_status     = student_entry.get("status", "blank")

                if ans_status in ("blank",) or student_answer == "BLANK":
                    status = "blank"
                    marks_awarded = self.config.marks_for_blank
                    result["blank"] += 1

                elif ans_status in ("multiple", "ambiguous") or student_answer == "MULTIPLE":
                    status = "multiple"
                    marks_awarded = self.config.marks_for_multiple
                    result["multiple"] += 1

                elif student_answer == correct_answer:
                    status = "correct"
                    marks_awarded = q_marks
                    result["correct"] += 1

                else:
                    status = "wrong"
                    marks_awarded = -q_neg
                    result["wrong"] += 1

            result["raw_score"]      += max(marks_awarded, 0.0)
            result["adjusted_score"] += marks_awarded

            result["details"][q_str] = {
                "student":    student_answer,
                "correct":    correct_answer,
                "status":     status,
                "marks":      round(marks_awarded, 3),
                "confidence": (student_entry or {}).get("confidence", "LOW"),
                "fill_score": round((student_entry or {}).get("fill_score", 0.0), 4),
            }

        result["max_marks"]       = round(max_marks, 3)
        result["raw_score"]       = round(result["raw_score"], 3)
        result["adjusted_score"]  = round(result["adjusted_score"], 3)
        result["percentage"]      = (
            round(result["adjusted_score"] / max_marks * 100, 2) if max_marks > 0 else 0.0
        )
        result["grade"] = self._grade(result["percentage"])
        return result

    def _grade(self, pct: float) -> str:
        for grade, min_pct in sorted(
            self.config.grade_boundaries.items(), key=lambda kv: kv[1], reverse=True
        ):
            if pct >= min_pct:
                return grade
        return "F"
