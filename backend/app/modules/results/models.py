from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import PublicationStatus, pg_enum
from app.db.base import Base


class ExamResult(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Per-student marks for a given exam subject."""

    __tablename__ = "exam_results"
    __table_args__ = (
        UniqueConstraint("exam_subject_id", "student_id", name="uq_exam_results_subject_student"),
    )

    exam_subject_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_subjects.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    marks_obtained: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(5), nullable=True)
    is_absent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    entered_by: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    entered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ResultPublication(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Approval/publish workflow gate at the exam level."""

    __tablename__ = "result_publications"

    exam_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[PublicationStatus] = mapped_column(
        pg_enum(PublicationStatus, "publication_status"),
        nullable=False,
        default=PublicationStatus.pending,
        server_default=text("'pending'"),
    )
    submitted_by: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
