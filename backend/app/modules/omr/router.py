import io
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Path, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.common.enums import OmrBatchStatus, OmrMatchStatus, OmrSheetStatus
from app.core.config import get_settings
from app.core.exceptions import ValidationException
from app.core.rate_limiter import limiter
from app.core.response import success_response
from app.modules.omr import service
from app.modules.omr.models import OmrAnswerKey, OmrBatch, OmrSheet
from app.modules.omr.schemas import (
    AnswerKeyResponse,
    BatchResponse,
    CreateBatchRequest,
    EligibilityResponse,
    PatchSheetRequest,
    SaveAnswerKeyRequest,
    SheetDetailResponse,
    SheetResponse,
    normalize_set_code,
)

settings = get_settings()

router = APIRouter(prefix="/omr", tags=["omr"])


def _answer_key_payload(entity: OmrAnswerKey) -> dict:
    return AnswerKeyResponse.model_validate(entity).model_dump(mode="json")


def _batch_payload(entity: OmrBatch) -> dict:
    return BatchResponse.model_validate(entity).model_dump(mode="json")


def _sheet_payload(entity: OmrSheet, student_name: str | None = None) -> dict:
    payload = SheetResponse.model_validate(entity).model_dump(mode="json")
    payload["student_name"] = student_name
    return payload


def _validated_set_code(set_code: str) -> str:
    try:
        return normalize_set_code(set_code)
    except ValueError as exc:
        raise ValidationException(
            str(exc), details=[{"field": "set_code", "issue": "Unsupported set code"}]
        ) from exc


# --- Eligibility --------------------------------------------------------------


