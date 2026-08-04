import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

# The four bubble options on the answer sheet, in template order. The template's
# `options_english` are the canonical spellings; input is accepted in any casing
# and normalized to these exact forms so the scorer's comparisons never depend on
# how a teacher happened to type them.
ANSWER_OPTIONS = ("Ka", "Kha", "Ga", "Gha")
_OPTION_BY_LOWER = {option.lower(): option for option in ANSWER_OPTIONS}

# The Set Code column, used when one exam is sat with shuffled question orders.
SET_CODES = ("Ka", "Kha", "Ga", "Gha", "Nga", "Cha")
_SET_CODE_BY_LOWER = {code.lower(): code for code in SET_CODES}

MAX_QUESTIONS = 200


def normalize_option(value: str, *, field: str) -> str:
    normalized = _OPTION_BY_LOWER.get(str(value).strip().lower())
    if normalized is None:
        raise ValueError(f"{field}: '{value}' is not a valid option — expected one of {', '.join(ANSWER_OPTIONS)}")
    return normalized


def normalize_set_code(value: str) -> str:
    normalized = _SET_CODE_BY_LOWER.get(str(value).strip().lower())
    if normalized is None:
        raise ValueError(f"'{value}' is not a valid set code — expected one of {', '.join(SET_CODES)}")
    return normalized


class AnswerKeyEntry(BaseModel):
    """Extended per-question form: its own marks and negative-marking weight.

    Used when questions are not all worth the same. Questions given as a bare
    option string fall back to the key's `marks_per_correct` / `negative_marks`.
    """

    correct: str
    marks: float = Field(default=1.0, gt=0)
    negative: float = Field(default=0.0, ge=0)

    @model_validator(mode="after")
    def _normalize_correct(self) -> "AnswerKeyEntry":
        self.correct = normalize_option(self.correct, field="correct")
        return self


class SaveAnswerKeyRequest(BaseModel):
    total_questions: int = Field(..., ge=1, le=MAX_QUESTIONS)
    answers: dict[str, str | AnswerKeyEntry] = Field(..., min_length=1)
    marks_per_correct: float = Field(default=1.0, gt=0)
    negative_marks: float = Field(default=0.0, ge=0)

    @model_validator(mode="after")
    def _validate_answers(self) -> "SaveAnswerKeyRequest":
        parsed: dict[int, str | AnswerKeyEntry] = {}
        for raw_key, value in self.answers.items():
            try:
                question_number = int(str(raw_key).strip())
            except ValueError:
                raise ValueError(f"Question key '{raw_key}' is not a number") from None
            if question_number in parsed:
                raise ValueError(f"Question {question_number} is listed more than once")
            parsed[question_number] = value

        # Contiguous 1..total_questions. A gap almost always means a mis-typed
        # key rather than an intentionally unscored question, and silently
        # accepting it would score the sheet out of the wrong total.
        expected = set(range(1, self.total_questions + 1))
        actual = set(parsed)
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            problems = []
            if missing:
                problems.append(f"missing {_summarize(missing)}")
            if extra:
                problems.append(f"unexpected {_summarize(extra)}")
            raise ValueError(
                f"Answers must cover questions 1-{self.total_questions} exactly — " + "; ".join(problems)
            )

        self.answers = {
            str(number): (
                value if isinstance(value, AnswerKeyEntry) else normalize_option(value, field=f"question {number}")
            )
            for number, value in sorted(parsed.items())
        }
        return self

    def to_storage(self) -> dict[str, str | dict]:
        """The `answers` payload as it is persisted and handed to the scorer."""
        return {
            number: (value.model_dump() if isinstance(value, AnswerKeyEntry) else value)
            for number, value in self.answers.items()
        }


def _summarize(numbers: list[int], limit: int = 10) -> str:
    shown = ", ".join(str(n) for n in numbers[:limit])
    return f"{shown}, ..." if len(numbers) > limit else shown


class AnswerKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exam_subject_id: uuid.UUID
    set_code: str
    total_questions: int
    answers: dict[str, str | dict]
    marks_per_correct: float
    negative_marks: float
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CreateBatchRequest(BaseModel):
    exam_subject_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=120)


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exam_subject_id: uuid.UUID
    name: str
    status: str
    template_name: str
    mcq_full_marks: int
    sheet_count: int
    processed_count: int
    matched_count: int
    failed_count: int
    uploaded_by: uuid.UUID
    applied_by: uuid.UUID | None
    applied_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SheetResponse(BaseModel):
    """A scanned sheet without its per-question breakdown — the list view."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: uuid.UUID
    status: str
    match_status: str | None
    original_filename: str
    image_url: str
    annotated_image_url: str | None
    detected_class: int | None
    detected_roll: str | None
    detected_subject_code: str | None
    detected_set_code: str | None
    alignment_method: str | None
    student_id: uuid.UUID | None
    matched_manually: bool
    correct_count: int | None
    wrong_count: int | None
    blank_count: int | None
    multiple_count: int | None
    marks_obtained: float | None
    percentage: float | None
    review_note: str | None
    error_message: str | None
    processing_time_ms: int | None
    created_at: datetime
    updated_at: datetime


class SheetDetailResponse(SheetResponse):
    """Adds the per-question data a reviewer needs to judge a flagged sheet."""

    answers: dict[str, dict] | None
    score_details: dict[str, dict] | None


class EligibilityResponse(BaseModel):
    """Whether an exam subject can be OMR-scanned, and on what terms."""

    exam_subject_id: uuid.UUID
    eligible: bool
    mcq_full_marks: int | None = None
    source: str | None = None
    section_name: str | None = None
    reason: str | None = None
    answer_key_set_codes: list[str] = Field(default_factory=list)
