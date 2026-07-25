import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Role, User
from app.modules.students.models import Student


async def list_pending_students(db: AsyncSession) -> list[tuple[User, Student]]:
    result = await db.execute(
        select(User, Student)
        .join(Role, Role.id == User.role_id)
        .join(Student, Student.user_id == User.id)
        .where(
            Role.name == "student",
            User.is_active.is_(False),
            User.deleted_at.is_(None),
            Student.deleted_at.is_(None),
        )
        .order_by(User.created_at.asc())
    )
    return list(result.all())


async def get_pending_student_user(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User)
        .join(Role, Role.id == User.role_id)
        .where(
            User.id == user_id,
            Role.name == "student",
            User.is_active.is_(False),
            User.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def activate_student(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(update(User).where(User.id == user_id).values(is_active=True))
