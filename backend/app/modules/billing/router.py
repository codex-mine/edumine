import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.common.enums import InvoiceStatus
from app.common.schemas import PaginationParams, pagination_meta
from app.core.response import success_response
from app.modules.billing import service
from app.modules.billing.schemas import (
    AddDiscountRequest,
    CreateFeeTypeRequest,
    GenerateInvoiceRequest,
    RecordPaymentRequest,
    SetFeeStructureRequest,
    UpdateFeeTypeRequest,
)

router = APIRouter(prefix="/billing", tags=["billing"])


def _fee_type_response(entity) -> dict:
    return {"id": str(entity.id), "name": entity.name, "is_recurring": entity.is_recurring}


# --- Fee types -------------------------------------------------------------------


@router.get("/fee-types", dependencies=[Depends(require_permission("billing.view"))])
async def list_fee_types(db: AsyncSession = Depends(get_db_session)):
    entities = await service.list_fee_types(db)
    return success_response(data=[_fee_type_response(e) for e in entities], message="Fee types retrieved")


@router.post("/fee-types", dependencies=[Depends(require_permission("billing.manage"))])
async def create_fee_type(
    payload: CreateFeeTypeRequest,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.create_fee_type(db, current_user, payload)
    return success_response(data=_fee_type_response(entity), message="Fee type created", status_code=201)


@router.patch("/fee-types/{fee_type_id}", dependencies=[Depends(require_permission("billing.manage"))])
async def update_fee_type(
    fee_type_id: uuid.UUID,
    payload: UpdateFeeTypeRequest,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.update_fee_type(db, current_user, fee_type_id, payload)
    return success_response(data=_fee_type_response(entity), message="Fee type updated")


@router.delete("/fee-types/{fee_type_id}", dependencies=[Depends(require_permission("billing.manage"))])
async def delete_fee_type(
    fee_type_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_fee_type(db, current_user, fee_type_id)
    return success_response(data=None, message="Fee type deleted")


# --- Class fee structures --------------------------------------------------------


@router.get("/fee-structures", dependencies=[Depends(require_permission("billing.view"))])
async def list_fee_structures(
    academic_year_id: uuid.UUID = Query(...),
    class_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.list_fee_structures(db, academic_year_id, class_id)
    return success_response(data=data, message="Fee structures retrieved")


@router.put("/fee-structures", dependencies=[Depends(require_permission("billing.manage"))])
async def set_fee_structure(
    payload: SetFeeStructureRequest,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.set_fee_structure(db, current_user, payload)
    return success_response(data=data, message="Fee structure saved")


@router.delete("/fee-structures/{structure_id}", dependencies=[Depends(require_permission("billing.manage"))])
async def delete_fee_structure(
    structure_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_fee_structure_item(db, current_user, structure_id)
    return success_response(data=None, message="Fee structure entry removed")


# --- Invoice generation -------------------------------------------------------------


@router.post("/students/{student_id}/invoices", dependencies=[Depends(require_permission("billing.manage"))])
async def generate_invoice_for_student(
    student_id: uuid.UUID,
    payload: GenerateInvoiceRequest,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.generate_invoice_for_student(db, current_user, student_id, payload)
    return success_response(data=data, message="Invoice generated", status_code=201)


@router.post("/classes/{class_id}/invoices/generate", dependencies=[Depends(require_permission("billing.manage"))])
async def generate_invoices_for_class(
    class_id: uuid.UUID,
    payload: GenerateInvoiceRequest,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.generate_invoices_for_class(db, current_user, class_id, payload)
    return success_response(data=data, message="Invoices generated for class")


# --- Invoice detail / listing --------------------------------------------------


@router.get("/invoices", dependencies=[Depends(require_permission("billing.view"))])
async def list_invoices(
    student_id: uuid.UUID | None = Query(default=None),
    academic_year_id: uuid.UUID | None = Query(default=None),
    status: InvoiceStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_permission("billing.view")),
    db: AsyncSession = Depends(get_db_session),
):
    items, total = await service.list_invoices(
        db, current_user, student_id=student_id, academic_year_id=academic_year_id, status=status, page=page, limit=limit
    )
    meta = pagination_meta(PaginationParams(page=page, limit=limit), total)
    return success_response(data=items, message="Invoices retrieved", meta=meta)


@router.get("/invoices/{invoice_id}", dependencies=[Depends(require_permission("billing.view"))])
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("billing.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_invoice_detail(db, current_user, invoice_id)
    return success_response(data=data, message="Invoice retrieved")


@router.post("/invoices/{invoice_id}/cancel", dependencies=[Depends(require_permission("billing.manage"))])
async def cancel_invoice(
    invoice_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.cancel_invoice(db, current_user, invoice_id)
    return success_response(data=data, message="Invoice cancelled")


# --- Discounts ---------------------------------------------------------------------


@router.post("/invoices/{invoice_id}/discounts", dependencies=[Depends(require_permission("billing.manage"))])
async def add_discount(
    invoice_id: uuid.UUID,
    payload: AddDiscountRequest,
    current_user: CurrentUser = Depends(require_permission("billing.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.add_discount(db, current_user, invoice_id, payload)
    return success_response(data=data, message="Discount applied")


# --- Payments ------------------------------------------------------------------------


@router.post("/invoices/{invoice_id}/payments", dependencies=[Depends(require_permission("billing.collect_payment"))])
async def record_payment(
    invoice_id: uuid.UUID,
    payload: RecordPaymentRequest,
    current_user: CurrentUser = Depends(require_permission("billing.collect_payment")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.record_payment(db, current_user, invoice_id, payload)
    return success_response(data=data, message="Payment recorded", status_code=201)


@router.get("/payments/{payment_id}/receipt", dependencies=[Depends(require_permission("billing.view"))])
async def get_receipt(
    payment_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("billing.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_receipt(db, current_user, payment_id)
    return success_response(data=data, message="Receipt retrieved")


# --- Dues ------------------------------------------------------------------------


@router.get("/students/{student_id}/invoices", dependencies=[Depends(require_permission("billing.view"))])
async def get_student_invoices(
    student_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("billing.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_student_invoices(db, current_user, student_id)
    return success_response(data=data, message="Student invoices retrieved")


@router.get("/students/{student_id}/dues", dependencies=[Depends(require_permission("billing.view"))])
async def get_student_dues(
    student_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("billing.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_student_dues(db, current_user, student_id)
    return success_response(data=data, message="Student dues retrieved")


@router.get("/my/invoices", dependencies=[Depends(require_permission("billing.view"))])
async def get_my_invoices(
    current_user: CurrentUser = Depends(require_permission("billing.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_my_invoices(db, current_user)
    return success_response(data=data, message="Your invoices retrieved")


@router.get("/my/dues", dependencies=[Depends(require_permission("billing.view"))])
async def get_my_dues(
    current_user: CurrentUser = Depends(require_permission("billing.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_my_dues(db, current_user)
    return success_response(data=data, message="Your dues retrieved")
