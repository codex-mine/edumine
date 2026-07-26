import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import EnrollmentStatus
from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.modules.academic import repository
from app.modules.academic.models import AcademicYear, Class, Room, Section, StudentEnrollment, Subject
from app.modules.academic.repository import ClassSubjectRow, EnrollmentRow, SectionRow
from app.modules.academic.schemas import (
    CreateAcademicYearRequest,
    CreateClassRequest,
    CreateClassSubjectRequest,
    CreateRoomRequest,
    CreateSectionRequest,
    CreateSubjectRequest,
    EnrollStudentRequest,
    PromotionItem,
    PromotionOutcome,
    PromoteStudentsRequest,
    UpdateClassRequest,
    UpdateClassSubjectRequest,
    UpdateEnrollmentRequest,
    UpdateRoomRequest,
    UpdateSectionRequest,
    UpdateSubjectRequest,
)
from app.modules.routine.models import RoutineSlot
from app.modules.students import repository as students_repository
from app.modules.teachers import repository as teachers_repository


# --- Academic Years -------------------------------------------------------


async def _require_active_year_or(db: AsyncSession, academic_year_id: uuid.UUID | None) -> AcademicYear:
    if academic_year_id is not None:
        year = await repository.get_academic_year(db, academic_year_id)
        if year is None:
            raise NotFoundException("Academic year not found")
        return year

    year = await repository.get_active_academic_year(db)
    if year is None:
        raise ValidationException("No active academic year — activate an academic year first")
    return year


async def _clone_year_structure(db: AsyncSession, *, source_year_id: uuid.UUID, target_year_id: uuid.UUID) -> None:
    section_id_map: dict[uuid.UUID, uuid.UUID] = {}

    for section in await repository.list_sections_for_year(db, source_year_id):
        new_section = await repository.create_section(
            db,
            academic_year_id=target_year_id,
            class_id=section.class_id,
            room_id=section.room_id,
            name=section.name,
            capacity=section.capacity,
            class_teacher_id=section.class_teacher_id,
        )
        section_id_map[section.id] = new_section.id

    for class_subject in await repository.list_class_subjects_for_year(db, source_year_id):
        await repository.create_class_subject(
            db,
            academic_year_id=target_year_id,
            class_id=class_subject.class_id,
            subject_id=class_subject.subject_id,
            teacher_id=class_subject.teacher_id,
            full_marks=class_subject.full_marks,
        )

    for slot in await repository.list_routine_slots_for_year(db, source_year_id):
        new_section_id = section_id_map.get(slot.section_id)
        if new_section_id is None:
            continue
        db.add(
            RoutineSlot(
                academic_year_id=target_year_id,
                section_id=new_section_id,
                subject_id=slot.subject_id,
                teacher_id=slot.teacher_id,
                room_id=slot.room_id,
                day_of_week=slot.day_of_week,
                period_number=slot.period_number,
                start_time=slot.start_time,
                end_time=slot.end_time,
            )
        )
    await db.flush()


async def create_academic_year(
    db: AsyncSession, actor: CurrentUser, payload: CreateAcademicYearRequest
) -> AcademicYear:
    if await repository.get_academic_year_by_name(db, payload.name) is not None:
        raise ConflictException("An academic year with this name already exists")

    source_year = None
    if payload.clone_from_year_id is not None:
        source_year = await repository.get_academic_year(db, payload.clone_from_year_id)
        if source_year is None:
            raise NotFoundException("Source academic year to clone from was not found")

    year = await repository.create_academic_year(
        db,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        cloned_from_year_id=payload.clone_from_year_id,
    )

    if source_year is not None:
        await _clone_year_structure(db, source_year_id=source_year.id, target_year_id=year.id)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create",
        entity_type="academic_year",
        entity_id=year.id,
        new_value={"name": payload.name, "cloned_from_year_id": str(payload.clone_from_year_id) if payload.clone_from_year_id else None},
    )
    await db.commit()
    return year


