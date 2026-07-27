import uuid
from datetime import date

from pydantic import BaseModel, Field, model_validator


class AttendanceInsightRequest(BaseModel):
    """Section 4.5 — Attendance Pattern Insight input, scoped to one student or one section."""

    scope: str = Field(pattern="^(student|class)$")
    student_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    date_from: date
    date_to: date

    @model_validator(mode="after")
    def _check_target(self) -> "AttendanceInsightRequest":
        if self.scope == "student" and self.student_id is None:
            raise ValueError("student_id is required when scope is 'student'")
        if self.scope == "class" and self.section_id is None:
            raise ValueError("section_id is required when scope is 'class'")
        if self.date_to < self.date_from:
            raise ValueError("date_to must be on or after date_from")
        return self


class AtRiskStudentsRequest(BaseModel):
    """Section 4.7 — At-Risk Student Recommendation input. Thresholds are caller-supplied, never AI-decided."""

    section_id: uuid.UUID
    attendance_threshold_percent: float | None = Field(default=None, ge=0, le=100)
    attendance_date_from: date | None = None
    attendance_date_to: date | None = None
    marks_threshold_percent: float | None = Field(default=None, ge=0, le=100)
    exam_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_thresholds(self) -> "AtRiskStudentsRequest":
        if self.attendance_threshold_percent is None and self.marks_threshold_percent is None:
            raise ValueError("At least one of attendance_threshold_percent or marks_threshold_percent is required")
        if self.attendance_threshold_percent is not None and (
            self.attendance_date_from is None or self.attendance_date_to is None
        ):
            raise ValueError("attendance_date_from/attendance_date_to are required with attendance_threshold_percent")
        if self.marks_threshold_percent is not None and self.exam_id is None:
            raise ValueError("exam_id is required with marks_threshold_percent")
        return self


class GuardianConversationTurn(BaseModel):
    question: str
    answer: str


class GuardianAssistantRequest(BaseModel):
    """Section 4.4 — Guardian Support Assistant, with Section 8 session-scoped conversation memory."""

    student_id: uuid.UUID
    question: str = Field(min_length=1, max_length=1000)
    conversation: list[GuardianConversationTurn] = Field(default_factory=list, max_length=10)
