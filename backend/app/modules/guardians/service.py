import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.schemas import PaginationParams
from app.core.exceptions import ConflictException, NotFoundException
from app.core.security import hash_password
from app.modules.auth import repository as auth_repository
from app.modules.auth.models import User
from app.modules.guardians import repository
from app.modules.guardians.models import Guardian
from app.modules.guardians.schemas import CreateGuardianRequest, LinkedStudentSummary, UpdateGuardianRequest
from app.modules.students import repository as student_repository

GuardianRecord = tuple[Guardian, User]


async def _assert_unique_contact(db: AsyncSession, *, email: str | None, phone: str | None, exclude_user_id=None) -> None:
    if email is not None:
        existing = await auth_repository.get_user_by_email(db, email)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this email already exists")
    if phone is not None:
        existing = await auth_repository.get_user_by_phone(db, phone)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this phone number already exists")


async def create_guardian(db: AsyncSession, actor: CurrentUser, payload: CreateGuardianRequest) -> GuardianRecord:
    await _assert_unique_contact(db, email=payload.email, phone=payload.phone)

    role = await auth_repository.get_role_by_name(db, "guardian")
    if role is None:
        raise NotFoundException("Guardian role is not configured")

    user = await repository.create_guardian_user(
        db,
        role_id=role.id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
    )
    guardian = await repository.create_guardian_profile(
        db, user_id=user.id, occupation=payload.occupation, address=payload.address
    )

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create",
        entity_type="guardian",
        entity_id=guardian.id,
        new_value={"full_name": payload.full_name, "email": payload.email},
    )
    await db.commit()
    return guardian, user


async def list_guardians(db: AsyncSession, *, search: str | None, pagination: PaginationParams) -> tuple[list[GuardianRecord], int]:
    return await repository.list_guardians(db, search=search, offset=pagination.offset, limit=pagination.limit)


async def get_guardian(db: AsyncSession, guardian_id: uuid.UUID) -> GuardianRecord:
    record = await repository.get_guardian_by_id(db, guardian_id)
    if record is None:
        raise NotFoundException("Guardian not found")
    return record


async def get_own_guardian_profile(db: AsyncSession, actor: CurrentUser) -> GuardianRecord:
    record = await repository.get_guardian_by_user_id(db, actor.id)
    if record is None:
        raise NotFoundException("No guardian profile found for your account")
    return record


async def get_linked_students(db: AsyncSession, guardian_id: uuid.UUID) -> list[LinkedStudentSummary]:
    rows = await student_repository.list_students_for_guardian(db, guardian_id)
    return [
        LinkedStudentSummary(
            student_id=str(student.id),
            full_name=user.full_name,
            admission_number=student.admission_number,
            relation=link.relation,
            is_primary=link.is_primary,
        )
        for link, student, user in rows
    ]


async def update_guardian(
    db: AsyncSession, actor: CurrentUser, guardian_id: uuid.UUID, payload: UpdateGuardianRequest
) -> GuardianRecord:
    guardian, user = await get_guardian(db, guardian_id)
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

    guardian_fields = {
        key: value for key, value in (("occupation", payload.occupation), ("address", payload.address)) if value is not None
    }
    if guardian_fields:
        await repository.update_guardian_fields(db, guardian, guardian_fields)

    await record_audit_log(
        db, actor_id=actor.id, action="update", entity_type="guardian", entity_id=guardian_id, new_value=user_fields
    )
    await db.commit()
    return await get_guardian(db, guardian_id)


async def soft_delete_guardian(db: AsyncSession, actor: CurrentUser, guardian_id: uuid.UUID) -> None:
    guardian, user = await get_guardian(db, guardian_id)
    await repository.soft_delete_guardian(db, guardian, user)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="guardian", entity_id=guardian_id)
    await db.commit()


async def hard_delete_guardian(db: AsyncSession, actor: CurrentUser, guardian_id: uuid.UUID) -> None:
    record = await repository.get_guardian_by_id_any(db, guardian_id)
    if record is None:
        raise NotFoundException("Guardian not found")
    guardian, user = record

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="hard_delete",
        entity_type="guardian",
        entity_id=guardian_id,
        old_value={"full_name": user.full_name, "email": user.email},
    )
    try:
        await repository.hard_delete_guardian(db, user)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictException(
            "Cannot hard-delete a guardian due to existing related records -- soft-delete instead to preserve them"
        ) from exc