async def list_academic_years(db: AsyncSession) -> list[AcademicYear]:
    return await repository.list_academic_years(db)


async def get_academic_year(db: AsyncSession, year_id: uuid.UUID) -> AcademicYear:
    year = await repository.get_academic_year(db, year_id)
    if year is None:
        raise NotFoundException("Academic year not found")
    return year


async def get_active_academic_year(db: AsyncSession) -> AcademicYear:
    year = await repository.get_active_academic_year(db)
    if year is None:
        raise NotFoundException("No academic year is currently active")
    return year


async def activate_academic_year(db: AsyncSession, actor: CurrentUser, year_id: uuid.UUID) -> AcademicYear:
    year = await get_academic_year(db, year_id)
    if not year.is_active:
        await repository.deactivate_all_academic_years(db)
        await repository.set_academic_year_active(db, year)
        await record_audit_log(
            db, actor_id=actor.id, action="activate", entity_type="academic_year", entity_id=year.id
        )
        await db.commit()
    return year


# --- Classes ----------------------------------------------------------------


async def create_class(db: AsyncSession, actor: CurrentUser, payload: CreateClassRequest) -> Class:
    if await repository.get_class_by_name(db, payload.name) is not None:
        raise ConflictException("A class with this name already exists")
    entity = await repository.create_class(db, name=payload.name, numeric_order=payload.numeric_order)
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="class", entity_id=entity.id)
    await db.commit()
    return entity


async def list_classes(db: AsyncSession, *, search: str | None) -> list[Class]:
    return await repository.list_classes(db, search=search)


async def get_class(db: AsyncSession, class_id: uuid.UUID) -> Class:
    entity = await repository.get_class(db, class_id)
    if entity is None:
        raise NotFoundException("Class not found")
    return entity


async def update_class(db: AsyncSession, actor: CurrentUser, class_id: uuid.UUID, payload: UpdateClassRequest) -> Class:
    entity = await get_class(db, class_id)
    if payload.name is not None and payload.name != entity.name:
        if await repository.get_class_by_name(db, payload.name) is not None:
            raise ConflictException("A class with this name already exists")
    fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if fields:
        await repository.update_class_fields(db, entity, fields)
    await record_audit_log(db, actor_id=actor.id, action="update", entity_type="class", entity_id=class_id, new_value=fields)
    await db.commit()
    return entity


async def soft_delete_class(db: AsyncSession, actor: CurrentUser, class_id: uuid.UUID) -> None:
    entity = await get_class(db, class_id)
    await repository.soft_delete_class(db, entity)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="class", entity_id=class_id)
    await db.commit()


# --- Rooms --------------------------------------------------------------


async def create_room(db: AsyncSession, actor: CurrentUser, payload: CreateRoomRequest) -> Room:
    if await repository.get_room_by_name(db, payload.name) is not None:
        raise ConflictException("A room with this name already exists")
    entity = await repository.create_room(db, name=payload.name, capacity=payload.capacity)
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="room", entity_id=entity.id)
    await db.commit()
    return entity


async def list_rooms(db: AsyncSession, *, search: str | None) -> list[Room]:
    return await repository.list_rooms(db, search=search)


async def get_room(db: AsyncSession, room_id: uuid.UUID) -> Room:
    entity = await repository.get_room(db, room_id)
    if entity is None:
        raise NotFoundException("Room not found")
    return entity


async def update_room(db: AsyncSession, actor: CurrentUser, room_id: uuid.UUID, payload: UpdateRoomRequest) -> Room:
    entity = await get_room(db, room_id)
    if payload.name is not None and payload.name != entity.name:
        if await repository.get_room_by_name(db, payload.name) is not None:
            raise ConflictException("A room with this name already exists")
    fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if fields:
        await repository.update_room_fields(db, entity, fields)
    await record_audit_log(db, actor_id=actor.id, action="update", entity_type="room", entity_id=room_id, new_value=fields)
    await db.commit()
    return entity


