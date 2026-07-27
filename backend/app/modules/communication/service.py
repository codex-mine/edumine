import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import AudienceType, SmsStatus
from app.core import sms as sms_gateway
from app.core.exceptions import NotFoundException, PermissionDeniedException, ValidationException
from app.modules.communication import ai_service, repository
from app.modules.communication.models import Announcement
from app.modules.communication.schemas import CreateAnnouncementRequest, DraftAnnouncementRequest

# --- Sections (read-only lookup for the audience picker) ------------------------------------


async def list_sections(db: AsyncSession) -> list[dict]:
    rows = await repository.list_active_year_sections(db)
    return [
        {"id": str(section.id), "name": section.name, "class_name": class_name, "label": f"{class_name} - {section.name}"}
        for section, class_name in rows
    ]


# --- Response builders ---------------------------------------------------------------------


async def _announcement_response(
    db: AsyncSession, announcement: Announcement, sender_name: str, *, read_at: datetime | None = None
) -> dict:
    section_label = await repository.get_section_label(db, announcement.section_id) if announcement.section_id else None
    return {
        "id": str(announcement.id),
        "title": announcement.title,
        "body": announcement.body,
        "audience_type": announcement.audience_type,
        "section_id": str(announcement.section_id) if announcement.section_id else None,
        "section_label": section_label,
        "created_by": str(announcement.created_by),
        "created_by_name": sender_name,
        "published_at": announcement.published_at.isoformat() if announcement.published_at else None,
        "recipient_count": await repository.recipient_count(db, announcement.id),
        "read_at": read_at.isoformat() if read_at else None,
        "created_at": announcement.created_at.isoformat(),
    }


def _sms_log_response(log) -> dict:
    return {
        "id": str(log.id),
        "recipient_phone": log.recipient_phone,
        "message": log.message,
        "status": log.status,
        "sent_at": log.sent_at.isoformat() if log.sent_at else None,
        "created_at": log.created_at.isoformat(),
    }


# --- Announcements -------------------------------------------------------------------------


async def create_announcement(db: AsyncSession, actor: CurrentUser, payload: CreateAnnouncementRequest) -> dict:
    if payload.audience_type == AudienceType.specific_class:
        section = await repository.get_section(db, payload.section_id)  # type: ignore[arg-type]
        if section is None:
            raise NotFoundException("Section not found")

    recipient_ids = await repository.resolve_audience_user_ids(
        db, audience_type=payload.audience_type, section_id=payload.section_id
    )

    announcement = await repository.create_announcement(
        db,
        title=payload.title,
        body=payload.body,
        audience_type=payload.audience_type,
        section_id=payload.section_id,
        created_by=actor.id,
        published_at=datetime.now(timezone.utc),
    )
    await repository.bulk_create_recipients(db, announcement_id=announcement.id, user_ids=recipient_ids)

    sms_summary = {"attempted": 0, "sent": 0, "failed": 0}
    if payload.send_sms:
        recipients_with_phone = await repository.get_recipients_with_phone(db, announcement.id)
        for _user_id, phone in recipients_with_phone:
            result = await sms_gateway.send_sms(phone, payload.sms_message)  # type: ignore[arg-type]
            await repository.create_sms_log(
                db,
                recipient_phone=phone,
                message=payload.sms_message,  # type: ignore[arg-type]
                status=result.status,
                sent_at=result.sent_at,
                related_entity_type="announcement",
                related_entity_id=announcement.id,
            )
            sms_summary["attempted"] += 1
            if result.status == SmsStatus.sent:
                sms_summary["sent"] += 1
            else:
                sms_summary["failed"] += 1

    await record_audit_log(
        db, actor_id=actor.id, action="create", entity_type="announcement", entity_id=announcement.id,
        new_value={
            "title": payload.title,
            "audience_type": payload.audience_type.value,
            "section_id": str(payload.section_id) if payload.section_id else None,
            "recipient_count": len(recipient_ids),
            "sms_dispatched": payload.send_sms,
        },
    )
    await db.commit()

    response = await _announcement_response(db, announcement, actor.full_name)
    response["sms_summary"] = sms_summary if payload.send_sms else None
    return response


async def _get_announcement_with_sender_or_404(db: AsyncSession, announcement_id: uuid.UUID) -> tuple[Announcement, str]:
    row = await repository.get_announcement_with_sender(db, announcement_id)
    if row is None:
        raise NotFoundException("Announcement not found")
    return row


async def _assert_can_view(db: AsyncSession, actor: CurrentUser, announcement: Announcement) -> None:
    if actor.has_permission("communication.manage"):
        return
    if announcement.created_by == actor.id:
        return
    if await repository.is_recipient(db, announcement.id, actor.id):
        return
    raise PermissionDeniedException("This announcement is not addressed to you")


async def get_announcement_detail(db: AsyncSession, actor: CurrentUser, announcement_id: uuid.UUID) -> dict:
    announcement, sender_name = await _get_announcement_with_sender_or_404(db, announcement_id)
    await _assert_can_view(db, actor, announcement)
    return await _announcement_response(db, announcement, sender_name)


async def list_sent_announcements(
    db: AsyncSession, *, audience_type: AudienceType | None, page: int, limit: int
) -> tuple[list[dict], int]:
    rows, total = await repository.list_sent_announcements(
        db, audience_type=audience_type, offset=(page - 1) * limit, limit=limit
    )
    return [await _announcement_response(db, announcement, sender_name) for announcement, sender_name in rows], total


async def list_inbox_announcements(db: AsyncSession, actor: CurrentUser, *, page: int, limit: int) -> tuple[list[dict], int]:
    rows, total = await repository.list_inbox_announcements(
        db, user_id=actor.id, offset=(page - 1) * limit, limit=limit
    )
    return [
        await _announcement_response(db, announcement, sender_name, read_at=read_at)
        for announcement, sender_name, read_at in rows
    ], total


async def mark_announcement_read(db: AsyncSession, actor: CurrentUser, announcement_id: uuid.UUID) -> None:
    announcement, _sender_name = await _get_announcement_with_sender_or_404(db, announcement_id)
    if not await repository.is_recipient(db, announcement.id, actor.id):
        raise PermissionDeniedException("This announcement is not addressed to you")
    await repository.mark_recipient_read(db, announcement_id=announcement.id, user_id=actor.id)
    await db.commit()


async def get_announcement_sms_logs(db: AsyncSession, announcement_id: uuid.UUID) -> list[dict]:
    await _get_announcement_with_sender_or_404(db, announcement_id)
    logs = await repository.list_sms_logs_for_entity(db, related_entity_type="announcement", related_entity_id=announcement_id)
    return [_sms_log_response(log) for log in logs]


# --- AI draft-assist -----------------------------------------------------------------------


async def draft_announcement(payload: DraftAnnouncementRequest) -> dict:
    data_scope = f"drafting a '{payload.audience_type.value}' announcement — no student, staff, or financial records are accessed"
    try:
        return await ai_service.draft_announcement(
            topic=payload.topic,
            audience_type=payload.audience_type.value,
            details=payload.details,
            tone=payload.tone,
            char_limit=payload.char_limit,
            data_scope=data_scope,
        )
    except ai_service.AIDraftUnavailable as exc:
        raise ValidationException(exc.message) from exc
