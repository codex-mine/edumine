import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import Weekday
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.modules.academic import repository as academic_repository
from app.modules.academic.models import AcademicYear, Class, Section
from app.modules.guardians import repository as guardians_repository
from app.modules.routine import repository
from app.modules.routine.repository import RoutineSlotRow
from app.modules.routine.schemas import CreateRoutineSlotRequest, UpdateRoutineSlotRequest
from app.modules.students import repository as students_repository
from app.modules.teachers import repository as teachers_repository

WEEKDAY_ORDER = {day: index for index, day in enumerate(Weekday)}


def _sort_key(row: RoutineSlotRow) -> tuple[int, int]:
    slot = row[0]
    return (WEEKDAY_ORDER[slot.day_of_week], slot.period_number)


def _sorted_rows(rows: list[RoutineSlotRow]) -> list[RoutineSlotRow]:
    return sorted(rows, key=_sort_key)


# --- Shared validation helpers --------------------------------------------


async def _require_active_year_or(db: AsyncSession, academic_year_id: uuid.UUID | None) -> AcademicYear:
    if academic_year_id is not None:
        year = await academic_repository.get_academic_year(db, academic_year_id)
        if year is None:
            raise NotFoundException("Academic year not found")
        return year

    year = await academic_repository.get_active_academic_year(db)
    if year is None:
        raise ValidationException("No active academic year — activate an academic year first")
    return year


async def _require_section(db: AsyncSession, section_id: uuid.UUID) -> tuple[Section, Class]:
    record = await academic_repository.get_section(db, section_id)
    if record is None:
        raise NotFoundException("Section not found")
    section, class_entity, _room, _class_teacher, _class_teacher_user = record
    return section, class_entity


async def _validate_subject_assigned(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID, subject_id: uuid.UUID
) -> None:
    if await academic_repository.get_subject(db, subject_id) is None:
        raise NotFoundException("Subject not found")
    class_subject = await academic_repository.get_class_subject_by_year_class_subject(
        db, academic_year_id=academic_year_id, class_id=class_id, subject_id=subject_id
    )
    if class_subject is None:
        raise ValidationException("This subject is not assigned to this class for this academic year")


async def _validate_teacher_exists(db: AsyncSession, teacher_id: uuid.UUID) -> None:
    if await teachers_repository.get_teacher_by_id(db, teacher_id) is None:
        raise NotFoundException("Teacher not found")


async def _validate_room_exists(db: AsyncSession, room_id: uuid.UUID) -> None:
    if await academic_repository.get_room(db, room_id) is None:
        raise NotFoundException("Room not found")


async def _check_conflicts(
    db: AsyncSession,
    *,
    section_id: uuid.UUID,
    teacher_id: uuid.UUID,
    day_of_week: Weekday,
    period_number: int,
    exclude_slot_id: uuid.UUID | None,
) -> None:
    if await repository.get_section_period_conflict(
        db, section_id=section_id, day_of_week=day_of_week, period_number=period_number, exclude_slot_id=exclude_slot_id
    ) is not None:
        raise ConflictException("This section already has a class scheduled for this day and period")

    teacher_conflict = await repository.get_teacher_period_conflict(
        db, teacher_id=teacher_id, day_of_week=day_of_week, period_number=period_number, exclude_slot_id=exclude_slot_id
    )
    if teacher_conflict is not None:
        conflict_section = teacher_conflict[1]
        raise ConflictException(
            f"This teacher is already scheduled for {conflict_section.name} at this day and period"
        )


# --- CRUD (Admin builder) --------------------------------------------------


async def create_slot(db: AsyncSession, actor: CurrentUser, payload: CreateRoutineSlotRequest) -> RoutineSlotRow:
    year = await _require_active_year_or(db, payload.academic_year_id)
    section, _class_entity = await _require_section(db, payload.section_id)
    if section.academic_year_id != year.id:
        raise ValidationException("The selected section does not belong to the target academic year")

    await _validate_subject_assigned(
        db, academic_year_id=section.academic_year_id, class_id=section.class_id, subject_id=payload.subject_id
    )
    await _validate_teacher_exists(db, payload.teacher_id)
    if payload.room_id is not None:
        await _validate_room_exists(db, payload.room_id)

    await _check_conflicts(
        db,
        section_id=section.id,
        teacher_id=payload.teacher_id,
        day_of_week=payload.day_of_week,
        period_number=payload.period_number,
        exclude_slot_id=None,
    )

    entity = await repository.create_slot(
        db,
        academic_year_id=section.academic_year_id,
        section_id=section.id,
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        room_id=payload.room_id,
        day_of_week=payload.day_of_week,
        period_number=payload.period_number,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="routine_slot", entity_id=entity.id)
    await db.commit()
    return await get_slot(db, entity.id)


