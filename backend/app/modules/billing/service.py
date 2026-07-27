import uuid
from datetime import date, datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.audit import record_audit_log
from app.common.codes import generate_identifier
from app.common.dependencies import CurrentUser
from app.common.enums import DiscountType, InvoiceStatus
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.modules.academic import repository as academic_repository
from app.modules.billing import repository
from app.modules.billing.models import Invoice
from app.modules.billing.schemas import (
    AddDiscountRequest,
    CreateFeeTypeRequest,
    GenerateInvoiceRequest,
    RecordPaymentRequest,
    SetFeeStructureRequest,
    UpdateFeeTypeRequest,
)
from app.modules.guardians import repository as guardians_repository
from app.modules.students import repository as students_repository

STAFF_BILLING_ROLES = ("admin", "principal", "accountant", "receptionist")


def _today() -> date:
    return datetime.now(timezone.utc).date()


# --- Ownership / access helpers -------------------------------------------------


async def _resolve_own_student(db: AsyncSession, actor: CurrentUser):
    record = await students_repository.get_student_by_user_id(db, actor.id)
    if record is None:
        raise NotFoundException("Student profile not found")
    return record


async def _assert_guardian_owns_student(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> None:
    guardian_record = await guardians_repository.get_guardian_by_user_id(db, actor.id)
    if guardian_record is None:
        raise NotFoundException("Guardian profile not found")
    linked = await students_repository.list_students_for_guardian(db, guardian_record[0].id)
    if not any(linked_student.id == student_id for _link, linked_student, _u in linked):
        raise PermissionDeniedException("You can only view a linked child's billing records")


async def _assert_can_view_student(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> None:
    if actor.role in STAFF_BILLING_ROLES:
        return
    if actor.role == "guardian":
        await _assert_guardian_owns_student(db, actor, student_id)
        return
    if actor.role == "student":
        student, _user = await _resolve_own_student(db, actor)
        if student.id != student_id:
            raise PermissionDeniedException("You can only view your own billing records")
        return
    raise PermissionDeniedException("You do not have access to this student's billing records")


# --- Fee types -------------------------------------------------------------------


async def list_fee_types(db: AsyncSession) -> list:
    return await repository.list_fee_types(db)


async def create_fee_type(db: AsyncSession, actor: CurrentUser, payload: CreateFeeTypeRequest):
    existing = await repository.get_fee_type_by_name(db, payload.name)
    if existing is not None:
        raise ConflictException(f"A fee type named '{payload.name}' already exists")
    entity = await repository.create_fee_type(db, name=payload.name, is_recurring=payload.is_recurring)
    await record_audit_log(
        db, actor_id=actor.id, action="create", entity_type="fee_type", entity_id=entity.id,
        new_value={"name": entity.name, "is_recurring": entity.is_recurring},
    )
    await db.commit()
    return entity


async def _get_fee_type_or_404(db: AsyncSession, fee_type_id: uuid.UUID):
    entity = await repository.get_fee_type(db, fee_type_id)
    if entity is None:
        raise NotFoundException("Fee type not found")
    return entity


async def update_fee_type(db: AsyncSession, actor: CurrentUser, fee_type_id: uuid.UUID, payload: UpdateFeeTypeRequest):
    entity = await _get_fee_type_or_404(db, fee_type_id)
    fields = payload.model_dump(exclude_unset=True)
    if "name" in fields and fields["name"] != entity.name:
        existing = await repository.get_fee_type_by_name(db, fields["name"])
        if existing is not None:
            raise ConflictException(f"A fee type named '{fields['name']}' already exists")
    if fields:
        await repository.update_fee_type_fields(db, entity, fields)
        await record_audit_log(
            db, actor_id=actor.id, action="update", entity_type="fee_type", entity_id=entity.id, new_value=fields
        )
        await db.commit()
    return entity


async def delete_fee_type(db: AsyncSession, actor: CurrentUser, fee_type_id: uuid.UUID) -> None:
    entity = await _get_fee_type_or_404(db, fee_type_id)
    await repository.soft_delete_fee_type(db, entity)
    await record_audit_log(db, actor_id=actor.id, action="delete", entity_type="fee_type", entity_id=entity.id)
    await db.commit()


# --- Class fee structures --------------------------------------------------------


def _fee_structure_response(row) -> dict:
    structure, class_entity, fee_type = row
    return {
        "id": str(structure.id),
        "academic_year_id": str(structure.academic_year_id),
        "class_id": str(structure.class_id),
        "class_name": class_entity.name,
        "fee_type_id": str(structure.fee_type_id),
        "fee_type_name": fee_type.name,
        "is_recurring": fee_type.is_recurring,
        "amount": float(structure.amount),
    }


async def list_fee_structures(db: AsyncSession, academic_year_id: uuid.UUID, class_id: uuid.UUID | None) -> list[dict]:
    year = await academic_repository.get_academic_year(db, academic_year_id)
    if year is None:
        raise NotFoundException("Academic year not found")
    rows = await repository.list_fee_structures(db, academic_year_id=academic_year_id, class_id=class_id)
    return [_fee_structure_response(row) for row in rows]


async def set_fee_structure(db: AsyncSession, actor: CurrentUser, payload: SetFeeStructureRequest) -> list[dict]:
    year = await academic_repository.get_academic_year(db, payload.academic_year_id)
    if year is None:
        raise NotFoundException("Academic year not found")
    class_entity = await academic_repository.get_class(db, payload.class_id)
    if class_entity is None:
        raise NotFoundException("Class not found")

    for item in payload.items:
        fee_type = await repository.get_fee_type(db, item.fee_type_id)
        if fee_type is None:
            raise NotFoundException(f"Fee type {item.fee_type_id} not found")
        existing = await repository.get_fee_structure_by_year_class_fee(
            db, academic_year_id=payload.academic_year_id, class_id=payload.class_id, fee_type_id=item.fee_type_id
        )
        if existing is None:
            await repository.create_fee_structure(
                db,
                academic_year_id=payload.academic_year_id,
                class_id=payload.class_id,
                fee_type_id=item.fee_type_id,
                amount=item.amount,
            )
        else:
            await repository.update_fee_structure_amount(db, existing, item.amount)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="set_fee_structure",
        entity_type="class_fee_structure",
        entity_id=payload.class_id,
        new_value={"academic_year_id": str(payload.academic_year_id), "item_count": len(payload.items)},
    )
    await db.commit()
    rows = await repository.list_fee_structures(db, academic_year_id=payload.academic_year_id, class_id=payload.class_id)
    return [_fee_structure_response(row) for row in rows]


async def delete_fee_structure_item(db: AsyncSession, actor: CurrentUser, structure_id: uuid.UUID) -> None:
    entity = await repository.get_fee_structure_by_id(db, structure_id)
    if entity is None:
        raise NotFoundException("Fee structure entry not found")
    await repository.delete_fee_structure(db, entity)
    await record_audit_log(
        db, actor_id=actor.id, action="delete", entity_type="class_fee_structure", entity_id=structure_id
    )
    await db.commit()


# --- Invoice status helpers -------------------------------------------------------


def _compute_status(total_amount: float, paid_amount: float, due_date_value: date, previous_status: InvoiceStatus) -> InvoiceStatus:
    due_amount = round(total_amount - paid_amount, 2)
    if due_amount <= 0:
        return InvoiceStatus.paid
    if paid_amount > 0:
        return InvoiceStatus.partially_paid
    if due_date_value < _today():
        return InvoiceStatus.overdue
    return InvoiceStatus.unpaid


async def _apply_overdue(db: AsyncSession, invoice: Invoice) -> None:
    if invoice.status in (InvoiceStatus.unpaid, InvoiceStatus.partially_paid) and invoice.due_date < _today():
        await repository.update_invoice_fields(db, invoice, {"status": InvoiceStatus.overdue})
        await db.commit()


# --- Response builders -------------------------------------------------------------


def _invoice_summary(invoice: Invoice, student, user) -> dict:
    return {
        "id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "student_id": str(invoice.student_id),
        "student_name": user.full_name,
        "admission_number": student.admission_number,
        "academic_year_id": str(invoice.academic_year_id),
        "subtotal": float(invoice.subtotal),
        "discount_total": float(invoice.discount_total),
        "total_amount": float(invoice.total_amount),
        "paid_amount": float(invoice.paid_amount),
        "due_amount": float(invoice.due_amount),
        "status": invoice.status,
        "due_date": invoice.due_date.isoformat(),
        "created_at": invoice.created_at.isoformat(),
    }


async def _invoice_detail(db: AsyncSession, invoice: Invoice, student, user) -> dict:
    items = await repository.list_invoice_items(db, invoice.id)
    discounts = await repository.list_discounts(db, invoice.id)
    payments = await repository.list_payments(db, invoice.id)

    def _discount_amount(discount) -> float:
        if discount.discount_type == DiscountType.flat:
            return float(discount.value)
        return round(float(invoice.subtotal) * float(discount.value) / 100, 2)

    summary = _invoice_summary(invoice, student, user)
    summary["issued_by"] = str(invoice.issued_by)
    summary["items"] = [
        {
            "id": str(item.id),
            "fee_type_id": str(item.fee_type_id),
            "fee_type_name": fee_type.name,
            "description": item.description,
            "amount": float(item.amount),
        }
        for item, fee_type in items
    ]
    summary["discounts"] = [
        {
            "id": str(discount.id),
            "discount_type": discount.discount_type,
            "value": float(discount.value),
            "amount": _discount_amount(discount),
            "reason": discount.reason,
            "approved_by": str(discount.approved_by) if discount.approved_by else None,
            "created_at": discount.created_at.isoformat(),
        }
        for discount in discounts
    ]
    summary["payments"] = [
        {
            "id": str(payment.id),
            "amount": float(payment.amount),
            "method": payment.method,
            "transaction_reference": payment.transaction_reference,
            "received_by": str(payment.received_by),
            "received_by_name": received_by_user.full_name,
            "paid_at": payment.paid_at.isoformat(),
        }
        for payment, received_by_user in payments
    ]
    return summary


# --- Invoice generation -------------------------------------------------------------


async def _resolve_academic_year(db: AsyncSession, academic_year_id: uuid.UUID | None):
    if academic_year_id is not None:
        year = await academic_repository.get_academic_year(db, academic_year_id)
        if year is None:
            raise NotFoundException("Academic year not found")
        return year
    year = await academic_repository.get_active_academic_year(db)
    if year is None:
        raise ValidationException("No active academic year — specify academic_year_id explicitly")
    return year


async def _create_invoice_for_student(
    db: AsyncSession,
    *,
    student,
    user,
    academic_year_id: uuid.UUID,
    class_id: uuid.UUID,
    fee_type_ids: list[uuid.UUID],
    due_date: date,
    issued_by: uuid.UUID,
) -> dict | None:
    """Returns None if an invoice already exists for this student/year/due_date (skip)."""
    existing = await repository.get_invoice_for_student_year_due_date(
        db, student_id=student.id, academic_year_id=academic_year_id, due_date=due_date
    )
    if existing is not None:
        return None

    structures = await repository.get_fee_structures_for_class_types(
        db, academic_year_id=academic_year_id, class_id=class_id, fee_type_ids=fee_type_ids
    )
    found_ids = {structure.fee_type_id for structure, _c, _f in structures}
    missing = set(fee_type_ids) - found_ids
    if missing:
        raise ValidationException(
            f"No fee structure defined for {len(missing)} of the requested fee type(s) in this class/year"
        )

    subtotal = round(sum(float(structure.amount) for structure, _c, _f in structures), 2)
    invoice = await repository.create_invoice(
        db,
        invoice_number=generate_identifier("INV"),
        student_id=student.id,
        academic_year_id=academic_year_id,
        subtotal=subtotal,
        total_amount=subtotal,
        due_amount=subtotal,
        due_date=due_date,
        issued_by=issued_by,
    )
    for structure, _c, fee_type in structures:
        await repository.create_invoice_item(
            db, invoice_id=invoice.id, fee_type_id=fee_type.id, description=None, amount=float(structure.amount)
        )
    return await _invoice_detail(db, invoice, student, user)


async def generate_invoice_for_student(
    db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID, payload: GenerateInvoiceRequest
) -> dict:
    student_record = await students_repository.get_student_by_id(db, student_id)
    if student_record is None:
        raise NotFoundException("Student not found")
    student, user = student_record

    year = await _resolve_academic_year(db, payload.academic_year_id)
    enrollment = await students_repository.get_active_enrollment_for_student(db, student.id, year.id)
    if enrollment is None:
        raise ValidationException("Student is not actively enrolled for the selected academic year")
    _enrollment, _section, class_entity = enrollment

    detail = await _create_invoice_for_student(
        db,
        student=student,
        user=user,
        academic_year_id=year.id,
        class_id=class_entity.id,
        fee_type_ids=payload.fee_type_ids,
        due_date=payload.due_date,
        issued_by=actor.id,
    )
    if detail is None:
        raise ConflictException("An invoice already exists for this student with the same due date")

    await record_audit_log(
        db, actor_id=actor.id, action="generate_invoice", entity_type="invoice",
        entity_id=uuid.UUID(detail["id"]), new_value={"student_id": str(student.id)},
    )
    await db.commit()
    return detail


async def generate_invoices_for_class(db: AsyncSession, actor: CurrentUser, class_id: uuid.UUID, payload: GenerateInvoiceRequest) -> dict:
    class_entity = await academic_repository.get_class(db, class_id)
    if class_entity is None:
        raise NotFoundException("Class not found")
    year = await _resolve_academic_year(db, payload.academic_year_id)

    students = await repository.list_active_students_in_class(db, academic_year_id=year.id, class_id=class_id)
    if not students:
        raise ValidationException("No actively enrolled students found in this class for the selected year")

    created: list[dict] = []
    skipped: list[str] = []
    for student, user, _enrollment in students:
        detail = await _create_invoice_for_student(
            db,
            student=student,
            user=user,
            academic_year_id=year.id,
            class_id=class_id,
            fee_type_ids=payload.fee_type_ids,
            due_date=payload.due_date,
            issued_by=actor.id,
        )
        if detail is None:
            skipped.append(str(student.id))
        else:
            created.append(detail)

    await record_audit_log(
        db, actor_id=actor.id, action="generate_invoices_batch", entity_type="class_fee_structure",
        entity_id=class_id, new_value={"created": len(created), "skipped": len(skipped)},
    )
    await db.commit()
    return {
        "class_id": str(class_id),
        "class_name": class_entity.name,
        "created": created,
        "skipped_student_ids": skipped,
    }


# --- Invoice detail / listing --------------------------------------------------


async def _get_invoice_or_404(db: AsyncSession, invoice_id: uuid.UUID):
    row = await repository.get_invoice_with_student(db, invoice_id)
    if row is None:
        raise NotFoundException("Invoice not found")
    return row


async def get_invoice_detail(db: AsyncSession, actor: CurrentUser, invoice_id: uuid.UUID) -> dict:
    invoice, student, user = await _get_invoice_or_404(db, invoice_id)
    await _assert_can_view_student(db, actor, student.id)
    await _apply_overdue(db, invoice)
    return await _invoice_detail(db, invoice, student, user)


async def list_invoices(
    db: AsyncSession,
    actor: CurrentUser,
    *,
    student_id: uuid.UUID | None,
    academic_year_id: uuid.UUID | None,
    status: InvoiceStatus | None,
    page: int,
    limit: int,
) -> tuple[list[dict], int]:
    if actor.role not in STAFF_BILLING_ROLES:
        raise PermissionDeniedException("You do not have access to the full invoice listing")

    rows, total = await repository.list_invoices(
        db, student_id=student_id, academic_year_id=academic_year_id, status=status,
        offset=(page - 1) * limit, limit=limit,
    )
    for invoice, _s, _u in rows:
        await _apply_overdue(db, invoice)
    return [_invoice_summary(invoice, student, user) for invoice, student, user in rows], total


async def _list_all_invoices_for_student(db: AsyncSession, student_id: uuid.UUID) -> list[dict]:
    rows, _total = await repository.list_invoices(
        db, student_id=student_id, academic_year_id=None, status=None, offset=0, limit=500
    )
    for invoice, _s, _u in rows:
        await _apply_overdue(db, invoice)
    return [_invoice_summary(invoice, student, user) for invoice, student, user in rows]


async def get_my_invoices(db: AsyncSession, actor: CurrentUser) -> list[dict]:
    student, _user = await _resolve_own_student(db, actor)
    return await _list_all_invoices_for_student(db, student.id)


async def get_student_invoices(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> list[dict]:
    await _assert_can_view_student(db, actor, student_id)
    return await _list_all_invoices_for_student(db, student_id)


# --- Dues ------------------------------------------------------------------------


async def _dues_summary_for_student(db: AsyncSession, student_id: uuid.UUID) -> dict:
    student_record = await students_repository.get_student_by_id(db, student_id)
    if student_record is None:
        raise NotFoundException("Student not found")
    student, user = student_record

    invoices = await repository.list_outstanding_invoices_for_student(db, student_id)
    for invoice in invoices:
        await _apply_overdue(db, invoice)
    invoices = [inv for inv in invoices if inv.status != InvoiceStatus.paid]
    total_due = round(sum(float(invoice.due_amount) for invoice in invoices), 2)

    return {
        "student_id": str(student.id),
        "student_name": user.full_name,
        "admission_number": student.admission_number,
        "total_due": total_due,
        "outstanding_invoices": [_invoice_summary(invoice, student, user) for invoice in invoices],
    }


async def get_my_dues(db: AsyncSession, actor: CurrentUser) -> dict:
    student, _user = await _resolve_own_student(db, actor)
    return await _dues_summary_for_student(db, student.id)


async def get_student_dues(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> dict:
    await _assert_can_view_student(db, actor, student_id)
    return await _dues_summary_for_student(db, student_id)


# --- Discounts ---------------------------------------------------------------------


async def add_discount(db: AsyncSession, actor: CurrentUser, invoice_id: uuid.UUID, payload: AddDiscountRequest) -> dict:
    invoice, student, user = await _get_invoice_or_404(db, invoice_id)
    if invoice.status == InvoiceStatus.cancelled:
        raise ConflictException("Cannot apply a discount to a cancelled invoice")

    amount = float(payload.value) if payload.discount_type == DiscountType.flat else round(
        float(invoice.subtotal) * float(payload.value) / 100, 2
    )
    new_discount_total = round(float(invoice.discount_total) + amount, 2)
    new_total_amount = max(round(float(invoice.subtotal) - new_discount_total, 2), 0.0)
    if new_total_amount < float(invoice.paid_amount):
        raise ValidationException("This discount would reduce the invoice below the amount already paid")

    await repository.create_discount(
        db, invoice_id=invoice.id, discount_type=payload.discount_type, value=payload.value,
        reason=payload.reason, approved_by=actor.id,
    )
    new_due_amount = round(new_total_amount - float(invoice.paid_amount), 2)
    new_status = _compute_status(new_total_amount, float(invoice.paid_amount), invoice.due_date, invoice.status)
    await repository.update_invoice_fields(
        db, invoice,
        {
            "discount_total": new_discount_total,
            "total_amount": new_total_amount,
            "due_amount": new_due_amount,
            "status": new_status,
        },
    )
    await record_audit_log(
        db, actor_id=actor.id, action="add_discount", entity_type="invoice", entity_id=invoice.id,
        new_value={"discount_type": payload.discount_type.value, "value": payload.value, "computed_amount": amount},
    )
    await db.commit()
    return await _invoice_detail(db, invoice, student, user)


# --- Payments ------------------------------------------------------------------------


async def record_payment(db: AsyncSession, actor: CurrentUser, invoice_id: uuid.UUID, payload: RecordPaymentRequest) -> dict:
    invoice, student, user = await _get_invoice_or_404(db, invoice_id)
    if invoice.status == InvoiceStatus.cancelled:
        raise ConflictException("Cannot record a payment against a cancelled invoice")
    if float(invoice.due_amount) <= 0:
        raise ConflictException("This invoice is already fully paid")
    if payload.amount > float(invoice.due_amount):
        raise ValidationException(f"Payment amount cannot exceed the outstanding due amount ({invoice.due_amount})")

    try:
        payment = await repository.create_payment(
            db, invoice_id=invoice.id, amount=payload.amount, method=payload.method,
            transaction_reference=payload.transaction_reference, received_by=actor.id,
        )
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictException("Recording this payment would exceed the invoice total") from exc

    new_paid_amount = round(float(invoice.paid_amount) + payload.amount, 2)
    new_due_amount = max(round(float(invoice.total_amount) - new_paid_amount, 2), 0.0)
    new_status = _compute_status(float(invoice.total_amount), new_paid_amount, invoice.due_date, invoice.status)
    await repository.update_invoice_fields(
        db, invoice, {"paid_amount": new_paid_amount, "due_amount": new_due_amount, "status": new_status}
    )
    await record_audit_log(
        db, actor_id=actor.id, action="record_payment", entity_type="invoice", entity_id=invoice.id,
        new_value={"amount": payload.amount, "method": payload.method.value},
    )
    await db.commit()
    return {"payment_id": str(payment.id), "invoice": await _invoice_detail(db, invoice, student, user)}


async def get_receipt(db: AsyncSession, actor: CurrentUser, payment_id: uuid.UUID) -> dict:
    payment = await repository.get_payment(db, payment_id)
    if payment is None:
        raise NotFoundException("Payment not found")
    invoice, student, user = await _get_invoice_or_404(db, payment.invoice_id)
    await _assert_can_view_student(db, actor, student.id)

    payments = await repository.list_payments(db, invoice.id)
    received_by_user = next((u for p, u in payments if p.id == payment.id), None)

    return {
        "payment": {
            "id": str(payment.id),
            "amount": float(payment.amount),
            "method": payment.method,
            "transaction_reference": payment.transaction_reference,
            "received_by": str(payment.received_by),
            "received_by_name": received_by_user.full_name if received_by_user else "",
            "paid_at": payment.paid_at.isoformat(),
        },
        "invoice": await _invoice_detail(db, invoice, student, user),
    }


# --- Cancellation --------------------------------------------------------------------


async def cancel_invoice(db: AsyncSession, actor: CurrentUser, invoice_id: uuid.UUID) -> dict:
    invoice, student, user = await _get_invoice_or_404(db, invoice_id)
    if invoice.status == InvoiceStatus.cancelled:
        raise ConflictException("This invoice is already cancelled")
    if float(invoice.paid_amount) > 0:
        raise ConflictException("Cannot cancel an invoice that already has payments recorded against it")

    await repository.update_invoice_fields(db, invoice, {"status": InvoiceStatus.cancelled})
    await record_audit_log(db, actor_id=actor.id, action="cancel", entity_type="invoice", entity_id=invoice.id)
    await db.commit()
    return await _invoice_detail(db, invoice, student, user)
