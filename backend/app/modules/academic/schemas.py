import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.common.enums import EnrollmentStatus


# --- Academic Years ----------------------------------------------------


class CreateAcademicYearRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=20)
    start_date: date
    end_date: date
    clone_from_year_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def check_date_range(self) -> "CreateAcademicYearRequest":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class AcademicYearResponse(BaseModel):
    id: str
    name: str
    start_date: date
    end_date: date
    is_active: bool
    cloned_from_year_id: str | None
    created_at: datetime


# --- Classes / Rooms / Subjects (master, reusable across years) --------


class CreateClassRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    numeric_order: int = Field(..., ge=0, le=32767)


class UpdateClassRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    numeric_order: int | None = Field(default=None, ge=0, le=32767)


class ClassResponse(BaseModel):
    id: str
    name: str
    numeric_order: int
    created_at: datetime


class CreateRoomRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    capacity: int | None = Field(default=None, ge=0, le=32767)


class UpdateRoomRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    capacity: int | None = Field(default=None, ge=0, le=32767)


class RoomResponse(BaseModel):
    id: str
    name: str
    capacity: int | None
    created_at: datetime


class CreateSubjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)


class UpdateSubjectRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=20)


class SubjectResponse(BaseModel):
    id: str
    name: str
    code: str
    created_at: datetime


# --- Sections (year-scoped) --------------------------------------------


class CreateSectionRequest(BaseModel):
    academic_year_id: uuid.UUID | None = None
    class_id: uuid.UUID
    room_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=20)
    capacity: int | None = Field(default=None, ge=0, le=32767)
    class_teacher_id: uuid.UUID | None = None


class UpdateSectionRequest(BaseModel):
    room_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=20)
    capacity: int | None = Field(default=None, ge=0, le=32767)
    class_teacher_id: uuid.UUID | None = None
    clear_room: bool = False
    clear_class_teacher: bool = False


class SectionResponse(BaseModel):
    id: str
    academic_year_id: str
    class_id: str
    class_name: str
    room_id: str | None
    room_name: str | None
    name: str
    capacity: int | None
    enrolled_count: int
    class_teacher_id: str | None
    class_teacher_name: str | None
    created_at: datetime


# --- Class-Subject-Teacher assignment (year-scoped) --------------------


class CreateClassSubjectRequest(BaseModel):
    academic_year_id: uuid.UUID | None = None
    class_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID | None = None
    full_marks: int = Field(default=100, ge=1, le=1000)


class UpdateClassSubjectRequest(BaseModel):
    teacher_id: uuid.UUID | None = None
    full_marks: int | None = Field(default=None, ge=1, le=1000)
    clear_teacher: bool = False


class ClassSubjectResponse(BaseModel):
    id: str
    academic_year_id: str
    class_id: str
    class_name: str
    subject_id: str
    subject_name: str
    subject_code: str
    teacher_id: str | None
    teacher_name: str | None
    full_marks: int
    created_at: datetime


# --- Student Enrollment / Promotion ------------------------------------


class EnrollStudentRequest(BaseModel):
    student_id: uuid.UUID
    academic_year_id: uuid.UUID | None = None
    section_id: uuid.UUID
    roll_number: str | None = Field(default=None, min_length=1, max_length=10)


class UpdateEnrollmentRequest(BaseModel):
    section_id: uuid.UUID | None = None
    roll_number: str | None = Field(default=None, min_length=1, max_length=10)
    status: EnrollmentStatus | None = None


class EnrollmentResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    admission_number: str
    academic_year_id: str
    academic_year_name: str
    section_id: str
    section_name: str
    class_id: str
    class_name: str
    roll_number: str
    status: EnrollmentStatus
    created_at: datetime


class PromotionItem(BaseModel):
    student_id: uuid.UUID
    outcome: EnrollmentStatus = EnrollmentStatus.promoted
    target_section_id: uuid.UUID | None = None
    roll_number: str | None = Field(default=None, min_length=1, max_length=10)

    @model_validator(mode="after")
    def check_target_fields(self) -> "PromotionItem":
        if self.outcome == EnrollmentStatus.promoted:
            if self.target_section_id is None or self.roll_number is None:
                raise ValueError("target_section_id and roll_number are required when outcome is 'promoted'")
        return self


class PromoteStudentsRequest(BaseModel):
    target_academic_year_id: uuid.UUID
    source_academic_year_id: uuid.UUID | None = None
    items: list[PromotionItem] = Field(..., min_length=1)


class PromotionOutcome(BaseModel):
    student_id: str
    outcome: EnrollmentStatus
    new_enrollment_id: str | None


class PromoteStudentsResponse(BaseModel):
    results: list[PromotionOutcome]
