from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import AttendanceStatus, pg_enum
from app.db.base import Base


class BiometricDevice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "biometric_devices"

    device_serial: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))


class AttendancePunch(Base, UUIDPrimaryKeyMixin, CreatedAtMixin):
    """Immutable raw punch log from biometric devices. Source of truth."""

    __tablename__ = "attendance_punches"
    __table_args__ = (
        Index("ix_attendance_punches_user_punched", "user_id", "punched_at"),
        Index("ix_attendance_punches_device_punched", "device_id", "punched_at"),
    )

    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    device_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("biometric_devices.id"), nullable=False
    )
    punched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class DailyAttendance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Derived, one row per person per day."""

    __tablename__ = "daily_attendance"
    __table_args__ = (
        UniqueConstraint("user_id", "attendance_date", name="uq_daily_attendance_user_date"),
        Index("ix_daily_attendance_date", "attendance_date"),
    )

    user_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    entry_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exit_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        pg_enum(AttendanceStatus, "attendance_status"), nullable=False
    )


class ClassAttendance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Subject-wise, period-wise attendance marked manually by the teacher."""

    __tablename__ = "class_attendance"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "routine_slot_id", "attendance_date", name="uq_class_attendance_student_slot_date"
        ),
        Index("ix_class_attendance_date_slot", "attendance_date", "routine_slot_id"),
    )

    student_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    routine_slot_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("routine_slots.id"), nullable=False
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(
        pg_enum(AttendanceStatus, "attendance_status"), nullable=False
    )
    marked_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    marked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now()
    )
