import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.codes import generate_identifier
from app.common.dependencies import CurrentUser
from app.common.schemas import PaginationParams
from app.core.email import send_account_welcome_email
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.core.security import hash_password
from app.modules.auth import repository as auth_repository
from app.modules.users import repository
from app.modules.users.models import Staff, StaffQualification
from app.modules.users.repository import STAFF_LIKE_ROLES
from app.modules.users.schemas import CreateUserAccountRequest, UpdateUserAccountRequest

ManagedUser = tuple[object, str, Staff | None]

EMPLOYEE_CODE_PREFIX = {"staff": "STF", "accountant": "ACC", "receptionist": "REC"}


def _staff_role_prefix(role_name: str) -> str:
    return EMPLOYEE_CODE_PREFIX.get(role_name, "STF")


async def _assert_unique_contact(db: AsyncSession, *, email: str | None, phone: str | None, exclude_user_id=None) -> None:
    if email is not None:
        existing = await auth_repository.get_user_by_email(db, email)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this email already exists")
    if phone is not None:
        existing = await auth_repository.get_user_by_phone(db, phone)
        if existing is not None and existing.id != exclude_user_id:
            raise ConflictException("An account with this phone number already exists")


async def create_user_account(
    db: AsyncSession, actor: CurrentUser, payload: CreateUserAccountRequest
) -> tuple[ManagedUser, str | None]:
    if payload.role == "admin" and not actor.has_role("principal"):
        raise PermissionDeniedException("Only the Principal can create Admin accounts")

    if payload.role in STAFF_LIKE_ROLES and payload.joining_date is None:
        raise ValidationException(
            "Joining date is required", details=[{"field": "joining_date", "issue": "This field is required"}]
        )

    generated_password: str | None = None
    if payload.role == "admin":
        if not payload.password:
            raise ValidationException(
                "Password is required for Admin accounts", details=[{"field": "password", "issue": "This field is required"}]
            )
        password_hash = hash_password(payload.password)
    else:
        if payload.date_of_birth is None:
            raise ValidationException(
                "Date of birth is required", details=[{"field": "date_of_birth", "issue": "This field is required"}]
            )
        generated_password = payload.date_of_birth.strftime("%d%m%Y")
        password_hash = hash_password(generated_password)

    await _assert_unique_contact(db, email=payload.email, phone=payload.phone)

    role = await auth_repository.get_role_by_name(db, payload.role)
    if role is None:
        raise NotFoundException(f"Role '{payload.role}' is not configured")

    user = await repository.create_user(
        db,
        role_id=role.id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=password_hash,
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
        is_active=True,
    )

    staff: Staff | None = None
    if payload.role in STAFF_LIKE_ROLES:
        employee_code = payload.employee_code or generate_identifier(_staff_role_prefix(payload.role))
        staff = await repository.create_staff_profile(
            db,
            user_id=user.id,
            employee_code=employee_code,
            department=payload.department,
            designation=payload.designation,
            joining_date=payload.joining_date,
            nid_number=payload.nid_number,
            nid_document_url=payload.nid_document_url,
            previous_employment=payload.previous_employment,
        )
        if payload.qualifications:
            await repository.replace_qualifications(db, staff.id, payload.qualifications)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="create",
        entity_type="user",
        entity_id=user.id,
        new_value={"role": payload.role, "full_name": payload.full_name, "email": payload.email},
    )
    await db.commit()

    if staff is not None and generated_password is not None:
        await send_account_welcome_email(
            payload.email,
            payload.full_name,
            role_label=payload.role.capitalize(),
            employee_code=staff.employee_code,
            temporary_password=generated_password,
            designation=payload.designation,
            joining_date=payload.joining_date.isoformat() if payload.joining_date else None,
        )

    return (user, payload.role, staff), generated_password


async def list_user_accounts(
    db: AsyncSession, *, roles: list[str], search: str | None, pagination: PaginationParams
) -> tuple[list[ManagedUser], int]:
    invalid = [r for r in roles if r not in {"admin", *STAFF_LIKE_ROLES}]
    if invalid:
        raise ValidationException(f"Invalid role filter: {', '.join(invalid)}")
    items, total = await repository.list_user_accounts(
        db, roles=roles, search=search, offset=pagination.offset, limit=pagination.limit
    )
    return items, total


async def get_user_account(db: AsyncSession, user_id: uuid.UUID) -> ManagedUser:
    record = await repository.get_user_with_staff(db, user_id)
    if record is None or record[1] not in {"admin", *STAFF_LIKE_ROLES}:
        raise NotFoundException("Account not found")
    return record


async def get_own_account(db: AsyncSession, actor: CurrentUser) -> ManagedUser:
    record = await repository.get_user_with_staff(db, actor.id)
    if record is None:
        raise NotFoundException("Account not found")
    return record


async def get_qualifications(db: AsyncSession, staff_id: uuid.UUID) -> list[StaffQualification]:
    return await repository.list_qualifications(db, staff_id)


async def update_user_account(
    db: AsyncSession, actor: CurrentUser, user_id: uuid.UUID, payload: UpdateUserAccountRequest
) -> ManagedUser:
    user, role_name, staff = await get_user_account(db, user_id)
    if role_name == "admin" and not actor.has_role("principal"):
        raise PermissionDeniedException("Only the Principal can update Admin accounts")

    await _assert_unique_contact(db, email=payload.email, phone=payload.phone, exclude_user_id=user_id)

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
    if user_fields:
        await repository.update_user_fields(db, user, user_fields)

    if staff is not None:
        staff_fields = {
            key: value
            for key, value in (
                ("department", payload.department),
                ("designation", payload.designation),
                ("nid_number", payload.nid_number),
                ("nid_document_url", payload.nid_document_url),
                ("previous_employment", payload.previous_employment),
                ("status", payload.status),
            )
            if value is not None
        }
        if staff_fields:
            await repository.update_staff_fields(db, staff, staff_fields)

        if payload.qualifications is not None:
            await repository.replace_qualifications(db, staff.id, payload.qualifications)

    await record_audit_log(
        db, actor_id=actor.id, action="update", entity_type="user", entity_id=user_id, new_value=user_fields
    )
    await db.commit()
    return await get_user_account(db, user_id)


async def soft_delete_user_account(db: AsyncSession, actor: CurrentUser, user_id: uuid.UUID) -> None:
    user, role_name, staff = await get_user_account(db, user_id)
    if role_name == "admin" and not actor.has_role("principal"):
        raise PermissionDeniedException("Only the Principal can delete Admin accounts")

    await repository.soft_delete_user(db, user, staff)
    await record_audit_log(db, actor_id=actor.id, action="soft_delete", entity_type="user", entity_id=user_id)
    await db.commit()


async def hard_delete_user_account(db: AsyncSession, actor: CurrentUser, user_id: uuid.UUID) -> None:
    record = await repository.get_user_with_staff(db, user_id)
    if record is None:
        raise NotFoundException("Account not found")
    user, role_name, staff = record

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="hard_delete",
        entity_type="user",
        entity_id=user_id,
        old_value={"role": role_name, "full_name": user.full_name, "email": user.email, "phone": user.phone},
    )
    await repository.hard_delete_user(db, user)
    await db.commit()
