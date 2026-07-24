from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text, text
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
    status: Mapped[EmploymentStatus] = mapped_column(
        pg_enum(EmploymentStatus, "employment_status"),
        nullable=False,
        default=EmploymentStatus.active,
        server_default=text("'active'"),
    )
