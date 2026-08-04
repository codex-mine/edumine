from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import OmrBatchStatus, OmrMatchStatus, OmrSheetStatus, pg_enum
from app.db.base import Base


class OmrAnswerKey(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """The correct answers for one set-code variant of an exam subject's MCQ paper.

    Keyed per set code because the answer sheet carries a Set Code field
    (Ka/Kha/Ga/Gha/Nga/Cha) so one exam can be sat with shuffled question orders.
    `answers` holds either the simple form {"1": "Ka"} or the extended form
    {"1": {"correct": "Ka", "marks": 1, "negative": 0.25}}; `marks_per_correct`
    and `negative_marks` are the defaults applied to entries that don't carry
    their own.
    """

    __tablename__ = "omr_answer_keys"
    __table_args__ = (
        UniqueConstraint("exam_subject_id", "set_code", name="uq_omr_answer_keys_subject_set"),
    )

    exam_subject_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_subjects.id", ondelete="CASCADE"), nullable=False
    )
    set_code: Mapped[str] = mapped_column(String(10), nullable=False, default="Ka", server_default=text("'Ka'"))
    total_questions: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    marks_per_correct: Mapped[float] = mapped_column(
        Numeric(4, 2), nullable=False, default=1, server_default=text("1")
    )
    negative_marks: Mapped[float] = mapped_column(
        Numeric(4, 2), nullable=False, default=0, server_default=text("0")
    )
    created_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class OmrBatch(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One scanning run against a single exam subject.

    `mcq_full_marks` is snapshotted at creation from the exam subject's mark
    scheme (see D2 in docs/omr-implementation.md) so that later edits to the
    exam configuration cannot retroactively rescale sheets already scored.
    `template_name` is stored per batch so a second sheet template can be
    introduced without a migration.
    """

    __tablename__ = "omr_batches"

    exam_subject_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_subjects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[OmrBatchStatus] = mapped_column(
        pg_enum(OmrBatchStatus, "omr_batch_status"),
        nullable=False,
        default=OmrBatchStatus.draft,
        server_default=text("'draft'"),
    )
    template_name: Mapped[str] = mapped_column(String(60), nullable=False)
    mcq_full_marks: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    sheet_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default=text("0"))
    processed_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default=text("0"))
    matched_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default=text("0"))
    failed_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default=text("0"))
    uploaded_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    applied_by: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OmrSheet(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One scanned answer sheet: where its image lives, what the pipeline read
    off it, which student it resolved to, and what it scored.

    Detected values are kept alongside the resolved `student_id` rather than
    being discarded after matching — a reviewer needs to see what the scanner
    actually read in order to judge a flagged sheet, and re-running the match
    must not depend on re-reading the image.
    """

    __tablename__ = "omr_sheets"
    __table_args__ = (
        Index("ix_omr_sheets_batch_status", "batch_id", "status"),
        Index("ix_omr_sheets_batch_student", "batch_id", "student_id"),
    )

    batch_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("omr_batches.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[OmrSheetStatus] = mapped_column(
        pg_enum(OmrSheetStatus, "omr_sheet_status"),
        nullable=False,
        default=OmrSheetStatus.pending,
        server_default=text("'pending'"),
    )
    match_status: Mapped[OmrMatchStatus | None] = mapped_column(
        pg_enum(OmrMatchStatus, "omr_match_status"), nullable=True
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    image_public_id: Mapped[str] = mapped_column(String(255), nullable=False)
    annotated_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    annotated_public_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    detected_class: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    detected_roll: Mapped[str | None] = mapped_column(String(20), nullable=True)
    detected_subject_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    detected_set_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    alignment_method: Mapped[str | None] = mapped_column(String(30), nullable=True)

    student_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=True
    )
    matched_manually: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    correct_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    wrong_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    blank_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    multiple_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    marks_obtained: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    percentage: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    score_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
