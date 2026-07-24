from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import PayrollStatus, PayslipStatus, pg_enum
from app.db.base import Base

_EXACTLY_ONE_EMPLOYEE = (
    "(teacher_id IS NOT NULL AND staff_id IS NULL) OR (teacher_id IS NULL AND staff_id IS NOT NULL)"
)


class SalaryStructure(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Current salary configuration per employee (teacher or staff)."""

    __tablename__ = "salary_structures"
    __table_args__ = (
        CheckConstraint(_EXACTLY_ONE_EMPLOYEE, name="ck_salary_structures_exactly_one_employee"),
        CheckConstraint("basic_salary >= 0", name="ck_salary_structures_basic_salary_non_negative"),
        CheckConstraint("allowances >= 0", name="ck_salary_structures_allowances_non_negative"),
        CheckConstraint("deductions >= 0", name="ck_salary_structures_deductions_non_negative"),
    )

    teacher_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=True
    )
    staff_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    allowances: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)


class PayrollRun(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payroll_runs"
    __table_args__ = (
        UniqueConstraint("period_month", "period_year", name="uq_payroll_runs_period"),
    )

    period_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[PayrollStatus] = mapped_column(
        pg_enum(PayrollStatus, "payroll_status"),
        nullable=False,
        default=PayrollStatus.draft,
        server_default=text("'draft'"),
    )
    generated_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class Payslip(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payslips"
    __table_args__ = (
        CheckConstraint(_EXACTLY_ONE_EMPLOYEE, name="ck_payslips_exactly_one_employee"),
        CheckConstraint("gross_amount >= 0", name="ck_payslips_gross_amount_non_negative"),
        CheckConstraint("deductions >= 0", name="ck_payslips_deductions_non_negative"),
        CheckConstraint("net_amount >= 0", name="ck_payslips_net_amount_non_negative"),
    )

    payroll_run_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False
    )
    teacher_id: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=True
    )
    staff_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True)
    gross_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    net_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[PayslipStatus] = mapped_column(
        pg_enum(PayslipStatus, "payslip_status"),
        nullable=False,
        default=PayslipStatus.pending,
        server_default=text("'pending'"),
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
