import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db_session, require_permission
from app.core.response import success_response
from app.modules.students import service

router = APIRouter(prefix="/students", tags=["students"])


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
