import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, Field, model_validator

from app.common.enums import AttendanceStatus

CLASS_ATTENDANCE_STATUSES = {AttendanceStatus.present, AttendanceStatus.absent, AttendanceStatus.late}


# --- Biometric devices ---------------------------------------------------


class CreateBiometricDeviceRequest(BaseModel):
    device_serial: str = Field(..., min_length=1, max_length=50)
    location: str | None = Field(default=None, max_length=100)


class UpdateBiometricDeviceRequest(BaseModel):
    location: str | None = None
    is_active: bool | None = None


class BiometricDeviceResponse(BaseModel):
    id: str
    device_serial: str
    location: str | None
    is_active: bool
    created_at: datetime


# --- Punch ingestion -------------------------------------------------------


class PunchEventRequest(BaseModel):
    device_serial: str = Field(..., min_length=1, max_length=50)
    user_id: uuid.UUID
    punched_at: datetime
    raw_payload: dict | None = None


class AttendancePunchResponse(BaseModel):
    id: str
    user_id: str
    device_id: str
    device_serial: str
    punched_at: datetime


# --- Daily (biometric) attendance ------------------------------------------


class DailyAttendanceResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    role: str
    attendance_date: date
    entry_time: datetime | None
    exit_time: datetime | None
    status: AttendanceStatus


# --- Subject-wise class attendance ------------------------------------------


class MarkClassAttendanceItem(BaseModel):
    student_id: uuid.UUID
    status: AttendanceStatus

    @model_validator(mode="after")
    def check_status(self) -> "MarkClassAttendanceItem":
        if self.status not in CLASS_ATTENDANCE_STATUSES:
            raise ValueError("status must be one of: present, absent, late")
        return self


class MarkClassAttendanceRequest(BaseModel):
    routine_slot_id: uuid.UUID
    attendance_date: date
    items: list[MarkClassAttendanceItem] = Field(..., min_length=1)


class ClassAttendanceRosterItem(BaseModel):
    student_id: str
    student_name: str
    admission_number: str
    roll_number: str
    status: AttendanceStatus | None
    marked_at: datetime | None


class ClassAttendanceRosterResponse(BaseModel):
    routine_slot_id: str
    section_id: str
    section_name: str
    subject_name: str
    day_of_week: str
    period_number: int
    start_time: time
    end_time: time
    attendance_date: date
    window_open: bool
    roster: list[ClassAttendanceRosterItem]


class ClassAttendanceResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    admission_number: str
    routine_slot_id: str
    subject_name: str
    section_name: str
    attendance_date: date
    status: AttendanceStatus
    marked_by: str
    marked_by_name: str
    marked_at: datetime


# --- Combined per-student daily view -----------------------------------


class AttendancePeriodEntry(BaseModel):
    routine_slot_id: str
    period_number: int
    subject_name: str
    teacher_name: str
    start_time: time
    end_time: time
    status: AttendanceStatus | None
    marked_at: datetime | None


class CombinedDailyAttendanceResponse(BaseModel):
    student_id: str
    student_name: str
    attendance_date: date
    entry_time: datetime | None
    exit_time: datetime | None
    biometric_status: AttendanceStatus | None
    periods: list[AttendancePeriodEntry]
