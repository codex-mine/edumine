import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_current_user, get_db_session, require_permission
from app.core.response import success_response
from app.modules.attendance import service
from app.modules.attendance.schemas import (
    AttendancePunchResponse,
    BiometricDeviceResponse,
    ClassAttendanceResponse,
    ClassAttendanceRosterItem,
    ClassAttendanceRosterResponse,
    CombinedDailyAttendanceResponse,
    AttendancePeriodEntry,
    CreateBiometricDeviceRequest,
    DailyAttendanceResponse,
    MarkClassAttendanceRequest,
    PunchEventRequest,
    UpdateBiometricDeviceRequest,
)

router = APIRouter(prefix="/attendance", tags=["attendance"])


# --- Response builders ------------------------------------------------------


def _device_response(entity) -> dict:
    return BiometricDeviceResponse(
        id=str(entity.id),
        device_serial=entity.device_serial,
        location=entity.location,
        is_active=entity.is_active,
        created_at=entity.created_at,
    ).model_dump(mode="json")


def _punch_response(punch, device) -> dict:
    return AttendancePunchResponse(
        id=str(punch.id),
        user_id=str(punch.user_id),
        device_id=str(device.id),
        device_serial=device.device_serial,
        punched_at=punch.punched_at,
    ).model_dump(mode="json")


def _daily_response(row) -> dict:
    daily, user, role_name = row
    return DailyAttendanceResponse(
        id=str(daily.id),
        user_id=str(user.id),
        full_name=user.full_name,
        role=role_name,
        attendance_date=daily.attendance_date,
        entry_time=daily.entry_time,
        exit_time=daily.exit_time,
        status=daily.status,
    ).model_dump(mode="json")


def _class_attendance_response(row) -> dict:
    attendance, student, user, slot, section, subject, teacher, teacher_user = row
    return ClassAttendanceResponse(
        id=str(attendance.id),
        student_id=str(student.id),
        student_name=user.full_name,
        admission_number=student.admission_number,
        routine_slot_id=str(slot.id),
        subject_name=subject.name,
        section_name=section.name,
        attendance_date=attendance.attendance_date,
        status=attendance.status,
        marked_by=str(teacher.id),
        marked_by_name=teacher_user.full_name,
        marked_at=attendance.marked_at,
    ).model_dump(mode="json")


def _roster_response(slot, section, subject, attendance_date, window_open, roster) -> dict:
    items = [
        ClassAttendanceRosterItem(
            student_id=str(student.id),
            student_name=user.full_name,
            admission_number=student.admission_number,
            roll_number=enrollment.roll_number,
            status=mark.status if mark else None,
            marked_at=mark.marked_at if mark else None,
        )
        for student, user, enrollment, mark in roster
    ]
    return ClassAttendanceRosterResponse(
        routine_slot_id=str(slot.id),
        section_id=str(section.id),
        section_name=section.name,
        subject_name=subject.name,
        day_of_week=slot.day_of_week.value,
        period_number=slot.period_number,
        start_time=slot.start_time,
        end_time=slot.end_time,
        attendance_date=attendance_date,
        window_open=window_open,
        roster=items,
    ).model_dump(mode="json")


def _combined_response(student, user, daily, slot_rows, marks_by_slot, attendance_date) -> dict:
    periods = []
    for slot_row in slot_rows:
        slot, _section, _class_entity, subject, _teacher, teacher_user, _room = slot_row
        mark = marks_by_slot.get(slot.id)
        periods.append(
            AttendancePeriodEntry(
                routine_slot_id=str(slot.id),
                period_number=slot.period_number,
                subject_name=subject.name,
                teacher_name=teacher_user.full_name,
                start_time=slot.start_time,
                end_time=slot.end_time,
                status=mark.status if mark else None,
                marked_at=mark.marked_at if mark else None,
            )
        )
    return CombinedDailyAttendanceResponse(
        student_id=str(student.id),
        student_name=user.full_name,
        attendance_date=attendance_date,
        entry_time=daily.entry_time if daily else None,
        exit_time=daily.exit_time if daily else None,
        biometric_status=daily.status if daily else None,
        periods=periods,
    ).model_dump(mode="json")


# --- Biometric devices ---------------------------------------------------


