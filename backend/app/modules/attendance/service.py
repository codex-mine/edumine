import uuid
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import AttendanceStatus, Weekday
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.modules.academic import repository as academic_repository
from app.modules.attendance import repository
from app.modules.attendance.models import BiometricDevice
from app.modules.attendance.repository import ClassAttendanceRow, DailyAttendanceRow
from app.modules.attendance.schemas import (
    CreateBiometricDeviceRequest,
    MarkClassAttendanceRequest,
    PunchEventRequest,
    UpdateBiometricDeviceRequest,
)
from app.modules.guardians import repository as guardians_repository
from app.modules.routine import repository as routine_repository
from app.modules.routine.repository import RoutineSlotRow
from app.modules.students import repository as students_repository
from app.modules.teachers import repository as teachers_repository

WEEKDAY_BY_INDEX = list(Weekday)


def _weekday_for(day: date) -> Weekday:
    return WEEKDAY_BY_INDEX[day.weekday()]


# --- Biometric devices ---------------------------------------------------


async def create_device(db: AsyncSession, actor: CurrentUser, payload: CreateBiometricDeviceRequest) -> BiometricDevice:
    if await repository.get_device_by_serial(db, payload.device_serial) is not None:
        raise ConflictException("A device with this serial is already registered")
    entity = await repository.create_device(db, device_serial=payload.device_serial, location=payload.location)
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="biometric_device", entity_id=entity.id)
    await db.commit()
    return entity


async def list_devices(db: AsyncSession) -> list[BiometricDevice]:
    return await repository.list_devices(db)


async def get_device(db: AsyncSession, device_id: uuid.UUID) -> BiometricDevice:
    entity = await repository.get_device(db, device_id)
    if entity is None:
        raise NotFoundException("Biometric device not found")
    return entity


async def update_device(
    db: AsyncSession, actor: CurrentUser, device_id: uuid.UUID, payload: UpdateBiometricDeviceRequest
) -> BiometricDevice:
    entity = await get_device(db, device_id)
    fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if fields:
        await repository.update_device_fields(db, entity, fields)
    await record_audit_log(
        db, actor_id=actor.id, action="update", entity_type="biometric_device", entity_id=device_id, new_value=fields
    )
    await db.commit()
    return entity


# --- Punch ingestion --------------------------------------------------------


async def _recompute_daily_attendance(db: AsyncSession, *, user_id: uuid.UUID, day: date) -> None:
    punch_times = await repository.list_punch_times_for_day(db, user_id=user_id, day=day)
    if not punch_times:
        return
    entry_time = punch_times[0]
    exit_time = punch_times[-1] if len(punch_times) > 1 else None
    await repository.upsert_daily_attendance(
        db, user_id=user_id, attendance_date=day, entry_time=entry_time, exit_time=exit_time, status=AttendanceStatus.present
    )


async def ingest_punch(db: AsyncSession, actor: CurrentUser, payload: PunchEventRequest):
    device = await repository.get_device_by_serial(db, payload.device_serial)
    if device is None:
        raise NotFoundException("Biometric device not registered")
    if not device.is_active:
        raise ValidationException("This biometric device is deactivated")

    user = await repository.get_user_by_id(db, payload.user_id)
    if user is None or user.deleted_at is not None:
        raise NotFoundException("User not found")

    punch = await repository.create_punch(
        db, user_id=user.id, device_id=device.id, punched_at=payload.punched_at, raw_payload=payload.raw_payload
    )
    await _recompute_daily_attendance(db, user_id=user.id, day=payload.punched_at.date())
    await record_audit_log(
        db, actor_id=actor.id, action="create", entity_type="attendance_punch", entity_id=punch.id
    )
    await db.commit()
    return punch, device


# --- Daily (biometric) attendance ------------------------------------------


async def list_daily_attendance(
    db: AsyncSession, actor: CurrentUser, *, user_id: uuid.UUID | None, date_from: date, date_to: date
) -> list[DailyAttendanceRow]:
    if actor.role not in ("admin", "principal"):
        if user_id is not None and user_id != actor.id:
            raise PermissionDeniedException("You can only view your own attendance record")
        user_id = actor.id
    return await repository.list_daily_attendance(db, user_id=user_id, date_from=date_from, date_to=date_to)


# --- Subject-wise class attendance ------------------------------------------


async def _get_slot_or_404(db: AsyncSession, routine_slot_id: uuid.UUID) -> RoutineSlotRow:
    record = await routine_repository.get_slot(db, routine_slot_id)
    if record is None:
        raise NotFoundException("Routine slot not found")
    return record


async def _assert_teacher_owns_slot(db: AsyncSession, actor: CurrentUser, teacher_id: uuid.UUID) -> None:
    if actor.role in ("admin", "principal"):
        return
    if actor.role == "teacher":
        teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
        if teacher_record is None or teacher_record[0].id != teacher_id:
            raise PermissionDeniedException("You can only manage attendance for your own scheduled classes")
        return
    raise PermissionDeniedException("You do not have access to this class's attendance")


def _assert_within_class_window(slot, attendance_date: date) -> None:
    if attendance_date != date.today():
        raise ValidationException("Attendance can only be marked for the current date")
    if slot.day_of_week != _weekday_for(attendance_date):
        raise ValidationException("This routine slot is not scheduled on the given date's weekday")
    now = datetime.now().time()
    if now < slot.start_time:
        raise ValidationException("The attendance window for this class has not opened yet")
    if now > slot.end_time:
        raise ValidationException("The attendance window for this class has closed")


