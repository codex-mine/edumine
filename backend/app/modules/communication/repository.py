import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import AudienceType, EnrollmentStatus, SmsStatus
from app.modules.academic.models import AcademicYear, Class, Section, StudentEnrollment
from app.modules.auth.models import Role, User
from app.modules.communication.models import Announcement, AnnouncementRecipient, SmsLog
from app.modules.guardians.models import Guardian
from app.modules.students.models import Student, StudentGuardian

# --- Announcements -----------------------------------------------------------------------


async def get_section(db: AsyncSession, section_id: uuid.UUID) -> Section | None:
    result = await db.execute(select(Section).where(Section.id == section_id, Section.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_section_label(db: AsyncSession, section_id: uuid.UUID) -> str | None:
    result = await db.execute(
        select(Class.name, Section.name).join(Class, Class.id == Section.class_id).where(Section.id == section_id)
    )
    row = result.first()
    return f"{row[0]} - {row[1]}" if row else None


async def list_active_year_sections(db: AsyncSession) -> list[tuple[Section, str]]:
    """Read-only section lookup for the announcement composer's audience picker.

    Scoped to this module (rather than requiring academic.view) so Receptionist,
    who holds communication.manage but not academic.view, can still target a
    specific class/section — same rationale as assets.rooms in Phase 13.
    """
    result = await db.execute(
        select(Section, Class.name)
        .join(Class, Class.id == Section.class_id)
        .join(AcademicYear, AcademicYear.id == Section.academic_year_id)
        .where(Section.deleted_at.is_(None), AcademicYear.is_active.is_(True))
        .order_by(Class.name.asc(), Section.name.asc())
    )
    return list(result.all())


async def create_announcement(
    db: AsyncSession,
    *,
    title: str,
    body: str,
    audience_type: AudienceType,
    section_id: uuid.UUID | None,
    created_by: uuid.UUID,
    published_at: datetime,
) -> Announcement:
    entity = Announcement(
        title=title, body=body, audience_type=audience_type, section_id=section_id,
        created_by=created_by, published_at=published_at,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_announcement(db: AsyncSession, announcement_id: uuid.UUID) -> Announcement | None:
    result = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
    return result.scalar_one_or_none()


async def get_announcement_with_sender(db: AsyncSession, announcement_id: uuid.UUID) -> tuple[Announcement, str] | None:
    result = await db.execute(
        select(Announcement, User.full_name)
        .join(User, User.id == Announcement.created_by)
        .where(Announcement.id == announcement_id)
    )
    return result.first()


async def list_sent_announcements(
    db: AsyncSession, *, audience_type: AudienceType | None, offset: int, limit: int
) -> tuple[list[tuple[Announcement, str]], int]:
    filters = []
    if audience_type is not None:
        filters.append(Announcement.audience_type == audience_type)

    count_result = await db.execute(select(func.count()).select_from(Announcement).where(*filters))
    total = count_result.scalar_one()

    result = await db.execute(
        select(Announcement, User.full_name)
        .join(User, User.id == Announcement.created_by)
        .where(*filters)
        .order_by(Announcement.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def recipient_count(db: AsyncSession, announcement_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(AnnouncementRecipient).where(AnnouncementRecipient.announcement_id == announcement_id)
    )
    return result.scalar_one()


# --- Audience resolution -----------------------------------------------------------------

_ROLE_AUDIENCE_MAP: dict[AudienceType, list[str]] = {
    AudienceType.students: ["student"],
    AudienceType.teachers: ["teacher"],
    # "staff" targets every non-teaching staff sub-role (Accountant/Receptionist are
    # staff sub-roles per requirements.md 3.4), not only the generic "staff" role.
    AudienceType.staff: ["staff", "accountant", "receptionist"],
    AudienceType.guardians: ["guardian"],
}


async def resolve_audience_user_ids(
    db: AsyncSession, *, audience_type: AudienceType, section_id: uuid.UUID | None
) -> list[uuid.UUID]:
    if audience_type == AudienceType.all:
        result = await db.execute(select(User.id).where(User.deleted_at.is_(None), User.is_active.is_(True)))
        return list(result.scalars().all())

    if audience_type == AudienceType.specific_class:
        return await _resolve_specific_class_user_ids(db, section_id)

    role_names = _ROLE_AUDIENCE_MAP[audience_type]
    result = await db.execute(
        select(User.id)
        .join(Role, Role.id == User.role_id)
        .where(Role.name.in_(role_names), User.deleted_at.is_(None), User.is_active.is_(True))
    )
    return list(result.scalars().all())


async def _resolve_specific_class_user_ids(db: AsyncSession, section_id: uuid.UUID | None) -> list[uuid.UUID]:
    if section_id is None:
        return []

    active_year = (await db.execute(select(AcademicYear.id).where(AcademicYear.is_active.is_(True)))).scalar_one_or_none()
    enrollment_filters = [StudentEnrollment.section_id == section_id, StudentEnrollment.status == EnrollmentStatus.active]
    if active_year is not None:
        enrollment_filters.append(StudentEnrollment.academic_year_id == active_year)

    student_ids_result = await db.execute(
        select(StudentEnrollment.student_id).where(*enrollment_filters).distinct()
    )
    student_ids = list(student_ids_result.scalars().all())
    if not student_ids:
        return []

    student_user_ids_result = await db.execute(
        select(Student.user_id).where(
            Student.id.in_(student_ids), Student.deleted_at.is_(None)
        )
    )
    student_user_ids = list(student_user_ids_result.scalars().all())

    guardian_user_ids_result = await db.execute(
        select(Guardian.user_id)
        .join(StudentGuardian, StudentGuardian.guardian_id == Guardian.id)
        .where(StudentGuardian.student_id.in_(student_ids), Guardian.deleted_at.is_(None))
        .distinct()
    )
    guardian_user_ids = list(guardian_user_ids_result.scalars().all())

    return list({*student_user_ids, *guardian_user_ids})


async def bulk_create_recipients(db: AsyncSession, *, announcement_id: uuid.UUID, user_ids: list[uuid.UUID]) -> None:
    if not user_ids:
        return
    await db.execute(
        pg_insert(AnnouncementRecipient)
        .values([{"announcement_id": announcement_id, "user_id": user_id} for user_id in user_ids])
        .on_conflict_do_nothing(constraint="uq_announcement_recipients_announcement_user")
    )
    await db.flush()


async def get_recipients_with_phone(db: AsyncSession, announcement_id: uuid.UUID) -> list[tuple[uuid.UUID, str]]:
    result = await db.execute(
        select(User.id, User.phone)
        .join(AnnouncementRecipient, AnnouncementRecipient.user_id == User.id)
        .where(AnnouncementRecipient.announcement_id == announcement_id)
    )
    return list(result.all())


async def is_recipient(db: AsyncSession, announcement_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(AnnouncementRecipient.id).where(
            AnnouncementRecipient.announcement_id == announcement_id, AnnouncementRecipient.user_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None


async def list_inbox_announcements(
    db: AsyncSession, *, user_id: uuid.UUID, offset: int, limit: int
) -> tuple[list[tuple[Announcement, str, datetime | None]], int]:
    count_result = await db.execute(
        select(func.count())
        .select_from(AnnouncementRecipient)
        .join(Announcement, Announcement.id == AnnouncementRecipient.announcement_id)
        .where(AnnouncementRecipient.user_id == user_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Announcement, User.full_name, AnnouncementRecipient.read_at)
        .join(AnnouncementRecipient, AnnouncementRecipient.announcement_id == Announcement.id)
        .join(User, User.id == Announcement.created_by)
        .where(AnnouncementRecipient.user_id == user_id)
        .order_by(Announcement.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def mark_recipient_read(db: AsyncSession, *, announcement_id: uuid.UUID, user_id: uuid.UUID) -> None:
    recipient = await db.execute(
        select(AnnouncementRecipient).where(
            AnnouncementRecipient.announcement_id == announcement_id, AnnouncementRecipient.user_id == user_id
        )
    )
    entity = recipient.scalar_one_or_none()
    if entity is not None and entity.read_at is None:
        entity.read_at = func.now()
        await db.flush()


# --- SMS logs --------------------------------------------------------------------------


async def create_sms_log(
    db: AsyncSession,
    *,
    recipient_phone: str,
    message: str,
    status: SmsStatus,
    sent_at: datetime | None,
    related_entity_type: str | None,
    related_entity_id: uuid.UUID | None,
) -> SmsLog:
    entity = SmsLog(
        recipient_phone=recipient_phone,
        message=message,
        status=status,
        sent_at=sent_at,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    db.add(entity)
    await db.flush()
    return entity


async def list_sms_logs_for_entity(
    db: AsyncSession, *, related_entity_type: str, related_entity_id: uuid.UUID
) -> list[SmsLog]:
    result = await db.execute(
        select(SmsLog)
        .where(SmsLog.related_entity_type == related_entity_type, SmsLog.related_entity_id == related_entity_id)
        .order_by(SmsLog.created_at.asc())
    )
    return list(result.scalars().all())
