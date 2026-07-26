from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import ExamStatus, pg_enum
from app.db.base import Base


class Exam(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "exams"

    academic_year_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    term: Mapped[str | None] = mapped_column(String(30), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ExamStatus] = mapped_column(
        pg_enum(ExamStatus, "exam_status"),
        nullable=False,
        default=ExamStatus.draft,
        server_default=text("'draft'"),
    )
    created_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class ExamClass(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "exam_classes"
    __table_args__ = (UniqueConstraint("exam_id", "class_id", name="uq_exam_classes_exam_class"),)

    exam_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)


class ExamSubject(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "exam_subjects"
    __table_args__ = (
        UniqueConstraint(
            "exam_id", "class_id", "subject_id", name="uq_exam_subjects_exam_class_subject"
        ),
        Index("ix_exam_subjects_teacher_deadline", "teacher_id", "question_deadline"),
    )

    exam_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    teacher_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    full_marks: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    pass_marks: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    question_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    question_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    questions_payload: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    marks_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    marks_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