async def get_class_roster(db: AsyncSession, actor: CurrentUser, *, routine_slot_id: uuid.UUID, attendance_date: date):
    slot, section, class_entity, subject, teacher, teacher_user, room = await _get_slot_or_404(db, routine_slot_id)
    await _assert_teacher_owns_slot(db, actor, slot.teacher_id)

    enrollments = await academic_repository.list_enrollments(
        db, academic_year_id=None, section_id=section.id, student_id=None
    )
    marks = await repository.map_class_attendance_for_slot_date(
        db, routine_slot_id=routine_slot_id, attendance_date=attendance_date
    )

    window_open = True
    try:
        _assert_within_class_window(slot, attendance_date)
    except ValidationException:
        window_open = False

    roster = []
    for enrollment, student, user, _year, _section, _class in enrollments:
        mark = marks.get(student.id)
        roster.append((student, user, enrollment, mark))

    return slot, section, subject, attendance_date, window_open, roster


async def mark_class_attendance(db: AsyncSession, actor: CurrentUser, payload: MarkClassAttendanceRequest) -> list[ClassAttendanceRow]:
    slot, section, class_entity, subject, teacher, teacher_user, room = await _get_slot_or_404(db, payload.routine_slot_id)
    await _assert_teacher_owns_slot(db, actor, slot.teacher_id)
    _assert_within_class_window(slot, payload.attendance_date)

    marker_teacher_id = teacher.id
    if actor.role in ("admin", "principal"):
        actor_teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
        if actor_teacher_record is not None:
            marker_teacher_id = actor_teacher_record[0].id

    enrolled_student_ids = {
        enrollment.student_id
        for enrollment, _student, _user, _year, _section, _class in await academic_repository.list_enrollments(
            db, academic_year_id=None, section_id=section.id, student_id=None
        )
    }

    for item in payload.items:
        if item.student_id not in enrolled_student_ids:
            raise ValidationException(f"Student {item.student_id} is not enrolled in this section")

    for item in payload.items:
        await repository.upsert_class_attendance(
            db,
            student_id=item.student_id,
            routine_slot_id=slot.id,
            attendance_date=payload.attendance_date,
            status=item.status,
            marked_by=marker_teacher_id,
        )

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="mark",
        entity_type="class_attendance",
        entity_id=slot.id,
        new_value={"attendance_date": str(payload.attendance_date), "count": len(payload.items)},
    )
    await db.commit()

    return await repository.list_class_attendance(
        db, attendance_date=payload.attendance_date, routine_slot_id=slot.id, section_id=None
    )


async def list_class_attendance(
    db: AsyncSession,
    actor: CurrentUser,
    *,
    attendance_date: date,
    routine_slot_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
) -> list[ClassAttendanceRow]:
    if routine_slot_id is not None:
        slot_row = await _get_slot_or_404(db, routine_slot_id)
        await _assert_teacher_owns_slot(db, actor, slot_row[0].teacher_id)
    elif actor.role not in ("admin", "principal"):
        raise ValidationException("routine_slot_id is required")

    return await repository.list_class_attendance(
        db, attendance_date=attendance_date, routine_slot_id=routine_slot_id, section_id=section_id
    )


# --- Combined per-student daily view -----------------------------------


CombinedRecord = tuple[object, object, object, list[RoutineSlotRow], dict]


async def get_student_combined_daily(
    db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, attendance_date: date
):
    student_record = await students_repository.get_student_by_id(db, student_id)
    if student_record is None:
        raise NotFoundException("Student not found")
    student, user = student_record

    if actor.role == "student":
        self_record = await students_repository.get_student_by_user_id(db, actor.id)
        if self_record is None or self_record[0].id != student.id:
            raise PermissionDeniedException("You can only view your own attendance record")
    elif actor.role == "guardian":
        guardian_record = await guardians_repository.get_guardian_by_user_id(db, actor.id)
        if guardian_record is None:
            raise NotFoundException("Guardian profile not found")
        linked = await students_repository.list_students_for_guardian(db, guardian_record[0].id)
        if not any(linked_student.id == student.id for _link, linked_student, _u in linked):
            raise PermissionDeniedException("You can only view a linked child's attendance record")
    elif actor.role not in ("admin", "principal"):
        raise PermissionDeniedException("You do not have access to this student's attendance record")

    daily = await repository.get_daily_attendance(db, user_id=user.id, attendance_date=attendance_date)

    slot_rows: list[RoutineSlotRow] = []
    year = await academic_repository.get_active_academic_year(db)
    if year is not None:
        enrollment = await academic_repository.get_enrollment_for_student_year(
            db, student_id=student.id, academic_year_id=year.id
        )
        if enrollment is not None:
            weekday = _weekday_for(attendance_date)
            slot_rows = await routine_repository.list_slots(
                db, academic_year_id=None, section_id=enrollment.section_id, teacher_id=None, day_of_week=weekday
            )
            slot_rows.sort(key=lambda row: row[0].period_number)

    marks_by_slot: dict[uuid.UUID, object] = {}
    for slot_row in slot_rows:
        slot = slot_row[0]
        mark = await repository.get_class_attendance(
            db, student_id=student.id, routine_slot_id=slot.id, attendance_date=attendance_date
        )
        if mark is not None:
            marks_by_slot[slot.id] = mark

    return student, user, daily, slot_rows, marks_by_slot
