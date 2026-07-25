import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_current_user, get_db_session, require_permission
from app.common.enums import Weekday
from app.core.response import success_response
from app.modules.routine import service
from app.modules.routine.repository import RoutineSlotRow
from app.modules.routine.schemas import (
    CreateRoutineSlotRequest,
    GuardianRoutineResponse,
    RoutineSlotResponse,
    SectionRoutineResponse,
    StudentSectionRoutineResponse,
    UpdateRoutineSlotRequest,
)

router = APIRouter(prefix="/routine", tags=["routine"])


def _build_slot(row: RoutineSlotRow) -> RoutineSlotResponse:
    slot, section, class_entity, subject, teacher, teacher_user, room = row
    return RoutineSlotResponse(
        id=str(slot.id),
        academic_year_id=str(slot.academic_year_id),
        section_id=str(section.id),
        section_name=section.name,
        class_id=str(class_entity.id),
        class_name=class_entity.name,
        subject_id=str(subject.id),
        subject_name=subject.name,
        subject_code=subject.code,
        teacher_id=str(teacher.id),
        teacher_name=teacher_user.full_name,
        room_id=str(room.id) if room else None,
        room_name=room.name if room else None,
        day_of_week=slot.day_of_week,
        period_number=slot.period_number,
        start_time=slot.start_time,
        end_time=slot.end_time,
        created_at=slot.created_at,
    )


def _slot_response(row: RoutineSlotRow) -> dict:
    return _build_slot(row).model_dump(mode="json")


def _section_routine_response(section, class_entity, rows: list[RoutineSlotRow]) -> SectionRoutineResponse:
    return SectionRoutineResponse(
        section_id=str(section.id),
        section_name=section.name,
        class_id=str(class_entity.id),
        class_name=class_entity.name,
        slots=[_build_slot(row) for row in rows],
    )


# --- CRUD (Admin builder) --------------------------------------------------


@router.post("/slots", dependencies=[Depends(require_permission("routine.manage"))], status_code=201)
async def create_routine_slot(
    payload: CreateRoutineSlotRequest,
    current_user: CurrentUser = Depends(require_permission("routine.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.create_slot(db, current_user, payload)
    return success_response(data=_slot_response(record), message="Routine slot created", status_code=201)


@router.get("/slots", dependencies=[Depends(require_permission("routine.view"))])
async def list_routine_slots(
    academic_year_id: uuid.UUID | None = Query(default=None),
    section_id: uuid.UUID | None = Query(default=None),
    teacher_id: uuid.UUID | None = Query(default=None),
    day_of_week: Weekday | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.list_slots(
        db, academic_year_id=academic_year_id, section_id=section_id, teacher_id=teacher_id, day_of_week=day_of_week
    )
    return success_response(data=[_slot_response(r) for r in records], message="Routine slots retrieved")


@router.patch("/slots/{slot_id}", dependencies=[Depends(require_permission("routine.manage"))])
async def update_routine_slot(
    slot_id: uuid.UUID,
    payload: UpdateRoutineSlotRequest,
    current_user: CurrentUser = Depends(require_permission("routine.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_slot(db, current_user, slot_id, payload)
    return success_response(data=_slot_response(record), message="Routine slot updated")


@router.delete("/slots/{slot_id}", dependencies=[Depends(require_permission("routine.manage"))])
async def delete_routine_slot(
    slot_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("routine.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_slot(db, current_user, slot_id)
    return success_response(data=None, message="Routine slot removed")


# --- Section weekly view (Admin builder / scoped Teacher / Student / Guardian) --


@router.get("/sections/{section_id}", dependencies=[Depends(require_permission("routine.view"))])
async def get_section_routine(
    section_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("routine.view")),
    db: AsyncSession = Depends(get_db_session),
):
    section, class_entity, rows = await service.get_section_routine(db, current_user, section_id)
    data = _section_routine_response(section, class_entity, rows).model_dump(mode="json")
    return success_response(data=data, message="Section routine retrieved")


# --- Self-scoped views ------------------------------------------------------


@router.get("/me/teacher")
async def get_my_teacher_routine(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.get_teacher_own_routine(db, current_user)
    return success_response(data=[_slot_response(r) for r in records], message="Your teaching schedule")


@router.get("/me/student")
async def get_my_student_routine(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    student, user, section, class_entity, rows = await service.get_student_own_routine(db, current_user)
    data = StudentSectionRoutineResponse(
        student_id=str(student.id),
        student_name=user.full_name,
        section=_section_routine_response(section, class_entity, rows),
    ).model_dump(mode="json")
    return success_response(data=data, message="Your class routine")


@router.get("/me/guardian")
async def get_my_children_routine(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.get_guardian_routine(db, current_user)
    children = [
        StudentSectionRoutineResponse(
            student_id=str(student.id),
            student_name=user.full_name,
            section=_section_routine_response(section, class_entity, rows),
        )
        for student, user, section, class_entity, rows in records
    ]
    data = GuardianRoutineResponse(children=children).model_dump(mode="json")
    return success_response(data=data, message="Linked children's routines retrieved")
