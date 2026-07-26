import uuid
from datetime import datetime, time

from pydantic import BaseModel, Field, model_validator

from app.common.enums import Weekday


class CreateRoutineSlotRequest(BaseModel):
    academic_year_id: uuid.UUID | None = None
    section_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    room_id: uuid.UUID | None = None
    day_of_week: Weekday
    period_number: int = Field(..., ge=1, le=20)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def check_time_range(self) -> "CreateRoutineSlotRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class UpdateRoutineSlotRequest(BaseModel):
    subject_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None
    room_id: uuid.UUID | None = None
    clear_room: bool = False
    day_of_week: Weekday | None = None
    period_number: int | None = Field(default=None, ge=1, le=20)
    start_time: time | None = None
    end_time: time | None = None

    @model_validator(mode="after")
    def check_time_range(self) -> "UpdateRoutineSlotRequest":
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class RoutineSlotResponse(BaseModel):
    id: str
    academic_year_id: str
    section_id: str
    section_name: str
    class_id: str
    class_name: str
    subject_id: str
    subject_name: str
    subject_code: str
    teacher_id: str
    teacher_name: str
    room_id: str | None
    room_name: str | None
    day_of_week: Weekday
    period_number: int
    start_time: time
    end_time: time
    created_at: datetime


class SectionRoutineResponse(BaseModel):
    section_id: str
    section_name: str
    class_id: str
    class_name: str
    slots: list[RoutineSlotResponse]


class StudentSectionRoutineResponse(BaseModel):
    student_id: str
    student_name: str
    section: SectionRoutineResponse


class GuardianRoutineResponse(BaseModel):
    children: list[StudentSectionRoutineResponse]