async def soft_delete_room(db: AsyncSession, actor: CurrentUser, room_id: uuid.UUID) -> None:
    entity = await get_room(db, room_id)
    await repository.soft_delete_room(db, entity)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="room", entity_id=room_id)
    await db.commit()


# --- Subjects -----------------------------------------------------------


async def create_subject(db: AsyncSession, actor: CurrentUser, payload: CreateSubjectRequest) -> Subject:
    if await repository.get_subject_by_name(db, payload.name) is not None:
        raise ConflictException("A subject with this name already exists")
    if await repository.get_subject_by_code(db, payload.code) is not None:
        raise ConflictException("A subject with this code already exists")
    entity = await repository.create_subject(db, name=payload.name, code=payload.code)
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="subject", entity_id=entity.id)
    await db.commit()
    return entity


async def list_subjects(db: AsyncSession, *, search: str | None) -> list[Subject]:
    return await repository.list_subjects(db, search=search)


async def get_subject(db: AsyncSession, subject_id: uuid.UUID) -> Subject:
    entity = await repository.get_subject(db, subject_id)
    if entity is None:
        raise NotFoundException("Subject not found")
    return entity


async def update_subject(
    db: AsyncSession, actor: CurrentUser, subject_id: uuid.UUID, payload: UpdateSubjectRequest
) -> Subject:
    entity = await get_subject(db, subject_id)
    if payload.name is not None and payload.name != entity.name:
        if await repository.get_subject_by_name(db, payload.name) is not None:
            raise ConflictException("A subject with this name already exists")
    if payload.code is not None and payload.code != entity.code:
        if await repository.get_subject_by_code(db, payload.code) is not None:
            raise ConflictException("A subject with this code already exists")
    fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if fields:
        await repository.update_subject_fields(db, entity, fields)
    await record_audit_log(db, actor_id=actor.id, action="update", entity_type="subject", entity_id=subject_id, new_value=fields)
    await db.commit()
    return entity


async def soft_delete_subject(db: AsyncSession, actor: CurrentUser, subject_id: uuid.UUID) -> None:
    entity = await get_subject(db, subject_id)
    await repository.soft_delete_subject(db, entity)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="subject", entity_id=subject_id)
    await db.commit()


# --- Sections -----------------------------------------------------------


async def _validate_teacher_exists(db: AsyncSession, teacher_id: uuid.UUID) -> None:
    record = await teachers_repository.get_teacher_by_id(db, teacher_id)
    if record is None:
        raise NotFoundException("Teacher not found")


async def create_section(db: AsyncSession, actor: CurrentUser, payload: CreateSectionRequest) -> Section:
    year = await _require_active_year_or(db, payload.academic_year_id)

    class_entity = await get_class(db, payload.class_id)
    if payload.room_id is not None:
        await get_room(db, payload.room_id)
    if payload.class_teacher_id is not None:
        await _validate_teacher_exists(db, payload.class_teacher_id)

    if await repository.get_section_by_year_class_name(
        db, academic_year_id=year.id, class_id=class_entity.id, name=payload.name
    ) is not None:
        raise ConflictException("A section with this name already exists for this class in this academic year")

    entity = await repository.create_section(
        db,
        academic_year_id=year.id,
        class_id=class_entity.id,
        room_id=payload.room_id,
        name=payload.name,
        capacity=payload.capacity,
        class_teacher_id=payload.class_teacher_id,
    )
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="section", entity_id=entity.id)
    await db.commit()
    return entity


async def list_sections(
    db: AsyncSession, *, academic_year_id: uuid.UUID | None, class_id: uuid.UUID | None
) -> list[SectionRow]:
    year = await _require_active_year_or(db, academic_year_id)
    return await repository.list_sections(db, academic_year_id=year.id, class_id=class_id)


async def get_section(db: AsyncSession, section_id: uuid.UUID) -> SectionRow:
    record = await repository.get_section(db, section_id)
    if record is None:
        raise NotFoundException("Section not found")
    return record


