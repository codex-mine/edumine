from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import CreatedAtMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import DiscountType, InvoiceStatus, PaymentMethod, pg_enum
from app.db.base import Base


class FeeType(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "fee_types"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))


class ClassFeeStructure(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "class_fee_structures"
    __table_args__ = (
        UniqueConstraint(
            "academic_year_id", "class_id", "fee_type_id", name="uq_class_fee_structures_year_class_fee"
        ),
        CheckConstraint("amount >= 0", name="ck_class_fee_structures_amount_non_negative"),
    )

    academic_year_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False
    )
    class_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    fee_type_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_types.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)


class Invoice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoices_student_status", "student_id", "status"),
        Index("ix_invoices_due_date_unpaid", "due_date", postgresql_where=text("status != 'paid'")),
        CheckConstraint("subtotal >= 0", name="ck_invoices_subtotal_non_negative"),
        CheckConstraint("discount_total >= 0", name="ck_invoices_discount_total_non_negative"),
        CheckConstraint("total_amount >= 0", name="ck_invoices_total_amount_non_negative"),
        CheckConstraint("paid_amount >= 0", name="ck_invoices_paid_amount_non_negative"),
        CheckConstraint("due_amount >= 0", name="ck_invoices_due_amount_non_negative"),
    )

    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    student_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    academic_year_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount_total: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default=text("0")
    )
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    paid_amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default=text("0")
    )
    due_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(
        pg_enum(InvoiceStatus, "invoice_status"),
        nullable=False,
        default=InvoiceStatus.unpaid,
        server_default=text("'unpaid'"),
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    issued_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class InvoiceItem(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "invoice_items"
    __table_args__ = (CheckConstraint("amount >= 0", name="ck_invoice_items_amount_non_negative"),)

    invoice_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    fee_type_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fee_types.id"), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)


class Discount(Base, UUIDPrimaryKeyMixin, CreatedAtMixin):
    __tablename__ = "discounts"
    __table_args__ = (CheckConstraint("value >= 0", name="ck_discounts_value_non_negative"),)

    invoice_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    discount_type: Mapped[DiscountType] = mapped_column(pg_enum(DiscountType, "discount_type"), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_by: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class Payment(Base, UUIDPrimaryKeyMixin, CreatedAtMixin):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_invoice_id", "invoice_id"),
        Index("ix_payments_paid_at", "paid_at"),
        CheckConstraint("amount >= 0", name="ck_payments_amount_non_negative"),
    )

    invoice_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(pg_enum(PaymentMethod, "payment_method"), nullable=False)
    transaction_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    received_by: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), server_default=func.now()
    )
