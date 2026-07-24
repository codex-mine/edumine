from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import ApprovalStatus, pg_enum
from app.db.base import Base


class ExpenseCategory(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "expense_categories"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class Expense(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_status_date", "status", "expense_date"),
        CheckConstraint("amount >= 0", name="ck_expenses_amount_non_negative"),
    )

    category_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expense_categories.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[ApprovalStatus] = mapped_column(
        pg_enum(ApprovalStatus, "approval_status"),
        nullable=False,
        default=ApprovalStatus.pending,
        server_default=text("'pending'"),
    )
    approved_by: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
