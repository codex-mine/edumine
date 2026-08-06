import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db_session, get_pagination, require_permission
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.audit import service
from app.modules.audit.schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["audit"])


def _to_response(record) -> dict:
    log, actor_name = record
    return AuditLogResponse(
        id=str(log.id),
        actor_id=str(log.actor_id) if log.actor_id else None,
        actor_name=actor_name,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=str(log.entity_id),
        old_value=log.old_value,
        new_value=log.new_value,
        created_at=log.created_at,
    ).model_dump(mode="json")


@router.get("/logs", dependencies=[Depends(require_permission("audit.view"))])
async def list_audit_logs(
    actor_id: uuid.UUID | None = Query(default=None, description="Only actions performed by this user"),
    entity_type: str | None = Query(default=None, max_length=50),
    entity_id: uuid.UUID | None = Query(default=None),
    subject_id: uuid.UUID | None = Query(
        default=None,
        description="A person's user id — actions they performed, plus actions taken against their user record",
    ),
    profile_id: uuid.UUID | None = Query(
        default=None,
        description="Their student/teacher profile id, which those modules log against instead of the user id",
    ),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_audit_logs(
        db,
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        subject_id=subject_id,
        profile_id=profile_id,
        date_from=date_from,
        date_to=date_to,
        pagination=pagination,
    )
    return success_response(
        data=[_to_response(item) for item in items],
        message="Audit logs retrieved",
        meta=pagination_meta(pagination, total),
    )
