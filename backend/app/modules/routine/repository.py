import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import Weekday
from app.modules.academic.models import Class, Room, Section, Subject
from app.modules.auth.models import User
from app.modules.routine.models import RoutineSlot
from app.modules.teachers.models import Teacher

RoutineSlotRow = tuple[RoutineSlot, Section, Class, Subject, Teacher, User, Room | None]


def _slot_select():
    return (
        select(RoutineSlot, Section, Class, Subject, Teacher, User, Room)
        .join(Section, Section.id == RoutineSlot.section_id)
        .join(Class, Class.id == Section.class_id)
        .join(Subject, Subject.id == RoutineSlot.subject_id)
        .join(Teacher, Teacher.id == RoutineSlot.teacher_id)
        .join(User, User.id == Teacher.user_id)
        .outerjoin(Room, Room.id == RoutineSlot.room_id)
    )


async def get_slot(db: AsyncSession, slot_id: uuid.UUID) -> RoutineSlotRow | None:
    result = await db.execute(_slot_select().where(RoutineSlot.id == slot_id))
    return result.first()


async def get_section_period_conflict(
    db: AsyncSession,
    *,
    section_id: uuid.UUID,
    day_of_week: Weekday,
    period_number: int,
    exclude_slot_id: uuid.UUID | None = None,
) -> RoutineSlot | None:
    filters = [
        RoutineSlot.section_id == section_id,
        RoutineSlot.day_of_week == day_of_week,
        RoutineSlot.period_number == period_number,
    ]
    if exclude_slot_id is not None:
        filters.append(RoutineSlot.id != exclude_slot_id)
    result = await db.execute(select(RoutineSlot).where(*filters))
    return result.scalar_one_or_none()


async def get_teacher_period_conflict(
    db: AsyncSession,
    *,
    teacher_id: uuid.UUID,
    day_of_week: Weekday,
    period_number: int,
    exclude_slot_id: uuid.UUID | None = None,
) -> RoutineSlotRow | None:
    filters = [
        RoutineSlot.teacher_id == teacher_id,
        RoutineSlot.day_of_week == day_of_week,
        RoutineSlot.period_number == period_number,
    ]
    if exclude_slot_id is not None:
        filters.append(RoutineSlot.id != exclude_slot_id)
    result = await db.execute(_slot_select().where(*filters))
    return result.first()


async def teacher_has_slot_in_section(db: AsyncSession, *, teacher_id: uuid.UUID, section_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(RoutineSlot.id)
        .where(RoutineSlot.teacher_id == teacher_id, RoutineSlot.section_id == section_id)
        .limit(1)
    )
    return result.first() is not None


async def create_slot(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID,
    section_id: uuid.UUID,
    subject_id: uuid.UUID,
    teacher_id: uuid.UUID,
    room_id: uuid.UUID | None,
    day_of_week: Weekday,
    period_number: int,
    start_time,
    end_time,
) -> RoutineSlot:
    entity = RoutineSlot(
        academic_year_id=academic_year_id,
        section_id=section_id,
        subject_id=subject_id,
        teacher_id=teacher_id,
        room_id=room_id,
        day_of_week=day_of_week,
        period_number=period_number,
        start_time=start_time,
        end_time=end_time,
    )
    db.add(entity)
    await db.flush()
    return entity


async def update_slot_fields(db: AsyncSession, entity: RoutineSlot, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def delete_slot(db: AsyncSession, entity: RoutineSlot) -> None:
    await db.delete(entity)
    await db.flush()


async def list_slots(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
    teacher_id: uuid.UUID | None,
    day_of_week: Weekday | None,
) -> list[RoutineSlotRow]:
    filters = []
    if academic_year_id is not None:
        filters.append(RoutineSlot.academic_year_id == academic_year_id)
    if section_id is not None:
        filters.append(RoutineSlot.section_id == section_id)
    if teacher_id is not None:
        filters.append(RoutineSlot.teacher_id == teacher_id)
    if day_of_week is not None:
        filters.append(RoutineSlot.day_of_week == day_of_week)
    result = await db.execute(_slot_select().where(*filters))
    return list(result.all())
