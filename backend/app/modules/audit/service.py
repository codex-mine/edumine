import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.schemas import PaginationParams
from app.modules.audit import repository
from app.modules.audit.repository import AuditRecord


async def list_audit_logs(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    subject_id: uuid.UUID | None = None,
    profile_id: uuid.UUID | None = None,
    pagination: PaginationParams,
) -> tuple[list[AuditRecord], int]:
    return await repository.list_audit_logs(
        db,
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        date_from=date_from,
        date_to=date_to,
        subject_id=subject_id,
        profile_id=profile_id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
