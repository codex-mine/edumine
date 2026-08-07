import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import (
    CurrentUser,
    get_current_user,
    get_db_session,
    get_pagination,
    require_permission,
    require_role,
)
from app.common.enums import StudentStatus
from app.common.schemas import PaginationParams, pagination_meta
from app.core.exceptions import PermissionDeniedException
from app.core.response import success_response
from app.modules.students import service
from app.modules.students.schemas import (
    AdmitStudentResponse,
    CreateStudentRequest,
    LinkGuardianRequest,
    StudentDetailResponse,
    StudentResponse,
    UpdateGuardianLinkRequest,
    UpdateStudentRequest,
)

router = APIRouter(prefix="/students", tags=["students"])


def _student_fields(student, user, enrollment=None, section=None, class_entity=None) -> dict:
    return dict(
        id=str(student.id),
        user_id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        profile_photo_url=user.profile_photo_url,
        is_active=user.is_active,
        admission_number=student.admission_number,
        admission_date=student.admission_date,
        blood_group=student.blood_group,
        address=student.address,
        emergency_contact=student.emergency_contact,
        status=student.status,
        created_at=student.created_at,
        class_name=class_entity.name if class_entity else None,
        section_name=section.name if section else None,
        roll_number=enrollment.roll_number if enrollment else None,
    )


def _to_response(record) -> dict:
    student, user = record
    return StudentResponse(**_student_fields(student, user)).model_dump(mode="json")


def _to_list_response(record) -> dict:
    student, user, enrollment, section, class_entity = record
    return StudentResponse(**_student_fields(student, user, enrollment, section, class_entity)).model_dump(mode="json")


async def _to_detail_response(db: AsyncSession, record) -> dict:
    student, user = record
    enrollment_summary = await service.get_student_enrollment_summary(db, student.id)
    enrollment, section, class_entity = enrollment_summary if enrollment_summary else (None, None, None)
    fields = _student_fields(student, user, enrollment, section, class_entity)
    guardians = await service.get_linked_guardians(db, student.id)
    return StudentDetailResponse(**fields, guardians=guardians).model_dump(mode="json")


@router.post("", dependencies=[Depends(require_permission("students.create"))], status_code=201)
async def create_student(
    payload: CreateStudentRequest,
    current_user: CurrentUser = Depends(require_permission("students.create")),
    db: AsyncSession = Depends(get_db_session),
):
    student, user, enrollment_row, generated_password = await service.create_student(db, current_user, payload)
    enrollment, _, _, academic_year, section, class_entity = enrollment_row
    fields = _student_fields(student, user, enrollment, section, class_entity)
    data = AdmitStudentResponse(
        **fields, temporary_password=generated_password, academic_year_name=academic_year.name
    ).model_dump(mode="json")
    return success_response(data=data, message="Student admitted successfully", status_code=201)


@router.get("", dependencies=[Depends(require_permission("students.view"))])
async def list_students(
    search: str | None = Query(default=None, max_length=255),
    status: StudentStatus | None = Query(default=None),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_students(db, search=search, status=status, pagination=pagination)
    return success_response(
        data=[_to_list_response(item) for item in items],
        message="Students retrieved",
        meta=pagination_meta(pagination, total),
    )


@router.get("/pending", dependencies=[Depends(require_permission("students.view"))])
async def list_pending_students(db: AsyncSession = Depends(get_db_session)):
    students = await service.list_pending_students(db)
    return success_response(
        data=[student.model_dump(mode="json") for student in students],
        message="Pending student registrations",
    )


@router.post("/{user_id}/activate", dependencies=[Depends(require_permission("students.update"))])
async def activate_student(user_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    await service.activate_student(db, user_id)
    return success_response(data=None, message="Student account activated")


@router.get("/me")
async def get_own_student_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.get_own_student_profile(db, current_user)
    return success_response(data=await _to_detail_response(db, record), message="Your student profile")


@router.get("/{student_id}", dependencies=[Depends(require_permission("students.view"))])
async def get_student(student_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    record = await service.get_student(db, student_id)
    return success_response(data=await _to_detail_response(db, record), message="Student retrieved")


@router.patch("/{student_id}", dependencies=[Depends(require_permission("students.update"))])
async def update_student(
    student_id: uuid.UUID,
    payload: UpdateStudentRequest,
    current_user: CurrentUser = Depends(require_permission("students.update")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_student(db, current_user, student_id, payload)
    return success_response(data=_to_response(record), message="Student updated successfully")


@router.delete("/{student_id}", dependencies=[Depends(require_permission("students.delete"))])
async def soft_delete_student(
    student_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("students.delete")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_student(db, current_user, student_id)
    return success_response(data=None, message="Student deleted successfully")


@router.delete("/{student_id}/hard", dependencies=[Depends(require_role("principal"))])
async def hard_delete_student(
    student_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("principal")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.hard_delete_student(db, current_user, student_id)
    return success_response(data=None, message="Student permanently deleted")


def _require_link_permission(current_user: CurrentUser) -> None:
    if not current_user.has_permission("students.update", "guardians.update"):
        raise PermissionDeniedException("You do not have permission to manage guardian links")


@router.post("/{student_id}/guardians/{guardian_id}")
async def link_guardian(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    payload: LinkGuardianRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    _require_link_permission(current_user)
    await service.link_guardian(db, current_user, student_id, guardian_id, payload.relation, payload.is_primary)
    return success_response(data=None, message="Guardian linked successfully")


@router.patch("/{student_id}/guardians/{guardian_id}")
async def update_guardian_link(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    payload: UpdateGuardianLinkRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    _require_link_permission(current_user)
    await service.update_guardian_link(db, current_user, student_id, guardian_id, payload.relation, payload.is_primary)
    return success_response(data=None, message="Guardian link updated")


@router.delete("/{student_id}/guardians/{guardian_id}")
async def unlink_guardian(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    _require_link_permission(current_user)
    await service.unlink_guardian(db, current_user, student_id, guardian_id)
    return success_response(data=None, message="Guardian unlinked successfully")
