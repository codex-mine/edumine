from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import EmploymentStatus, pg_enum
from app.db.base import Base


class Teacher(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "teachers"

    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    employee_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    joining_date: Mapped[date] = mapped_column(Date, nullable=False)
    designation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qualification: Mapped[str | None] = mapped_column(Text, nullable=True)
    nid_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    nid_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    previous_employment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[EmploymentStatus] = mapped_column(
        pg_enum(EmploymentStatus, "employment_status"),
        nullable=False,
        default=EmploymentStatus.active,
        server_default=text("'active'"),
    )


class TeacherQualification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "teacher_qualifications"

    teacher_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False
    )
    education_title: Mapped[str] = mapped_column(String(150), nullable=False)
    institute: Mapped[str] = mapped_column(String(200), nullable=False)
    grade: Mapped[str | None] = mapped_column(String(30), nullable=True)
    passing_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    additional_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    certificate_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    marksheet_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
