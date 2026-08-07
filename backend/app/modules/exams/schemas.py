import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.common.enums import ExamStatus, QuestionApprovalStatus

QuestionType = Literal["mcq", "short", "long"]


class CreateExamRequest(BaseModel):
    academic_year_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=100)
    term: str | None = Field(default=None, max_length=30)
    start_date: date
    end_date: date
    class_ids: list[uuid.UUID] = Field(..., min_length=1)

    @model_validator(mode="after")
    def check_date_range(self) -> "CreateExamRequest":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class ExamClassResponse(BaseModel):
    class_id: str
    class_name: str


class ExamResponse(BaseModel):
    id: str
    academic_year_id: str
    name: str
    term: str | None
    start_date: date
    end_date: date
    status: ExamStatus
    created_by: str
    created_at: datetime
    classes: list[ExamClassResponse]


class CandidateSubjectResponse(BaseModel):
    class_id: str
    class_name: str
    subject_id: str
    subject_name: str
    subject_code: str
    teacher_id: str | None
    teacher_name: str | None
    default_full_marks: int
    exam_subject_id: str | None


class ExamSubjectSectionInput(BaseModel):
    """A named mark-scheme breakdown within a subject, e.g. CQ, MCQ, Practical,
    Lab, or a custom section name — each with its own total and pass marks."""

    name: str = Field(..., min_length=1, max_length=50)
    full_marks: int = Field(..., ge=1, le=1000)
    pass_marks: int = Field(..., ge=0, le=1000)

    @model_validator(mode="after")
    def check_marks(self) -> "ExamSubjectSectionInput":
        if self.pass_marks > self.full_marks:
            raise ValueError("A section's pass_marks cannot exceed its full_marks")
        return self


class ExamSubjectSectionResponse(ExamSubjectSectionInput):
    id: str


class ExamSubjectConfigItem(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    full_marks: int | None = Field(default=None, ge=1, le=1000)
    pass_marks: int = Field(..., ge=0, le=1000)
    question_window_opens_at: datetime | None = None
    question_deadline: datetime
    marks_window_opens_at: datetime | None = None
    marks_deadline: datetime
    sections: list[ExamSubjectSectionInput] = Field(
        default_factory=list,
        description="Optional marks breakdown (CQ/MCQ/Practical/Lab/custom). When provided, "
        "section full_marks must sum to exactly this subject's full_marks.",
    )

    @model_validator(mode="after")
    def check_marks(self) -> "ExamSubjectConfigItem":
        if self.full_marks is not None and self.pass_marks > self.full_marks:
            raise ValueError("pass_marks cannot exceed full_marks")
        if self.marks_deadline < self.question_deadline:
            raise ValueError("marks_deadline cannot be before question_deadline")
        if self.question_window_opens_at is not None and self.question_window_opens_at > self.question_deadline:
            raise ValueError("question submission window cannot open after its own deadline")
        if self.marks_window_opens_at is not None and self.marks_window_opens_at > self.marks_deadline:
            raise ValueError("marks submission window cannot open after its own deadline")
        if self.sections and self.full_marks is not None:
            section_total = sum(section.full_marks for section in self.sections)
            if section_total != self.full_marks:
                raise ValueError(f"Section marks must sum to exactly {self.full_marks} (got {section_total})")
        return self


class ConfigureExamSubjectsRequest(BaseModel):
    items: list[ExamSubjectConfigItem] = Field(..., min_length=1)


class QuestionItem(BaseModel):
    question_text: str = Field(..., min_length=1)
    marks: int = Field(..., ge=1)
    type: QuestionType
    options: list[str] | None = None
    section: str | None = Field(
        default=None,
        max_length=50,
        description="Optional exam-subject section this question belongs to (CQ, MCQ, Practical, ...). "
        "Groups the question on the printed paper.",
    )


class ExamSubjectResponse(BaseModel):
    id: str
    exam_id: str
    exam_name: str
    exam_status: ExamStatus
    class_id: str
    class_name: str
    subject_id: str
    subject_name: str
    teacher_id: str
    teacher_name: str
    full_marks: int
    pass_marks: int
    question_window_opens_at: datetime | None
    question_deadline: datetime
    question_submitted_at: datetime | None
    marks_window_opens_at: datetime | None
    marks_deadline: datetime
    marks_submitted_at: datetime | None
    is_overdue: bool
    extension_requested: bool
    questions: list[QuestionItem] | None = None
    sections: list[ExamSubjectSectionResponse] = Field(default_factory=list)
    question_status: QuestionApprovalStatus
    question_reviewed_by: str | None = None
    question_reviewer_name: str | None = None
    question_reviewed_at: datetime | None = None
    question_review_note: str | None = None


class SubmitQuestionsRequest(BaseModel):
    questions: list[QuestionItem] = Field(..., min_length=1)

    @model_validator(mode="after")
    def check_non_empty(self) -> "SubmitQuestionsRequest":
        for item in self.questions:
            if item.type == "mcq" and (not item.options or len(item.options) < 2):
                raise ValueError("MCQ questions require at least two options")
        return self


class RequestRevisionRequest(BaseModel):
    note: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="What the teacher needs to change — shown to them on their submission",
    )


class QuestionPaperSectionQuestion(BaseModel):
    number: int
    question_text: str
    marks: int
    type: QuestionType
    options: list[str] | None = None


class QuestionPaperSection(BaseModel):
    name: str
    full_marks: int | None
    questions: list[QuestionPaperSectionQuestion]


class QuestionPaperResponse(BaseModel):
    """Everything needed to render one printable subject paper — no further
    lookups required by the client."""

    exam_subject_id: str
    exam_id: str
    exam_name: str
    term: str | None
    academic_year_name: str
    class_name: str
    subject_name: str
    subject_code: str
    teacher_name: str
    full_marks: int
    pass_marks: int
    exam_date: date
    question_status: QuestionApprovalStatus
    total_questions: int
    total_marks: int
    sections: list[QuestionPaperSection]


class RequestExtensionRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)
    requested_deadline: datetime


class ExtendDeadlineRequest(BaseModel):
    new_deadline: datetime


class ExtensionRequestResponse(BaseModel):
    exam_subject_id: str
    exam_id: str
    exam_name: str
    class_name: str
    subject_name: str
    teacher_id: str
    teacher_name: str
    current_deadline: datetime
    requested_deadline: datetime
    reason: str
    requested_at: datetime


class DraftQuestionsRequest(BaseModel):
    topics: str = Field(..., min_length=1, max_length=2000)
    question_count: int = Field(..., ge=1, le=50)
    question_type: Literal["mcq", "short", "long", "mixed"] = "mixed"


class DraftQuestionItem(BaseModel):
    question_text: str
    marks: int
    type: QuestionType
    options: list[str] | None = None


class DraftQuestionsResponse(BaseModel):
    questions: list[DraftQuestionItem]
    total_marks_check: int
