import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import EnrollmentStatus, InvoiceStatus
from app.modules.academic.models import Class, Section, StudentEnrollment
from app.modules.auth.models import User
from app.modules.billing.models import ClassFeeStructure, Discount, FeeType, Invoice, InvoiceItem, Payment
from app.modules.students.models import Student

# --- Fee types -----------------------------------------------------------------


async def get_fee_type_by_name(db: AsyncSession, name: str) -> FeeType | None:
    result = await db.execute(select(FeeType).where(FeeType.name == name, FeeType.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_fee_type(db: AsyncSession, fee_type_id: uuid.UUID) -> FeeType | None:
    result = await db.execute(
        select(FeeType).where(FeeType.id == fee_type_id, FeeType.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_fee_type(db: AsyncSession, *, name: str, is_recurring: bool) -> FeeType:
    entity = FeeType(name=name, is_recurring=is_recurring)
    db.add(entity)
    await db.flush()
    return entity


async def list_fee_types(db: AsyncSession) -> list[FeeType]:
    result = await db.execute(
        select(FeeType).where(FeeType.deleted_at.is_(None)).order_by(FeeType.name.asc())
    )
    return list(result.scalars().all())


async def update_fee_type_fields(db: AsyncSession, entity: FeeType, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def soft_delete_fee_type(db: AsyncSession, entity: FeeType) -> None:
    entity.deleted_at = func.now()
    await db.flush()


# --- Class fee structures --------------------------------------------------------

FeeStructureRow = tuple[ClassFeeStructure, Class, FeeType]


def _fee_structure_select():
    return (
        select(ClassFeeStructure, Class, FeeType)
        .join(Class, Class.id == ClassFeeStructure.class_id)
        .join(FeeType, FeeType.id == ClassFeeStructure.fee_type_id)
    )


async def get_fee_structure_by_id(db: AsyncSession, structure_id: uuid.UUID) -> ClassFeeStructure | None:
    result = await db.execute(select(ClassFeeStructure).where(ClassFeeStructure.id == structure_id))
    return result.scalar_one_or_none()


async def get_fee_structure_by_year_class_fee(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID, fee_type_id: uuid.UUID
) -> ClassFeeStructure | None:
    result = await db.execute(
        select(ClassFeeStructure).where(
            ClassFeeStructure.academic_year_id == academic_year_id,
            ClassFeeStructure.class_id == class_id,
            ClassFeeStructure.fee_type_id == fee_type_id,
        )
    )
    return result.scalar_one_or_none()


async def create_fee_structure(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID, fee_type_id: uuid.UUID, amount: float
) -> ClassFeeStructure:
    entity = ClassFeeStructure(
        academic_year_id=academic_year_id, class_id=class_id, fee_type_id=fee_type_id, amount=amount
    )
    db.add(entity)
    await db.flush()
    return entity


async def update_fee_structure_amount(db: AsyncSession, entity: ClassFeeStructure, amount: float) -> None:
    entity.amount = amount
    await db.flush()


async def list_fee_structures(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID | None
) -> list[FeeStructureRow]:
    filters = [ClassFeeStructure.academic_year_id == academic_year_id]
    if class_id is not None:
        filters.append(ClassFeeStructure.class_id == class_id)
    result = await db.execute(_fee_structure_select().where(*filters).order_by(Class.numeric_order.asc(), FeeType.name.asc()))
    return list(result.all())


async def get_fee_structures_for_class_types(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID, fee_type_ids: list[uuid.UUID]
) -> list[FeeStructureRow]:
    result = await db.execute(
        _fee_structure_select().where(
            ClassFeeStructure.academic_year_id == academic_year_id,
            ClassFeeStructure.class_id == class_id,
            ClassFeeStructure.fee_type_id.in_(fee_type_ids),
        )
    )
    return list(result.all())


async def delete_fee_structure(db: AsyncSession, entity: ClassFeeStructure) -> None:
    await db.delete(entity)
    await db.flush()


# --- Enrolled students (per class, per academic year) ---------------------------


async def list_active_students_in_class(
    db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID
) -> list[tuple[Student, User, StudentEnrollment]]:
    result = await db.execute(
        select(Student, User, StudentEnrollment)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .join(User, User.id == Student.user_id)
        .join(Section, Section.id == StudentEnrollment.section_id)
        .where(
            StudentEnrollment.academic_year_id == academic_year_id,
            Section.class_id == class_id,
            StudentEnrollment.status == EnrollmentStatus.active,
            Student.deleted_at.is_(None),
        )
        .order_by(StudentEnrollment.roll_number.asc())
    )
    return list(result.all())


# --- Invoices --------------------------------------------------------------------


async def get_invoice(db: AsyncSession, invoice_id: uuid.UUID) -> Invoice | None:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    return result.scalar_one_or_none()


async def get_invoice_with_student(db: AsyncSession, invoice_id: uuid.UUID) -> tuple[Invoice, Student, User] | None:
    result = await db.execute(
        select(Invoice, Student, User)
        .join(Student, Student.id == Invoice.student_id)
        .join(User, User.id == Student.user_id)
        .where(Invoice.id == invoice_id)
    )
    return result.first()


async def get_invoice_for_student_year_due_date(
    db: AsyncSession, *, student_id: uuid.UUID, academic_year_id: uuid.UUID, due_date
) -> Invoice | None:
    result = await db.execute(
        select(Invoice).where(
            Invoice.student_id == student_id,
            Invoice.academic_year_id == academic_year_id,
            Invoice.due_date == due_date,
            Invoice.status != InvoiceStatus.cancelled,
        )
    )
    return result.scalar_one_or_none()


async def create_invoice(
    db: AsyncSession,
    *,
    invoice_number: str,
    student_id: uuid.UUID,
    academic_year_id: uuid.UUID,
    subtotal: float,
    total_amount: float,
    due_amount: float,
    due_date,
    issued_by: uuid.UUID,
) -> Invoice:
    entity = Invoice(
        invoice_number=invoice_number,
        student_id=student_id,
        academic_year_id=academic_year_id,
        subtotal=subtotal,
        total_amount=total_amount,
        due_amount=due_amount,
        due_date=due_date,
        issued_by=issued_by,
    )
    db.add(entity)
    await db.flush()
    return entity


async def update_invoice_fields(db: AsyncSession, entity: Invoice, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()


async def create_invoice_item(
    db: AsyncSession, *, invoice_id: uuid.UUID, fee_type_id: uuid.UUID, description: str | None, amount: float
) -> InvoiceItem:
    entity = InvoiceItem(invoice_id=invoice_id, fee_type_id=fee_type_id, description=description, amount=amount)
    db.add(entity)
    await db.flush()
    return entity


InvoiceItemRow = tuple[InvoiceItem, FeeType]


async def list_invoice_items(db: AsyncSession, invoice_id: uuid.UUID) -> list[InvoiceItemRow]:
    result = await db.execute(
        select(InvoiceItem, FeeType)
        .join(FeeType, FeeType.id == InvoiceItem.fee_type_id)
        .where(InvoiceItem.invoice_id == invoice_id)
    )
    return list(result.all())


async def list_invoices(
    db: AsyncSession,
    *,
    student_id: uuid.UUID | None,
    academic_year_id: uuid.UUID | None,
    status: InvoiceStatus | None,
    offset: int,
    limit: int,
) -> tuple[list[tuple[Invoice, Student, User]], int]:
    filters = []
    if student_id is not None:
        filters.append(Invoice.student_id == student_id)
    if academic_year_id is not None:
        filters.append(Invoice.academic_year_id == academic_year_id)
    if status is not None:
        filters.append(Invoice.status == status)

    count_result = await db.execute(
        select(func.count()).select_from(Invoice).where(*filters)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Invoice, Student, User)
        .join(Student, Student.id == Invoice.student_id)
        .join(User, User.id == Student.user_id)
        .where(*filters)
        .order_by(Invoice.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.all()), total


async def list_outstanding_invoices_for_student(
    db: AsyncSession, student_id: uuid.UUID
) -> list[Invoice]:
    result = await db.execute(
        select(Invoice)
        .where(
            Invoice.student_id == student_id,
            Invoice.status.in_([InvoiceStatus.unpaid, InvoiceStatus.partially_paid, InvoiceStatus.overdue]),
        )
        .order_by(Invoice.due_date.asc())
    )
    return list(result.scalars().all())


# --- Discounts ---------------------------------------------------------------


async def create_discount(
    db: AsyncSession,
    *,
    invoice_id: uuid.UUID,
    discount_type,
    value: float,
    reason: str | None,
    approved_by: uuid.UUID,
) -> Discount:
    entity = Discount(
        invoice_id=invoice_id, discount_type=discount_type, value=value, reason=reason, approved_by=approved_by
    )
    db.add(entity)
    await db.flush()
    return entity


async def list_discounts(db: AsyncSession, invoice_id: uuid.UUID) -> list[Discount]:
    result = await db.execute(
        select(Discount).where(Discount.invoice_id == invoice_id).order_by(Discount.created_at.asc())
    )
    return list(result.scalars().all())


# --- Payments ------------------------------------------------------------------


async def create_payment(
    db: AsyncSession,
    *,
    invoice_id: uuid.UUID,
    amount: float,
    method,
    transaction_reference: str | None,
    received_by: uuid.UUID,
) -> Payment:
    entity = Payment(
        invoice_id=invoice_id,
        amount=amount,
        method=method,
        transaction_reference=transaction_reference,
        received_by=received_by,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_payment(db: AsyncSession, payment_id: uuid.UUID) -> Payment | None:
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    return result.scalar_one_or_none()


PaymentRow = tuple[Payment, User]


async def list_payments(db: AsyncSession, invoice_id: uuid.UUID) -> list[PaymentRow]:
    result = await db.execute(
        select(Payment, User)
        .join(User, User.id == Payment.received_by)
        .where(Payment.invoice_id == invoice_id)
        .order_by(Payment.paid_at.asc())
    )
    return list(result.all())


async def sum_payments_for_invoice(db: AsyncSession, invoice_id: uuid.UUID) -> float:
    result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.invoice_id == invoice_id)
    )
    return float(result.scalar_one())
