import uuid

from pydantic import BaseModel, Field, model_validator


class MarkEntryItem(BaseModel):
    student_id: uuid.UUID
    marks_obtained: float | None = Field(default=None, ge=0)
    is_absent: bool = False

    @model_validator(mode="after")
    def check_mutually_exclusive(self) -> "MarkEntryItem":
        if self.is_absent and self.marks_obtained is not None:
            raise ValueError("An absent student cannot also have marks_obtained set")
        if not self.is_absent and self.marks_obtained is None:
            raise ValueError("marks_obtained is required unless the student is marked absent")
        return self


class SaveMarksRequest(BaseModel):
    items: list[MarkEntryItem] = Field(..., min_length=1)


class RejectResultsRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)
