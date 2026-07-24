from datetime import date

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import EnrollmentStatus, pg_enum
from app.db.base import Base


class AcademicYear(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "academic_years"
    __table_args__ = (
        Index(
            "ux_academic_years_single_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )

    name: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    cloned_from_year_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=True
    )


class Class(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "classes"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    numeric_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class Room(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "rooms"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    capacity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)


class Subject(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)


class Section(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sections"
    __table_args__ = (
        UniqueConstraint("academic_year_id", "class_id", "name", name="uq_sections_year_class_name"),
    )

    academic_year_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    room_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(20), nullable=False)
    capacity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    class_teacher_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=True
    )


class ClassSubject(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "class_subjects"
    __table_args__ = (
        UniqueConstraint(
            "academic_year_id", "class_id", "subject_id", name="uq_class_subjects_year_class_subject"
        ),
    )

    academic_year_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    teacher_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=True
    )
    full_marks: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=100, server_default=text("100"))


class StudentEnrollment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "student_enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "academic_year_id", name="uq_student_enrollments_student_year"),
        UniqueConstraint("section_id", "roll_number", name="uq_student_enrollments_section_roll"),
        Index("ix_student_enrollments_year_section", "academic_year_id", "section_id"),
    )

    student_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    academic_year_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    roll_number: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[EnrollmentStatus] = mapped_column(
        pg_enum(EnrollmentStatus, "enrollment_status"),
        nullable=False,
        default=EnrollmentStatus.active,
        server_default=text("'active'"),
    )