async def update_section(
    db: AsyncSession, actor: CurrentUser, section_id: uuid.UUID, payload: UpdateSectionRequest
) -> SectionRow:
    section, _, _, _, _ = await get_section(db, section_id)

    fields: dict = {}
    if payload.clear_room:
        fields["room_id"] = None
    elif payload.room_id is not None:
        await get_room(db, payload.room_id)
        fields["room_id"] = payload.room_id

    if payload.clear_class_teacher:
        fields["class_teacher_id"] = None
    elif payload.class_teacher_id is not None:
        await _validate_teacher_exists(db, payload.class_teacher_id)
        fields["class_teacher_id"] = payload.class_teacher_id

    if payload.name is not None and payload.name != section.name:
        if await repository.get_section_by_year_class_name(
            db, academic_year_id=section.academic_year_id, class_id=section.class_id, name=payload.name
        ) is not None:
            raise ConflictException("A section with this name already exists for this class in this academic year")
        fields["name"] = payload.name

    if payload.capacity is not None:
        fields["capacity"] = payload.capacity

    if fields:
        await repository.update_section_fields(db, section, fields)

    await record_audit_log(db, actor_id=actor.id, action="update", entity_type="section", entity_id=section_id, new_value=fields)
    await db.commit()
    return await get_section(db, section_id)


async def soft_delete_section(db: AsyncSession, actor: CurrentUser, section_id: uuid.UUID) -> None:
    section, _, _, _, _ = await get_section(db, section_id)
    await repository.soft_delete_section(db, section)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="section", entity_id=section_id)
    await db.commit()


# --- Class-Subject-Teacher assignment ------------------------------------


async def create_class_subject(
    db: AsyncSession, actor: CurrentUser, payload: CreateClassSubjectRequest
) -> ClassSubjectRow:
    year = await _require_active_year_or(db, payload.academic_year_id)
    class_entity = await get_class(db, payload.class_id)
    subject_entity = await get_subject(db, payload.subject_id)
    if payload.teacher_id is not None:
        await _validate_teacher_exists(db, payload.teacher_id)

    if await repository.get_class_subject_by_year_class_subject(
        db, academic_year_id=year.id, class_id=class_entity.id, subject_id=subject_entity.id
    ) is not None:
        raise ConflictException("This subject is already assigned to this class for this academic year")

    entity = await repository.create_class_subject(
        db,
        academic_year_id=year.id,
        class_id=class_entity.id,
        subject_id=subject_entity.id,
        teacher_id=payload.teacher_id,
        full_marks=payload.full_marks,
    )
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="class_subject", entity_id=entity.id)
    await db.commit()
    return await get_class_subject(db, entity.id)


async def list_class_subjects(
    db: AsyncSession, *, academic_year_id: uuid.UUID | None, class_id: uuid.UUID | None
) -> list[ClassSubjectRow]:
    year = await _require_active_year_or(db, academic_year_id)
    return await repository.list_class_subjects(db, academic_year_id=year.id, class_id=class_id)


async def get_class_subject(db: AsyncSession, class_subject_id: uuid.UUID) -> ClassSubjectRow:
    record = await repository.get_class_subject(db, class_subject_id)
    if record is None:
        raise NotFoundException("Class-subject assignment not found")
    return record


async def update_class_subject(
    db: AsyncSession, actor: CurrentUser, class_subject_id: uuid.UUID, payload: UpdateClassSubjectRequest
) -> ClassSubjectRow:
    class_subject, _, _, _, _ = await get_class_subject(db, class_subject_id)

    fields: dict = {}
    if payload.clear_teacher:
        fields["teacher_id"] = None
    elif payload.teacher_id is not None:
        await _validate_teacher_exists(db, payload.teacher_id)
        fields["teacher_id"] = payload.teacher_id

    if payload.full_marks is not None:
        fields["full_marks"] = payload.full_marks

    if fields:
        await repository.update_class_subject_fields(db, class_subject, fields)

    await record_audit_log(
        db, actor_id=actor.id, action="update", entity_type="class_subject", entity_id=class_subject_id, new_value=fields
    )
    await db.commit()
    return await get_class_subject(db, class_subject_id)


