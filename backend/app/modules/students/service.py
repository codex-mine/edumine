import uuid
from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.codes import generate_identifier
from app.common.dependencies import CurrentUser
from app.common.enums import StudentStatus
from app.common.schemas import PaginationParams
from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.core.security import hash_password
from app.modules.academic import repository as academic_repository
from app.modules.academic import service as academic_service
from app.modules.academic.models import Class, Section, StudentEnrollment
from app.modules.academic.repository import EnrollmentRow
from app.modules.auth import repository as auth_repository
from app.modules.auth.models import User
from app.modules.guardians import service as guardians_service
from app.modules.students import repository
from app.modules.students.models import Student
from app.modules.students.repository import StudentEnrollmentRow
from app.modules.students.schemas import (
    CreateStudentRequest,
    LinkedGuardianSummary,
    PendingStudentSummary,
    UpdateStudentRequest,
)

StudentRecord = tuple[Student, User]
EnrollmentSummary = tuple[StudentEnrollment, Section, Class] | None


async def list_pending_students(db: AsyncSession) -> list[PendingStudentSummary]:
    rows = await repository.list_pending_students(db)
    return [
        PendingStudentSummary(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            admission_number=student.admission_number,
            created_at=user.created_at,
        )
        for user, student in rows
    ]


async def activate_student(db: AsyncSession, user_id: uuid.UUID) -> None:
    user = await repository.get_pending_student_user(db, user_id)
    if user is None:
        raise NotFoundException("No pending student registration found for this account")

    await repository.activate_student(db, user_id)
    await db.commit()


async def _assert_unique_contact(db: AsyncSession, *, email: str | None, phone: str | None, exclude_user_id=None) -> None:
    if email is not None:
        existing = await auth_repository.get_user_by_email(db, email)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this email already exists")
    if phone is not None:
        existing = await auth_repository.get_user_by_phone(db, phone)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this phone number already exists")


async def create_student(
    db: AsyncSession, actor: CurrentUser, payload: CreateStudentRequest
) -> tuple[Student, User, EnrollmentRow, str]:
    await _assert_unique_contact(db, email=payload.email, phone=payload.phone)

    role = await auth_repository.get_role_by_name(db, "student")
    if role is None:
        raise NotFoundException("Student role is not configured")

    generated_password = payload.date_of_birth.strftime("%d%m%Y")

    user = await repository.create_student_user_active(
        db,
        role_id=role.id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(generated_password),
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
    )

    admission_number = generate_identifier("STU")
    student = await repository.create_student_profile_full(
        db,
        user_id=user.id,
        admission_number=admission_number,
        admission_date=payload.admission_date or date.today(),
        blood_group=payload.blood_group,
        address=payload.address,
        emergency_contact=payload.emergency_contact,
    )

    enrollment = await academic_service.enroll_student_in_section(
        db,
        student_id=student.id,
        academic_year_id=None,
        section_id=payload.section_id,
        roll_number=None,
    )

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create",
        entity_type="student",
        entity_id=student.id,
        new_value={
            "full_name": payload.full_name,
            "admission_number": admission_number,
            "roll_number": enrollment.roll_number,
        },
    )
    await db.commit()

    enrollment_row = await academic_service.get_enrollment(db, enrollment.id)
    return student, user, enrollment_row, generated_password


async def _get_active_academic_year_id(db: AsyncSession) -> uuid.UUID | None:
    year = await academic_repository.get_active_academic_year(db)
    return year.id if year else None


async def list_students(
    db: AsyncSession, *, search: str | None, status: StudentStatus | None, pagination: PaginationParams
) -> tuple[list[StudentEnrollmentRow], int]:
    academic_year_id = await _get_active_academic_year_id(db)
    return await repository.list_students(
        db,
        search=search,
        status=status,
        offset=pagination.offset,
        limit=pagination.limit,
        academic_year_id=academic_year_id,
    )


async def get_student(db: AsyncSession, student_id: uuid.UUID) -> StudentRecord:
    record = await repository.get_student_by_id(db, student_id)
    if record is None:
        raise NotFoundException("Student not found")
    return record


async def get_student_enrollment_summary(db: AsyncSession, student_id: uuid.UUID) -> EnrollmentSummary:
    academic_year_id = await _get_active_academic_year_id(db)
    return await repository.get_active_enrollment_for_student(db, student_id, academic_year_id)


async def get_own_student_profile(db: AsyncSession, actor: CurrentUser) -> StudentRecord:
    record = await repository.get_student_by_user_id(db, actor.id)
    if record is None:
        raise NotFoundException("No student profile found for your account")
    return record


