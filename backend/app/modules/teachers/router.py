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
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.teachers import service
from app.modules.teachers.models import TeacherQualification
from app.modules.teachers.schemas import (
    CreateTeacherRequest,
    CreateTeacherResponse,
    QualificationResponse,
    TeacherDetailResponse,
    TeacherResponse,
    UpdateTeacherRequest,
)

router = APIRouter(prefix="/teachers", tags=["teachers"])


def _qualification_response(row: TeacherQualification) -> QualificationResponse:
    return QualificationResponse(
        id=str(row.id),
        education_title=row.education_title,
        institute=row.institute,
        grade=row.grade,
        passing_year=row.passing_year,
        additional_info=row.additional_info,
        certificate_url=row.certificate_url,
        marksheet_url=row.marksheet_url,
    )


def _teacher_fields(teacher, user) -> dict:
    return dict(
        id=str(teacher.id),
        user_id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
        is_active=user.is_active,
        employee_code=teacher.employee_code,
        joining_date=teacher.joining_date,
        designation=teacher.designation,
        qualification=teacher.qualification,
        nid_number=teacher.nid_number,
        nid_document_url=teacher.nid_document_url,
        previous_employment=teacher.previous_employment,
        status=teacher.status,
        created_at=teacher.created_at,
    )


def _to_response(record) -> dict:
    teacher, user = record
    return TeacherResponse(**_teacher_fields(teacher, user)).model_dump(mode="json")


async def _to_detail_response(db: AsyncSession, record) -> dict:
    teacher, user = record
    qualifications = await service.get_qualifications(db, teacher.id)
    return TeacherDetailResponse(
        **_teacher_fields(teacher, user),
        qualifications=[_qualification_response(row) for row in qualifications],
    ).model_dump(mode="json")


@router.post("", dependencies=[Depends(require_permission("teachers.create"))], status_code=201)
async def create_teacher(
    payload: CreateTeacherRequest,
    current_user: CurrentUser = Depends(require_permission("teachers.create")),
    db: AsyncSession = Depends(get_db_session),
):
    teacher, user, generated_password = await service.create_teacher(db, current_user, payload)
    qualifications = await service.get_qualifications(db, teacher.id)
    data = CreateTeacherResponse(
        **_teacher_fields(teacher, user),
        qualifications=[_qualification_response(row) for row in qualifications],
        temporary_password=generated_password,
    ).model_dump(mode="json")
    return success_response(data=data, message="Teacher created successfully", status_code=201)


@router.get("", dependencies=[Depends(require_permission("teachers.view"))])
async def list_teachers(
    search: str | None = Query(default=None, max_length=255),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_teachers(db, search=search, pagination=pagination)
    return success_response(
        data=[_to_response(item) for item in items],
        message="Teachers retrieved",
        meta=pagination_meta(pagination, total),
    )


@router.get("/me")
async def get_own_teacher_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.get_own_teacher_profile(db, current_user)
    return success_response(data=await _to_detail_response(db, record), message="Your teacher profile")


@router.get("/{teacher_id}", dependencies=[Depends(require_permission("teachers.view"))])
async def get_teacher(teacher_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    record = await service.get_teacher(db, teacher_id)
    return success_response(data=await _to_detail_response(db, record), message="Teacher retrieved")


@router.patch("/{teacher_id}", dependencies=[Depends(require_permission("teachers.update"))])
async def update_teacher(
    teacher_id: uuid.UUID,
    payload: UpdateTeacherRequest,
    current_user: CurrentUser = Depends(require_permission("teachers.update")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_teacher(db, current_user, teacher_id, payload)
    return success_response(data=await _to_detail_response(db, record), message="Teacher updated successfully")


@router.delete("/{teacher_id}", dependencies=[Depends(require_permission("teachers.delete"))])
async def soft_delete_teacher(
    teacher_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("teachers.delete")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_teacher(db, current_user, teacher_id)
    return success_response(data=None, message="Teacher deleted successfully")


@router.delete("/{teacher_id}/hard", dependencies=[Depends(require_role("principal"))])
async def hard_delete_teacher(
    teacher_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("principal")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.hard_delete_teacher(db, current_user, teacher_id)
    return success_response(data=None, message="Teacher permanently deleted")