async def delete_class_subject(db: AsyncSession, actor: CurrentUser, class_subject_id: uuid.UUID) -> None:
    class_subject, _, _, _, _ = await get_class_subject(db, class_subject_id)
    await repository.delete_class_subject(db, class_subject)
    await record_audit_log(
        db, actor_id=actor.id, action="delete", entity_type="class_subject", entity_id=class_subject_id
    )
    await db.commit()


# --- Student Enrollment / Promotion ----------------------------------------


async def _validate_student_exists(db: AsyncSession, student_id: uuid.UUID) -> None:
    record = await students_repository.get_student_by_id(db, student_id)
    if record is None:
        raise NotFoundException("Student not found")


async def enroll_student_in_section(
    db: AsyncSession,
    *,
    student_id: uuid.UUID,
    academic_year_id: uuid.UUID | None,
    section_id: uuid.UUID,
    roll_number: str | None,
) -> StudentEnrollment:
    """Core enrollment logic shared by the enrollment endpoint and the student
    admission flow (students.service.create_student). Does not commit —
    caller controls the transaction boundary. Auto-assigns the next roll
    number (max existing + 1) when roll_number is left blank, and enforces
    section capacity based on active enrollments."""
    year = await _require_active_year_or(db, academic_year_id)

    section, _, _, _, _ = await get_section(db, section_id)
    if section.academic_year_id != year.id:
        raise ValidationException("The selected section does not belong to the target academic year")

    if await repository.get_enrollment_for_student_year(
        db, student_id=student_id, academic_year_id=year.id
    ) is not None:
        raise ConflictException("This student is already enrolled for this academic year")

    active_count = await repository.count_active_enrollments_by_section(db, [section_id])
    if section.capacity is not None and active_count.get(section_id, 0) >= section.capacity:
        raise ValidationException("This section has reached its capacity")

    resolved_roll = roll_number
    if resolved_roll:
        if await repository.get_enrollment_by_section_roll(
            db, section_id=section_id, roll_number=resolved_roll
        ) is not None:
            raise ConflictException("This roll number is already taken in this section")
    else:
        max_roll = await repository.get_max_roll_number_in_section(db, section_id)
        resolved_roll = str(max_roll + 1)

    return await repository.create_enrollment(
        db,
        student_id=student_id,
        academic_year_id=year.id,
        section_id=section_id,
        roll_number=resolved_roll,
    )


async def enroll_student(db: AsyncSession, actor: CurrentUser, payload: EnrollStudentRequest) -> EnrollmentRow:
    await _validate_student_exists(db, payload.student_id)
    entity = await enroll_student_in_section(
        db,
        student_id=payload.student_id,
        academic_year_id=payload.academic_year_id,
        section_id=payload.section_id,
        roll_number=payload.roll_number,
    )
    await record_audit_log(db, actor_id=actor.id, action="create", entity_type="student_enrollment", entity_id=entity.id)
    await db.commit()
    return await get_enrollment(db, entity.id)


