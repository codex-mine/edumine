from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import AudienceType, SmsStatus, pg_enum
from app.db.base import Base


class Announcement(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "announcements"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    audience_type: Mapped[AudienceType] = mapped_column(
        pg_enum(AudienceType, "audience_type"), nullable=False
    )
    section_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)
    created_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AnnouncementRecipient(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "announcement_recipients"
    __table_args__ = (
        UniqueConstraint("announcement_id", "user_id", name="uq_announcement_recipients_announcement_user"),
    )

    announcement_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SmsLog(Base, UUIDPrimaryKeyMixin, CreatedAtMixin):
    __tablename__ = "sms_logs"

    recipient_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SmsStatus] = mapped_column(
        pg_enum(SmsStatus, "sms_status"),
        nullable=False,
        default=SmsStatus.queued,
        server_default=text("'queued'"),
    )
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