async def get_slot(db: AsyncSession, slot_id: uuid.UUID) -> RoutineSlotRow:
    record = await repository.get_slot(db, slot_id)
    if record is None:
        raise NotFoundException("Routine slot not found")
    return record


async def update_slot(
    db: AsyncSession, actor: CurrentUser, slot_id: uuid.UUID, payload: UpdateRoutineSlotRequest
) -> RoutineSlotRow:
    slot, section, _class_entity, _subject, _teacher, _teacher_user, _room = await get_slot(db, slot_id)

    fields: dict = {}

    if payload.subject_id is not None and payload.subject_id != slot.subject_id:
        await _validate_subject_assigned(
            db, academic_year_id=section.academic_year_id, class_id=section.class_id, subject_id=payload.subject_id
        )
        fields["subject_id"] = payload.subject_id

    if payload.teacher_id is not None and payload.teacher_id != slot.teacher_id:
        await _validate_teacher_exists(db, payload.teacher_id)
        fields["teacher_id"] = payload.teacher_id

    if payload.clear_room:
        fields["room_id"] = None
    elif payload.room_id is not None:
        await _validate_room_exists(db, payload.room_id)
        fields["room_id"] = payload.room_id

    if payload.day_of_week is not None:
        fields["day_of_week"] = payload.day_of_week
    if payload.period_number is not None:
        fields["period_number"] = payload.period_number
    if payload.start_time is not None:
        fields["start_time"] = payload.start_time
    if payload.end_time is not None:
        fields["end_time"] = payload.end_time

    resolved_start = fields.get("start_time", slot.start_time)
    resolved_end = fields.get("end_time", slot.end_time)
    if resolved_end <= resolved_start:
        raise ValidationException("end_time must be after start_time")

    if "day_of_week" in fields or "period_number" in fields or "teacher_id" in fields:
        resolved_day = fields.get("day_of_week", slot.day_of_week)
        resolved_period = fields.get("period_number", slot.period_number)
        resolved_teacher_id = fields.get("teacher_id", slot.teacher_id)
        await _check_conflicts(
            db,
            section_id=slot.section_id,
            teacher_id=resolved_teacher_id,
            day_of_week=resolved_day,
            period_number=resolved_period,
            exclude_slot_id=slot.id,
        )

    if fields:
        await repository.update_slot_fields(db, slot, fields)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="update",
        entity_type="routine_slot",
        entity_id=slot_id,
        new_value={k: str(v) for k, v in fields.items()},
    )
    await db.commit()
    return await get_slot(db, slot_id)


async def delete_slot(db: AsyncSession, actor: CurrentUser, slot_id: uuid.UUID) -> None:
    slot = (await get_slot(db, slot_id))[0]
    await repository.delete_slot(db, slot)
    await record_audit_log(db, actor_id=actor.id, action="delete", entity_type="routine_slot", entity_id=slot_id)
    await db.commit()


async def list_slots(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
    teacher_id: uuid.UUID | None,
    day_of_week: Weekday | None,
) -> list[RoutineSlotRow]:
    resolved_year_id = None
    if academic_year_id is not None or section_id is None:
        resolved_year_id = (await _require_active_year_or(db, academic_year_id)).id
    rows = await repository.list_slots(
        db, academic_year_id=resolved_year_id, section_id=section_id, teacher_id=teacher_id, day_of_week=day_of_week
    )
    return _sorted_rows(rows)


# --- Role-scoped views -----------------------------------------------------