async def get_section_enrolled_counts(db: AsyncSession, section_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    return await repository.count_active_enrollments_by_section(db, section_ids)


async def list_enrollments(
    db: AsyncSession,
    *,
    academic_year_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
    student_id: uuid.UUID | None,
) -> list[EnrollmentRow]:
    resolved_year_id = None
    if academic_year_id is not None or section_id is None:
        resolved_year_id = (await _require_active_year_or(db, academic_year_id)).id
    return await repository.list_enrollments(
        db, academic_year_id=resolved_year_id, section_id=section_id, student_id=student_id
    )


async def get_enrollment(db: AsyncSession, enrollment_id: uuid.UUID) -> EnrollmentRow:
    record = await repository.get_enrollment(db, enrollment_id)
    if record is None:
        raise NotFoundException("Enrollment not found")
    return record


async def update_enrollment(
    db: AsyncSession, actor: CurrentUser, enrollment_id: uuid.UUID, payload: UpdateEnrollmentRequest
) -> EnrollmentRow:
    enrollment, _, _, _, current_section, _ = await get_enrollment(db, enrollment_id)

    fields: dict = {}
    target_section_id = payload.section_id or enrollment.section_id
    if payload.section_id is not None and payload.section_id != enrollment.section_id:
        new_section, _, _, _, _ = await get_section(db, payload.section_id)
        if new_section.academic_year_id != enrollment.academic_year_id:
            raise ValidationException("Cannot move an enrollment to a section from a different academic year")
        fields["section_id"] = payload.section_id

    if payload.roll_number is not None and payload.roll_number != enrollment.roll_number:
        existing = await repository.get_enrollment_by_section_roll(
            db, section_id=target_section_id, roll_number=payload.roll_number
        )
        if existing is not None and existing.id != enrollment.id:
            raise ConflictException("This roll number is already taken in this section")
        fields["roll_number"] = payload.roll_number

    if payload.status is not None:
        fields["status"] = payload.status

    if fields:
        await repository.update_enrollment_fields(db, enrollment, fields)

    await record_audit_log(
        db, actor_id=actor.id, action="update", entity_type="student_enrollment", entity_id=enrollment_id
    )
    await db.commit()
    return await get_enrollment(db, enrollment_id)


async def _validate_promotion_item(
    db: AsyncSession, *, target_year: AcademicYear, item: PromotionItem, seen_targets: set[tuple[uuid.UUID, str]]
) -> None:
    await _validate_student_exists(db, item.student_id)

    if item.outcome != EnrollmentStatus.promoted:
        return

    section, _, _, _, _ = await get_section(db, item.target_section_id)
    if section.academic_year_id != target_year.id:
        raise ValidationException(
            f"Target section for student {item.student_id} does not belong to the target academic year"
        )

    key = (item.target_section_id, item.roll_number)
    if key in seen_targets:
        raise ConflictException(f"Duplicate roll number '{item.roll_number}' requested for the same section")
    seen_targets.add(key)

    if await repository.get_enrollment_by_section_roll(
        db, section_id=item.target_section_id, roll_number=item.roll_number
    ) is not None:
        raise ConflictException(f"Roll number '{item.roll_number}' is already taken in the target section")

    if await repository.get_enrollment_for_student_year(
        db, student_id=item.student_id, academic_year_id=target_year.id
    ) is not None:
        raise ConflictException(f"Student {item.student_id} is already enrolled for the target academic year")


async def promote_students(
    db: AsyncSession, actor: CurrentUser, payload: PromoteStudentsRequest
) -> list[PromotionOutcome]:
    target_year = await get_academic_year(db, payload.target_academic_year_id)

    seen_targets: set[tuple[uuid.UUID, str]] = set()
    for item in payload.items:
        await _validate_promotion_item(db, target_year=target_year, item=item, seen_targets=seen_targets)

    results: list[PromotionOutcome] = []
    for item in payload.items:
        if payload.source_academic_year_id is not None:
            source_enrollment = await repository.get_enrollment_for_student_year(
                db, student_id=item.student_id, academic_year_id=payload.source_academic_year_id
            )
            if source_enrollment is not None:
                await repository.update_enrollment_fields(db, source_enrollment, {"status": item.outcome})

        new_enrollment_id: uuid.UUID | None = None
        if item.outcome == EnrollmentStatus.promoted:
            new_enrollment = await repository.create_enrollment(
                db,
                student_id=item.student_id,
                academic_year_id=target_year.id,
                section_id=item.target_section_id,
                roll_number=item.roll_number,
            )
            new_enrollment_id = new_enrollment.id

        results.append(
            PromotionOutcome(
                student_id=str(item.student_id),
                outcome=item.outcome,
                new_enrollment_id=str(new_enrollment_id) if new_enrollment_id else None,
            )
        )

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="promote",
        entity_type="academic_year",
        entity_id=target_year.id,
        new_value={"count": len(payload.items)},
    )
    await db.commit()
    return results
