import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.models import AuditLog
from app.modules.auth.models import User

AuditRecord = tuple[AuditLog, str | None]


def _build_filters(
    *,
    actor_id: uuid.UUID | None,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
    date_from: date | None,
    date_to: date | None,
    subject_id: uuid.UUID | None,
    profile_id: uuid.UUID | None,
) -> list:
    filters = []

    # "Everything about this person" spans two ids. Actions they performed are
    # keyed by their user id, and so are audits of their `users` row -- but the
    # student/teacher modules log against the profile id instead
    # (entity_type="student", entity_id=<student.id>), so both must be matched or
    # half the trail goes missing.
    subject_clauses = []
    if subject_id is not None:
        subject_clauses.extend([AuditLog.actor_id == subject_id, AuditLog.entity_id == subject_id])
    if profile_id is not None:
        subject_clauses.append(AuditLog.entity_id == profile_id)
    if subject_clauses:
        filters.append(or_(*subject_clauses))
    if actor_id is not None:
        filters.append(AuditLog.actor_id == actor_id)
    if entity_type is not None:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        filters.append(AuditLog.entity_id == entity_id)
    if date_from is not None:
        filters.append(AuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to is not None:
        filters.append(AuditLog.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))

    return filters


async def list_audit_logs(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
    date_from: date | None,
    date_to: date | None,
    subject_id: uuid.UUID | None,
    profile_id: uuid.UUID | None,
    offset: int,
    limit: int,
) -> tuple[list[AuditRecord], int]:
    filters = _build_filters(
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        date_from=date_from,
        date_to=date_to,
        subject_id=subject_id,
        profile_id=profile_id,
    )

    count_result = await db.execute(select(func.count()).select_from(AuditLog).where(*filters))
    total = count_result.scalar_one()

    # Outer join: the actor is nullable (system-generated rows) and may since have
    # been hard-deleted, neither of which should hide the log entry.
    result = await db.execute(
        select(AuditLog, User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_id)
        .where(*filters)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total