async def get_section_routine(
    db: AsyncSession, actor: CurrentUser, section_id: uuid.UUID
) -> tuple[Section, Class, list[RoutineSlotRow]]:
    section, class_entity = await _require_section(db, section_id)

    if actor.role == "student":
        student_record = await students_repository.get_student_by_user_id(db, actor.id)
        if student_record is None:
            raise NotFoundException("Student profile not found")
        student = student_record[0]
        enrollment = await academic_repository.get_enrollment_for_student_year(
            db, student_id=student.id, academic_year_id=section.academic_year_id
        )
        if enrollment is None or enrollment.section_id != section.id:
            raise PermissionDeniedException("You can only view your own section's routine")

    elif actor.role == "guardian":
        guardian_record = await guardians_repository.get_guardian_by_user_id(db, actor.id)
        if guardian_record is None:
            raise NotFoundException("Guardian profile not found")
        guardian = guardian_record[0]
        linked_students = await students_repository.list_students_for_guardian(db, guardian.id)
        allowed = False
        for _link, student, _user in linked_students:
            enrollment = await academic_repository.get_enrollment_for_student_year(
                db, student_id=student.id, academic_year_id=section.academic_year_id
            )
            if enrollment is not None and enrollment.section_id == section.id:
                allowed = True
                break
        if not allowed:
            raise PermissionDeniedException("You can only view a linked child's section routine")

    elif actor.role == "teacher":
        teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
        if teacher_record is None:
            raise NotFoundException("Teacher profile not found")
        teacher = teacher_record[0]
        is_class_teacher = section.class_teacher_id == teacher.id
        teaches_here = await repository.teacher_has_slot_in_section(db, teacher_id=teacher.id, section_id=section.id)
        if not (is_class_teacher or teaches_here):
            raise PermissionDeniedException("You can only view sections you teach")

    # admin/principal: routine.view already gates access; no further scoping.

    rows = await repository.list_slots(
        db, academic_year_id=None, section_id=section.id, teacher_id=None, day_of_week=None
    )
    return section, class_entity, _sorted_rows(rows)


async def get_teacher_own_routine(db: AsyncSession, actor: CurrentUser) -> list[RoutineSlotRow]:
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None:
        raise NotFoundException("Teacher profile not found")
    teacher = teacher_record[0]
    rows = await repository.list_slots(
        db, academic_year_id=None, section_id=None, teacher_id=teacher.id, day_of_week=None
    )
    return _sorted_rows(rows)


StudentRoutineRecord = tuple[object, object, Section, Class, list[RoutineSlotRow]]


async def get_student_own_routine(db: AsyncSession, actor: CurrentUser) -> StudentRoutineRecord:
    student_record = await students_repository.get_student_by_user_id(db, actor.id)
    if student_record is None:
        raise NotFoundException("Student profile not found")
    student, user = student_record

    year = await academic_repository.get_active_academic_year(db)
    if year is None:
        raise ValidationException("No active academic year — activate an academic year first")

    enrollment = await academic_repository.get_enrollment_for_student_year(
        db, student_id=student.id, academic_year_id=year.id
    )
    if enrollment is None:
        raise NotFoundException("You are not enrolled in a section for the active academic year")

    section, class_entity = await _require_section(db, enrollment.section_id)
    rows = await repository.list_slots(
        db, academic_year_id=None, section_id=section.id, teacher_id=None, day_of_week=None
    )
    return student, user, section, class_entity, _sorted_rows(rows)


async def get_guardian_routine(db: AsyncSession, actor: CurrentUser) -> list[StudentRoutineRecord]:
    guardian_record = await guardians_repository.get_guardian_by_user_id(db, actor.id)
    if guardian_record is None:
        raise NotFoundException("Guardian profile not found")
    guardian = guardian_record[0]

    year = await academic_repository.get_active_academic_year(db)
    linked_students = await students_repository.list_students_for_guardian(db, guardian.id)

    results: list[StudentRoutineRecord] = []
    if year is None:
        return results

    for _link, student, user in linked_students:
        enrollment = await academic_repository.get_enrollment_for_student_year(
            db, student_id=student.id, academic_year_id=year.id
        )
        if enrollment is None:
            continue
        section, class_entity = await _require_section(db, enrollment.section_id)
        rows = await repository.list_slots(
            db, academic_year_id=None, section_id=section.id, teacher_id=None, day_of_week=None
        )
        results.append((student, user, section, class_entity, _sorted_rows(rows)))

    return results
