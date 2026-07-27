import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.common.enums import DiscountType, InvoiceStatus, PaymentMethod


class CreateFeeTypeRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    is_recurring: bool = False


class UpdateFeeTypeRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    is_recurring: bool | None = None


class FeeTypeResponse(BaseModel):
    id: str
    name: str
    is_recurring: bool


class FeeStructureItemInput(BaseModel):
    fee_type_id: uuid.UUID
    amount: float = Field(..., ge=0)


class SetFeeStructureRequest(BaseModel):
    academic_year_id: uuid.UUID
    class_id: uuid.UUID
    items: list[FeeStructureItemInput] = Field(..., min_length=1)


class FeeStructureItemResponse(BaseModel):
    id: str
    academic_year_id: str
    class_id: str
    class_name: str
    fee_type_id: str
    fee_type_name: str
    is_recurring: bool
    amount: float


class GenerateInvoiceRequest(BaseModel):
    fee_type_ids: list[uuid.UUID] = Field(..., min_length=1)
    due_date: date
    academic_year_id: uuid.UUID | None = None


class InvoiceItemResponse(BaseModel):
    id: str
    fee_type_id: str
    fee_type_name: str
    description: str | None
    amount: float


class DiscountResponse(BaseModel):
    id: str
    discount_type: DiscountType
    value: float
    amount: float
    reason: str | None
    approved_by: str | None
    created_at: datetime


class PaymentResponse(BaseModel):
    id: str
    amount: float
    method: PaymentMethod
    transaction_reference: str | None
    received_by: str
    received_by_name: str
    paid_at: datetime


class InvoiceSummaryResponse(BaseModel):
    id: str
    invoice_number: str
    student_id: str
    student_name: str
    admission_number: str
    academic_year_id: str
    subtotal: float
    discount_total: float
    total_amount: float
    paid_amount: float
    due_amount: float
    status: InvoiceStatus
    due_date: date
    created_at: datetime


class InvoiceDetailResponse(InvoiceSummaryResponse):
    issued_by: str
    items: list[InvoiceItemResponse]
    discounts: list[DiscountResponse]
    payments: list[PaymentResponse]


class GenerateInvoicesForClassResponse(BaseModel):
    class_id: str
    class_name: str
    created: list[InvoiceSummaryResponse]
    skipped_student_ids: list[str]


class AddDiscountRequest(BaseModel):
    discount_type: DiscountType
    value: float = Field(..., gt=0)
    reason: str | None = Field(default=None, max_length=255)


class RecordPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: PaymentMethod
    transaction_reference: str | None = Field(default=None, max_length=100)


class ReceiptResponse(BaseModel):
    payment: PaymentResponse
    invoice: InvoiceDetailResponse


class DuesSummaryResponse(BaseModel):
    student_id: str
    student_name: str
    admission_number: str
    total_due: float
    outstanding_invoices: list[InvoiceSummaryResponse]
