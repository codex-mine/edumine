import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.codes import generate_identifier
from app.common.dependencies import CurrentUser
from app.common.schemas import PaginationParams
from app.core.email import send_account_welcome_email
from app.core.exceptions import ConflictException, NotFoundException
from app.core.security import hash_password
from app.modules.auth import repository as auth_repository
from app.modules.auth.models import User
from app.modules.teachers import repository
from app.modules.teachers.models import Teacher, TeacherQualification
from app.modules.teachers.schemas import CreateTeacherRequest, UpdateTeacherRequest

TeacherRecord = tuple[Teacher, User]


async def _assert_unique_contact(db: AsyncSession, *, email: str | None, phone: str | None, exclude_user_id=None) -> None:
    if email is not None:
        existing = await auth_repository.get_user_by_email(db, email)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this email already exists")
    if phone is not None:
        existing = await auth_repository.get_user_by_phone(db, phone)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this phone number already exists")


async def create_teacher(
    db: AsyncSession, actor: CurrentUser, payload: CreateTeacherRequest
) -> tuple[Teacher, User, str]:
    await _assert_unique_contact(db, email=payload.email, phone=payload.phone)

    role = await auth_repository.get_role_by_name(db, "teacher")
    if role is None:
        raise NotFoundException("Teacher role is not configured")

    generated_password = payload.date_of_birth.strftime("%d%m%Y")

    user = await repository.create_teacher_user(
        db,
        role_id=role.id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(generated_password),
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
    )

    employee_code = payload.employee_code or generate_identifier("TCH")
    teacher = await repository.create_teacher_profile(
        db,
        user_id=user.id,
        employee_code=employee_code,
        joining_date=payload.joining_date,
        designation=payload.designation,
        qualification=payload.qualification,
        nid_number=payload.nid_number,
        nid_document_url=payload.nid_document_url,
        previous_employment=payload.previous_employment,
    )

    if payload.qualifications:
        await repository.replace_qualifications(db, teacher.id, payload.qualifications)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create",
        entity_type="teacher",
        entity_id=teacher.id,
        new_value={"full_name": payload.full_name, "email": payload.email, "employee_code": employee_code},
    )
    await db.commit()

    await send_account_welcome_email(
        payload.email,
        payload.full_name,
        role_label="Teacher",
        employee_code=employee_code,
        temporary_password=generated_password,
        designation=payload.designation,
        joining_date=payload.joining_date.isoformat(),
    )

    return teacher, user, generated_password


async def list_teachers(db: AsyncSession, *, search: str | None, pagination: PaginationParams) -> tuple[list[TeacherRecord], int]:
    return await repository.list_teachers(db, search=search, offset=pagination.offset, limit=pagination.limit)


async def get_teacher(db: AsyncSession, teacher_id: uuid.UUID) -> TeacherRecord:
    record = await repository.get_teacher_by_id(db, teacher_id)
    if record is None:
        raise NotFoundException("Teacher not found")
    return record


async def get_own_teacher_profile(db: AsyncSession, actor: CurrentUser) -> TeacherRecord:
    record = await repository.get_teacher_by_user_id(db, actor.id)
    if record is None:
        raise NotFoundException("No teacher profile found for your account")
    return record


async def get_qualifications(db: AsyncSession, teacher_id: uuid.UUID) -> list[TeacherQualification]:
    return await repository.list_qualifications(db, teacher_id)


async def update_teacher(
    db: AsyncSession, actor: CurrentUser, teacher_id: uuid.UUID, payload: UpdateTeacherRequest
) -> TeacherRecord:
    teacher, user = await get_teacher(db, teacher_id)
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

    teacher_fields = {
        key: value
        for key, value in (
            ("designation", payload.designation),
            ("qualification", payload.qualification),
            ("nid_number", payload.nid_number),
            ("nid_document_url", payload.nid_document_url),
            ("previous_employment", payload.previous_employment),
            ("status", payload.status),
        )
        if value is not None
    }
    if teacher_fields:
        await repository.update_teacher_fields(db, teacher, teacher_fields)

    if payload.qualifications is not None:
        await repository.replace_qualifications(db, teacher.id, payload.qualifications)

    await record_audit_log(
        db, actor_id=actor.id, action="update", entity_type="teacher", entity_id=teacher_id, new_value=user_fields
    )
    await db.commit()
    return await get_teacher(db, teacher_id)


async def soft_delete_teacher(db: AsyncSession, actor: CurrentUser, teacher_id: uuid.UUID) -> None:
    teacher, user = await get_teacher(db, teacher_id)
    await repository.soft_delete_teacher(db, teacher, user)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="teacher", entity_id=teacher_id)
    await db.commit()


async def hard_delete_teacher(db: AsyncSession, actor: CurrentUser, teacher_id: uuid.UUID) -> None:
    record = await repository.get_teacher_by_id_any(db, teacher_id)
    if record is None:
        raise NotFoundException("Teacher not found")
    teacher, user = record

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="hard_delete",
        entity_type="teacher",
        entity_id=teacher_id,
        old_value={"full_name": user.full_name, "email": user.email, "employee_code": teacher.employee_code},
    )
    await repository.hard_delete_teacher(db, user)
    await db.commit()