@router.post("/devices", dependencies=[Depends(require_permission("attendance.manage"))], status_code=201)
async def create_device(
    payload: CreateBiometricDeviceRequest,
    current_user: CurrentUser = Depends(require_permission("attendance.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.create_device(db, current_user, payload)
    return success_response(data=_device_response(entity), message="Biometric device registered", status_code=201)


@router.get("/devices", dependencies=[Depends(require_permission("attendance.manage"))])
async def list_devices(db: AsyncSession = Depends(get_db_session)):
    entities = await service.list_devices(db)
    return success_response(data=[_device_response(e) for e in entities], message="Biometric devices retrieved")


@router.patch("/devices/{device_id}", dependencies=[Depends(require_permission("attendance.manage"))])
async def update_device(
    device_id: uuid.UUID,
    payload: UpdateBiometricDeviceRequest,
    current_user: CurrentUser = Depends(require_permission("attendance.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.update_device(db, current_user, device_id, payload)
    return success_response(data=_device_response(entity), message="Biometric device updated")


# --- Punch ingestion --------------------------------------------------------


@router.post("/punches", dependencies=[Depends(require_permission("attendance.manage"))], status_code=201)
async def ingest_punch(
    payload: PunchEventRequest,
    current_user: CurrentUser = Depends(require_permission("attendance.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    punch, device = await service.ingest_punch(db, current_user, payload)
    return success_response(data=_punch_response(punch, device), message="Punch event recorded", status_code=201)


# --- Daily (biometric) attendance ------------------------------------------


@router.get("/daily", dependencies=[Depends(require_permission("attendance.view"))])
async def list_daily_attendance(
    user_id: uuid.UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: CurrentUser = Depends(require_permission("attendance.view")),
    db: AsyncSession = Depends(get_db_session),
):
    resolved_to = date_to or date.today()
    resolved_from = date_from or resolved_to
    records = await service.list_daily_attendance(
        db, current_user, user_id=user_id, date_from=resolved_from, date_to=resolved_to
    )
    return success_response(data=[_daily_response(r) for r in records], message="Daily attendance retrieved")


@router.get("/daily/me")
async def get_my_daily_attendance(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    resolved_to = date_to or date.today()
    resolved_from = date_from or (resolved_to - timedelta(days=6))
    records = await service.list_daily_attendance(
        db, current_user, user_id=current_user.id, date_from=resolved_from, date_to=resolved_to
    )
    return success_response(data=[_daily_response(r) for r in records], message="Your attendance record")


# --- Subject-wise class attendance ------------------------------------------


@router.get("/class/roster", dependencies=[Depends(require_permission("attendance.view"))])
async def get_class_roster(
    routine_slot_id: uuid.UUID,
    attendance_date: date = Query(default_factory=date.today),
    current_user: CurrentUser = Depends(require_permission("attendance.view")),
    db: AsyncSession = Depends(get_db_session),
):
    slot, section, subject, resolved_date, window_open, roster = await service.get_class_roster(
        db, current_user, routine_slot_id=routine_slot_id, attendance_date=attendance_date
    )
    data = _roster_response(slot, section, subject, resolved_date, window_open, roster)
    return success_response(data=data, message="Class roster retrieved")


@router.post("/class/mark", dependencies=[Depends(require_permission("attendance.mark"))])
async def mark_class_attendance(
    payload: MarkClassAttendanceRequest,
    current_user: CurrentUser = Depends(require_permission("attendance.mark")),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.mark_class_attendance(db, current_user, payload)
    return success_response(data=[_class_attendance_response(r) for r in records], message="Class attendance marked")


@router.get("/class", dependencies=[Depends(require_permission("attendance.view"))])
async def list_class_attendance(
    attendance_date: date,
    routine_slot_id: uuid.UUID | None = Query(default=None),
    section_id: uuid.UUID | None = Query(default=None),
    current_user: CurrentUser = Depends(require_permission("attendance.view")),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.list_class_attendance(
        db, current_user, attendance_date=attendance_date, routine_slot_id=routine_slot_id, section_id=section_id
    )
    return success_response(data=[_class_attendance_response(r) for r in records], message="Class attendance retrieved")


# --- Combined per-student daily view -----------------------------------


@router.get("/students/{student_id}/daily", dependencies=[Depends(require_permission("attendance.view"))])
async def get_student_combined_daily(
    student_id: uuid.UUID,
    attendance_date: date = Query(default_factory=date.today),
    current_user: CurrentUser = Depends(require_permission("attendance.view")),
    db: AsyncSession = Depends(get_db_session),
):
    student, user, daily, slot_rows, marks_by_slot = await service.get_student_combined_daily(
        db, current_user, student_id, attendance_date
    )
    data = _combined_response(student, user, daily, slot_rows, marks_by_slot, attendance_date)
    return success_response(data=data, message="Combined daily attendance retrieved")
