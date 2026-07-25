import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.modules.students import repository
from app.modules.students.schemas import PendingStudentSummary


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
