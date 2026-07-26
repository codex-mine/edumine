from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import BloodGroupType, StudentStatus, pg_enum
from app.db.base import Base


class Student(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "students"

    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    admission_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    admission_date: Mapped[date] = mapped_column(Date, nullable=False)
    blood_group: Mapped[BloodGroupType | None] = mapped_column(pg_enum(BloodGroupType, "blood_group"), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[StudentStatus] = mapped_column(
        pg_enum(StudentStatus, "student_status"),
        nullable=False,
        default=StudentStatus.active,
        server_default=text("'active'"),
    )


class StudentGuardian(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "student_guardians"
    __table_args__ = (UniqueConstraint("student_id", "guardian_id", name="uq_student_guardians_student_guardian"),)

    student_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    guardian_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False
    )
    relation: Mapped[str] = mapped_column(String(30), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