async def get_linked_guardians(db: AsyncSession, student_id: uuid.UUID) -> list[LinkedGuardianSummary]:
    rows = await repository.list_guardians_for_student(db, student_id)
    return [
        LinkedGuardianSummary(
            guardian_id=str(guardian.id),
            full_name=user.full_name,
            phone=user.phone,
            relation=link.relation,
            is_primary=link.is_primary,
        )
        for link, guardian, user in rows
    ]


async def update_student(
    db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, payload: UpdateStudentRequest
) -> StudentRecord:
    student, user = await get_student(db, student_id)
    await _assert_unique_contact(db, email=payload.email, phone=payload.phone, exclude_user_id=user.id)

    user_fields = {
        key: value
        for key, value in (
            ("full_name", payload.full_name),
            ("email", payload.email),
            ("phone", payload.phone),
            ("gender", payload.gender),
            ("date_of_birth", payload.date_of_birth),
            ("is_active", payload.is_active),
        )
        if value is not None
    }
    for key, value in user_fields.items():
        setattr(user, key, value)

    student_fields = {
        key: value
        for key, value in (
            ("blood_group", payload.blood_group),
            ("address", payload.address),
            ("emergency_contact", payload.emergency_contact),
            ("status", payload.status),
        )
        if value is not None
    }
    if student_fields:
        await repository.update_student_fields(db, student, student_fields)

    await record_audit_log(
        db, actor_id=actor.id, action="update", entity_type="student", entity_id=student_id, new_value=user_fields
    )
    await db.commit()
    return await get_student(db, student_id)


async def soft_delete_student(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> None:
    student, user = await get_student(db, student_id)
    await repository.soft_delete_student(db, student, user)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="student", entity_id=student_id)
    await db.commit()


async def hard_delete_student(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> None:
    record = await repository.get_student_by_id_any(db, student_id)
    if record is None:
        raise NotFoundException("Student not found")
    student, user = record

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="hard_delete",
        entity_type="student",
        entity_id=student_id,
        old_value={"full_name": user.full_name, "admission_number": student.admission_number},
    )
    try:
        await repository.hard_delete_student(db, user)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictException(
            "Cannot hard-delete a student with existing financial or academic records "
            "(e.g. invoices) -- soft-delete instead to preserve them"
        ) from exc


# --- Guardian linking ---------------------------------------------------


async def link_guardian(
    db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, guardian_id: uuid.UUID, relation: str, is_primary: bool
) -> None:
    student, _ = await get_student(db, student_id)
    await guardians_service.get_guardian(db, guardian_id)

    if await repository.get_link(db, student_id, guardian_id) is not None:
        raise ConflictException("This guardian is already linked to this student")

    existing_links = await repository.count_links_for_student(db, student_id)
    force_primary = is_primary or existing_links == 0

    link = await repository.create_link(
        db, student_id=student_id, guardian_id=guardian_id, relation=relation, is_primary=force_primary
    )
    if force_primary:
        await repository.unset_other_primaries(db, student_id, link.id)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="link_guardian",
        entity_type="student",
        entity_id=student_id,
        new_value={"guardian_id": str(guardian_id), "relation": relation, "is_primary": force_primary},
    )
    await db.commit()


async def update_guardian_link(
    db: AsyncSession,
    actor: CurrentUser,
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    relation: str | None,
    is_primary: bool | None,
) -> None:
    link = await repository.get_link(db, student_id, guardian_id)
    if link is None:
        raise NotFoundException("This guardian is not linked to this student")

    fields = {k: v for k, v in (("relation", relation), ("is_primary", is_primary)) if v is not None}
    if fields:
        await repository.update_link_fields(db, link, fields)
    if is_primary:
        await repository.unset_other_primaries(db, student_id, link.id)

    await record_audit_log(
        db, actor_id=actor.id, action="update_guardian_link", entity_type="student", entity_id=student_id
    )
    await db.commit()


async def unlink_guardian(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, guardian_id: uuid.UUID) -> None:
    link = await repository.get_link(db, student_id, guardian_id)
    if link is None:
        raise NotFoundException("This guardian is not linked to this student")

    if link.is_primary:
        total_links = await repository.count_links_for_student(db, student_id)
        if total_links > 1:
            raise ValidationException(
                "Cannot unlink the primary guardian while other guardians remain — "
                "make another guardian primary first"
            )

    await repository.delete_link(db, link)
    await record_audit_log(
        db, actor_id=actor.id, action="unlink_guardian", entity_type="student", entity_id=student_id
    )
    await db.commit()
