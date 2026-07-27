import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission, require_role
from app.common.enums import AudienceType
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.communication import service
from app.modules.communication.schemas import CreateAnnouncementRequest, DraftAnnouncementRequest

router = APIRouter(prefix="/communication", tags=["communication"])


# --- Sections (read-only lookup for the audience picker) ------------------------------------


@router.get("/sections", dependencies=[Depends(require_permission("communication.manage"))])
async def list_sections(db: AsyncSession = Depends(get_db_session)):
    data = await service.list_sections(db)
    return success_response(data=data, message="Sections retrieved")


# --- Announcements -------------------------------------------------------------------------


@router.post("/announcements", dependencies=[Depends(require_permission("communication.manage"))])
async def create_announcement(
    payload: CreateAnnouncementRequest,
    current_user: CurrentUser = Depends(require_permission("communication.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.create_announcement(db, current_user, payload)
    return success_response(data=data, message="Announcement sent", status_code=201)


@router.get("/announcements/sent", dependencies=[Depends(require_permission("communication.manage"))])
async def list_sent_announcements(
    audience_type: AudienceType | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_sent_announcements(db, audience_type=audience_type, page=page, limit=limit)
    meta = pagination_meta(PaginationParams(page=page, limit=limit), total)
    return success_response(data=items, message="Sent announcements retrieved", meta=meta)


@router.get("/announcements/inbox", dependencies=[Depends(require_permission("communication.view"))])
async def list_inbox_announcements(
    current_user: CurrentUser = Depends(require_permission("communication.view")),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_inbox_announcements(db, current_user, page=page, limit=limit)
    meta = pagination_meta(PaginationParams(page=page, limit=limit), total)
    return success_response(data=items, message="Announcements retrieved", meta=meta)


@router.get("/announcements/{announcement_id}", dependencies=[Depends(require_permission("communication.view"))])
async def get_announcement(
    announcement_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("communication.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_announcement_detail(db, current_user, announcement_id)
    return success_response(data=data, message="Announcement retrieved")


@router.post("/announcements/{announcement_id}/read", dependencies=[Depends(require_permission("communication.view"))])
async def mark_announcement_read(
    announcement_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("communication.view")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.mark_announcement_read(db, current_user, announcement_id)
    return success_response(data=None, message="Marked as read")


@router.get(
    "/announcements/{announcement_id}/sms-logs", dependencies=[Depends(require_permission("communication.manage"))]
)
async def get_announcement_sms_logs(announcement_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    data = await service.get_announcement_sms_logs(db, announcement_id)
    return success_response(data=data, message="SMS delivery status retrieved")


# --- AI draft-assist (Admin/Principal only — require_role("admin") also allows
# Principal via CurrentUser.has_role's built-in Principal bypass) -------------------------


@router.post("/announcements/draft", dependencies=[Depends(require_role("admin"))])
async def draft_announcement(payload: DraftAnnouncementRequest):
    draft = await service.draft_announcement(payload)
    return success_response(data=draft, message="Draft ready for your review — edit before sending")