@router.get(
    "/exam-subjects/{exam_subject_id}/eligibility",
    dependencies=[Depends(require_permission("omr.scan"))],
)
async def get_eligibility(
    exam_subject_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_eligibility(db, current_user, exam_subject_id)
    # Serialised through the schema so the payload keeps a stable shape whether or
    # not the subject is eligible — callers should never have to probe for keys.
    return success_response(
        data=EligibilityResponse(**data).model_dump(mode="json"),
        message="OMR eligibility resolved",
    )


# --- Answer keys --------------------------------------------------------------


@router.put(
    "/exam-subjects/{exam_subject_id}/answer-keys/{set_code}",
    dependencies=[Depends(require_permission("omr.manage_keys"))],
)
async def save_answer_key(
    payload: SaveAnswerKeyRequest,
    exam_subject_id: uuid.UUID,
    set_code: str = Path(..., description="Set code on the sheet: Ka, Kha, Ga, Gha, Nga, or Cha"),
    current_user: CurrentUser = Depends(require_permission("omr.manage_keys")),
    db: AsyncSession = Depends(get_db_session),
):
    entity, created = await service.save_answer_key(
        db, current_user, exam_subject_id, _validated_set_code(set_code), payload
    )
    return success_response(
        data=_answer_key_payload(entity),
        message="Answer key created" if created else "Answer key replaced",
        status_code=201 if created else 200,
    )


@router.get(
    "/exam-subjects/{exam_subject_id}/answer-keys",
    dependencies=[Depends(require_permission("omr.scan"))],
)
async def list_answer_keys(
    exam_subject_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    keys = await service.list_answer_keys(db, current_user, exam_subject_id)
    return success_response(
        data=[_answer_key_payload(key) for key in keys], message="Answer keys retrieved"
    )


@router.delete("/answer-keys/{answer_key_id}", dependencies=[Depends(require_permission("omr.manage_keys"))])
async def delete_answer_key(
    answer_key_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.manage_keys")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_answer_key(db, current_user, answer_key_id)
    return success_response(message="Answer key deleted")


# --- Batches ------------------------------------------------------------------


@router.post("/batches", dependencies=[Depends(require_permission("omr.scan"))])
async def create_batch(
    payload: CreateBatchRequest,
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    batch = await service.create_batch(db, current_user, payload)
    return success_response(data=_batch_payload(batch), message="OMR batch created", status_code=201)


@router.get("/batches", dependencies=[Depends(require_permission("omr.scan"))])
async def list_batches(
    exam_subject_id: uuid.UUID | None = Query(default=None),
    status: OmrBatchStatus | None = Query(default=None),
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    batches = await service.list_batches(
        db, current_user, exam_subject_id=exam_subject_id, status=status
    )
    return success_response(data=[_batch_payload(b) for b in batches], message="OMR batches retrieved")


@router.get("/batches/{batch_id}", dependencies=[Depends(require_permission("omr.scan"))])
async def get_batch(
    batch_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    batch = await service.get_batch(db, current_user, batch_id)
    return success_response(data=_batch_payload(batch), message="OMR batch retrieved")


@router.delete("/batches/{batch_id}", dependencies=[Depends(require_permission("omr.scan"))])
async def delete_batch(
    batch_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_batch(db, current_user, batch_id)
    return success_response(message="OMR batch deleted")


# --- Sheets -------------------------------------------------------------------


@router.post("/batches/{batch_id}/sheets", dependencies=[Depends(require_permission("omr.scan"))])
@limiter.limit(settings.omr_upload_rate_limit)
async def upload_sheets(
    request: Request,
    batch_id: uuid.UUID,
    images: list[UploadFile] = File(...),
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    result = await service.upload_sheets(db, current_user, batch_id, images)
    sheets = result["sheets"]
    return success_response(
        data={
            "batch": _batch_payload(result["batch"]),
            "sheets": [_sheet_payload(sheet) for sheet in sheets],
            "rejected": result["rejected"],
        },
        message=f"Processed {len(sheets)} sheet(s)",
        status_code=201,
    )


@router.get("/batches/{batch_id}/sheets", dependencies=[Depends(require_permission("omr.scan"))])
async def list_sheets(
    batch_id: uuid.UUID,
    status: OmrSheetStatus | None = Query(default=None),
    match_status: OmrMatchStatus | None = Query(default=None),
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    rows = await service.list_sheets(
        db, current_user, batch_id, status=status, match_status=match_status
    )
    return success_response(
        data=[_sheet_payload(sheet, user.full_name if user else None) for sheet, _student, user in rows],
        message="OMR sheets retrieved",
    )


@router.get("/sheets/{sheet_id}", dependencies=[Depends(require_permission("omr.scan"))])
async def get_sheet(
    sheet_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    sheet = await service.get_sheet(db, current_user, sheet_id)
    return success_response(
        data=SheetDetailResponse.model_validate(sheet).model_dump(mode="json"),
        message="OMR sheet retrieved",
    )


# --- Review and correction ----------------------------------------------------


@router.patch("/sheets/{sheet_id}", dependencies=[Depends(require_permission("omr.review"))])
async def patch_sheet(
    sheet_id: uuid.UUID,
    payload: PatchSheetRequest,
    current_user: CurrentUser = Depends(require_permission("omr.review")),
    db: AsyncSession = Depends(get_db_session),
):
    sheet = await service.patch_sheet(db, current_user, sheet_id, payload)
    return success_response(
        data=SheetDetailResponse.model_validate(sheet).model_dump(mode="json"),
        message="OMR sheet updated",
    )


@router.post("/sheets/{sheet_id}/reprocess", dependencies=[Depends(require_permission("omr.review"))])
async def reprocess_sheet(
    sheet_id: uuid.UUID,
    reset_match: bool = Query(
        default=False,
        description="Discard a manual student assignment and re-match from the sheet",
    ),
    current_user: CurrentUser = Depends(require_permission("omr.review")),
    db: AsyncSession = Depends(get_db_session),
):
    sheet = await service.reprocess_sheet(db, current_user, sheet_id, reset_match=reset_match)
    return success_response(
        data=SheetDetailResponse.model_validate(sheet).model_dump(mode="json"),
        message="OMR sheet reprocessed",
    )


@router.get("/batches/{batch_id}/export", dependencies=[Depends(require_permission("omr.scan"))])
async def export_batch(
    batch_id: uuid.UUID,
    format: Literal["csv", "excel"] = Query(default="excel"),
    current_user: CurrentUser = Depends(require_permission("omr.scan")),
    db: AsyncSession = Depends(get_db_session),
):
    payload, filename, media_type = await service.export_batch(db, current_user, batch_id, format)
    return StreamingResponse(
        io.BytesIO(payload),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/batches/{batch_id}/apply", dependencies=[Depends(require_permission("omr.apply"))])
async def apply_batch(
    batch_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.apply")),
    db: AsyncSession = Depends(get_db_session),
):
    result = await service.apply_batch(db, current_user, batch_id)
    return success_response(
        data={
            "batch": _batch_payload(result["batch"]),
            "applied_count": result["applied_count"],
            "unscanned": result["unscanned"],
            "skipped": result["skipped"],
        },
        message=f"Applied {result['applied_count']} scanned result(s) to the marks roster",
    )


@router.delete("/sheets/{sheet_id}", dependencies=[Depends(require_permission("omr.review"))])
async def delete_sheet(
    sheet_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("omr.review")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_sheet(db, current_user, sheet_id)
    return success_response(message="OMR sheet deleted")
