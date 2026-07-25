import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.common.enums import AttendanceStatus
from app.modules.academic.models import Section, Subject
from app.modules.attendance.models import AttendancePunch, BiometricDevice, ClassAttendance, DailyAttendance
from app.modules.auth.models import Role, User
from app.modules.routine.models import RoutineSlot
from app.modules.students.models import Student
from app.modules.teachers.models import Teacher

# --- Users (local lookup — avoids adding an auth-module dependency for a single query) --


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# --- Biometric devices ---------------------------------------------------


async def get_device_by_serial(db: AsyncSession, device_serial: str) -> BiometricDevice | None:
    result = await db.execute(select(BiometricDevice).where(BiometricDevice.device_serial == device_serial))
    return result.scalar_one_or_none()


async def get_device(db: AsyncSession, device_id: uuid.UUID) -> BiometricDevice | None:
    result = await db.execute(select(BiometricDevice).where(BiometricDevice.id == device_id))
    return result.scalar_one_or_none()


async def create_device(db: AsyncSession, *, device_serial: str, location: str | None) -> BiometricDevice:
    entity = BiometricDevice(device_serial=device_serial, location=location)
    db.add(entity)
    await db.flush()
    return entity


async def list_devices(db: AsyncSession) -> list[BiometricDevice]:
    result = await db.execute(select(BiometricDevice).order_by(BiometricDevice.device_serial.asc()))
    return list(result.scalars().all())


async def update_device_fields(db: AsyncSession, entity: BiometricDevice, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


# --- Raw punches ------------------------------------------------------------


async def create_punch(
    db: AsyncSession, *, user_id: uuid.UUID, device_id: uuid.UUID, punched_at: datetime, raw_payload: dict | None
) -> AttendancePunch:
    entity = AttendancePunch(user_id=user_id, device_id=device_id, punched_at=punched_at, raw_payload=raw_payload)
    db.add(entity)
    await db.flush()
    return entity


async def list_punch_times_for_day(db: AsyncSession, *, user_id: uuid.UUID, day: date) -> list[datetime]:
    day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    result = await db.execute(
        select(AttendancePunch.punched_at)
        .where(
            AttendancePunch.user_id == user_id,
            AttendancePunch.punched_at >= day_start,
            AttendancePunch.punched_at < day_end,
        )
        .order_by(AttendancePunch.punched_at.asc())
    )
    return [row[0] for row in result.all()]


# --- Daily (biometric) attendance ------------------------------------------


async def get_daily_attendance(db: AsyncSession, *, user_id: uuid.UUID, attendance_date: date) -> DailyAttendance | None:
    result = await db.execute(
        select(DailyAttendance).where(
            DailyAttendance.user_id == user_id, DailyAttendance.attendance_date == attendance_date
        )
    )
    return result.scalar_one_or_none()


async def upsert_daily_attendance(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    attendance_date: date,
    entry_time: datetime | None,
    exit_time: datetime | None,
    status: AttendanceStatus,
) -> DailyAttendance:
    entity = await get_daily_attendance(db, user_id=user_id, attendance_date=attendance_date)
    if entity is None:
        entity = DailyAttendance(
            user_id=user_id,
            attendance_date=attendance_date,
            entry_time=entry_time,
            exit_time=exit_time,
            status=status,
        )
        db.add(entity)
    else:
        entity.entry_time = entry_time
        entity.exit_time = exit_time
        entity.status = status
    await db.flush()
    return entity


DailyAttendanceRow = tuple[DailyAttendance, User, str]


def _daily_select():
    return select(DailyAttendance, User, Role.name).join(User, User.id == DailyAttendance.user_id).join(
        Role, Role.id == User.role_id
    )


async def list_daily_attendance(
    db: AsyncSession, *, user_id: uuid.UUID | None, date_from: date, date_to: date
) -> list[DailyAttendanceRow]:
    filters = [DailyAttendance.attendance_date >= date_from, DailyAttendance.attendance_date <= date_to]
    if user_id is not None:
        filters.append(DailyAttendance.user_id == user_id)
    result = await db.execute(
        _daily_select().where(*filters).order_by(DailyAttendance.attendance_date.desc(), User.full_name.asc())
    )
    return list(result.all())


# --- Subject-wise class attendance ------------------------------------------


async def get_class_attendance(
    db: AsyncSession, *, student_id: uuid.UUID, routine_slot_id: uuid.UUID, attendance_date: date
) -> ClassAttendance | None:
    result = await db.execute(
        select(ClassAttendance).where(
            ClassAttendance.student_id == student_id,
            ClassAttendance.routine_slot_id == routine_slot_id,
            ClassAttendance.attendance_date == attendance_date,
        )
    )
    return result.scalar_one_or_none()


async def upsert_class_attendance(
    db: AsyncSession,
    *,
    student_id: uuid.UUID,
    routine_slot_id: uuid.UUID,
    attendance_date: date,
    status: AttendanceStatus,
    marked_by: uuid.UUID,
) -> ClassAttendance:
    entity = await get_class_attendance(
        db, student_id=student_id, routine_slot_id=routine_slot_id, attendance_date=attendance_date
    )
    if entity is None:
        entity = ClassAttendance(
            student_id=student_id,
            routine_slot_id=routine_slot_id,
            attendance_date=attendance_date,
            status=status,
            marked_by=marked_by,
        )
        db.add(entity)
    else:
        entity.status = status
        entity.marked_by = marked_by
        entity.marked_at = datetime.now(timezone.utc)
    await db.flush()
    return entity


async def map_class_attendance_for_slot_date(
    db: AsyncSession, *, routine_slot_id: uuid.UUID, attendance_date: date
) -> dict[uuid.UUID, ClassAttendance]:
    result = await db.execute(
        select(ClassAttendance).where(
            ClassAttendance.routine_slot_id == routine_slot_id, ClassAttendance.attendance_date == attendance_date
        )
    )
    return {row.student_id: row for row in result.scalars().all()}


TeacherUserAlias = aliased(User)

ClassAttendanceRow = tuple[ClassAttendance, Student, User, RoutineSlot, Section, Subject, Teacher, User]


def _class_attendance_select():
    return (
        select(ClassAttendance, Student, User, RoutineSlot, Section, Subject, Teacher, TeacherUserAlias)
        .join(Student, Student.id == ClassAttendance.student_id)
        .join(User, User.id == Student.user_id)
        .join(RoutineSlot, RoutineSlot.id == ClassAttendance.routine_slot_id)
        .join(Section, Section.id == RoutineSlot.section_id)
        .join(Subject, Subject.id == RoutineSlot.subject_id)
        .join(Teacher, Teacher.id == ClassAttendance.marked_by)
        .join(TeacherUserAlias, TeacherUserAlias.id == Teacher.user_id)
    )


async def list_class_attendance(
    db: AsyncSession,
    *,
    attendance_date: date,
    routine_slot_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
) -> list[ClassAttendanceRow]:
    filters = [ClassAttendance.attendance_date == attendance_date]
    if routine_slot_id is not None:
        filters.append(ClassAttendance.routine_slot_id == routine_slot_id)
    if section_id is not None:
        filters.append(RoutineSlot.section_id == section_id)
    result = await db.execute(
        _class_attendance_select().where(*filters).order_by(RoutineSlot.period_number.asc(), User.full_name.asc())
    )
    return list(result.all())
