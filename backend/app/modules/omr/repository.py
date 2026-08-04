import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import OmrBatchStatus, OmrMatchStatus, OmrSheetStatus
from app.modules.auth.models import User
from app.modules.omr.models import OmrAnswerKey, OmrBatch, OmrSheet
from app.modules.students.models import Student

# --- Answer keys --------------------------------------------------------------


async def get_answer_key(db: AsyncSession, answer_key_id: uuid.UUID) -> OmrAnswerKey | None:
    result = await db.execute(select(OmrAnswerKey).where(OmrAnswerKey.id == answer_key_id))
    return result.scalar_one_or_none()


async def get_answer_key_for_set(
    db: AsyncSession, *, exam_subject_id: uuid.UUID, set_code: str
) -> OmrAnswerKey | None:
    result = await db.execute(
        select(OmrAnswerKey).where(
            OmrAnswerKey.exam_subject_id == exam_subject_id, OmrAnswerKey.set_code == set_code
        )
    )
    return result.scalar_one_or_none()


async def list_answer_keys(db: AsyncSession, exam_subject_id: uuid.UUID) -> list[OmrAnswerKey]:
    result = await db.execute(
        select(OmrAnswerKey)
        .where(OmrAnswerKey.exam_subject_id == exam_subject_id)
        .order_by(OmrAnswerKey.set_code.asc())
    )
    return list(result.scalars().all())


async def create_answer_key(
    db: AsyncSession,
    *,
    exam_subject_id: uuid.UUID,
    set_code: str,
    total_questions: int,
    answers: dict[str, Any],
    marks_per_correct: float,
    negative_marks: float,
    created_by: uuid.UUID,
) -> OmrAnswerKey:
    entity = OmrAnswerKey(
        exam_subject_id=exam_subject_id,
        set_code=set_code,
        total_questions=total_questions,
        answers=answers,
        marks_per_correct=marks_per_correct,
        negative_marks=negative_marks,
        created_by=created_by,
    )
    db.add(entity)
    await db.flush()
    return entity


async def update_answer_key_fields(
    db: AsyncSession, entity: OmrAnswerKey, fields: dict[str, Any]
) -> OmrAnswerKey:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()
    return entity


async def delete_answer_key(db: AsyncSession, entity: OmrAnswerKey) -> None:
    await db.delete(entity)
    await db.flush()


# --- Batch lookups needed to protect applied results --------------------------


async def has_applied_batch(db: AsyncSession, exam_subject_id: uuid.UUID) -> bool:
    """Whether any batch on this exam subject has already been pushed to the roster.

    Answer keys are not referenced by a foreign key from batches — a batch binds
    to the exam subject and picks its key by the set code read off each sheet. So
    "this key is in use" means "a batch on the same exam subject has been
    applied", and editing the key at that point would leave the stored marks
    unreproducible from the key that supposedly produced them.
    """
    result = await db.execute(
        select(OmrBatch.id).where(
            OmrBatch.exam_subject_id == exam_subject_id,
            OmrBatch.status == OmrBatchStatus.applied,
        )
    )
    return result.first() is not None


# --- Batches ------------------------------------------------------------------


async def create_batch(
    db: AsyncSession,
    *,
    exam_subject_id: uuid.UUID,
    name: str,
    template_name: str,
    mcq_full_marks: int,
    uploaded_by: uuid.UUID,
) -> OmrBatch:
    entity = OmrBatch(
        exam_subject_id=exam_subject_id,
        name=name,
        template_name=template_name,
        mcq_full_marks=mcq_full_marks,
        uploaded_by=uploaded_by,
    )
    db.add(entity)
    await db.flush()
    return entity


async def get_batch(db: AsyncSession, batch_id: uuid.UUID) -> OmrBatch | None:
    result = await db.execute(select(OmrBatch).where(OmrBatch.id == batch_id))
    return result.scalar_one_or_none()


async def list_batches(
    db: AsyncSession,
    *,
    exam_subject_ids: list[uuid.UUID] | None = None,
    exam_subject_id: uuid.UUID | None = None,
    status: OmrBatchStatus | None = None,
) -> list[OmrBatch]:
    query = select(OmrBatch).order_by(OmrBatch.created_at.desc())
    if exam_subject_id is not None:
        query = query.where(OmrBatch.exam_subject_id == exam_subject_id)
    if exam_subject_ids is not None:
        query = query.where(OmrBatch.exam_subject_id.in_(exam_subject_ids))
    if status is not None:
        query = query.where(OmrBatch.status == status)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_batch_fields(db: AsyncSession, entity: OmrBatch, fields: dict[str, Any]) -> OmrBatch:
    for key, value in fields.items():
        setattr(entity, key, value)
    await db.flush()
    return entity


async def delete_batch(db: AsyncSession, entity: OmrBatch) -> None:
    await db.delete(entity)
    await db.flush()


async def recount_batch(db: AsyncSession, batch: OmrBatch) -> OmrBatch:
    """Recompute the batch's counters from its sheets.

    Derived rather than incremented so the counters cannot drift out of step with
    the rows they summarise — a sheet that is deleted, reprocessed, or reassigned
    in a later phase updates them for free.
    """
    status_counts = dict(
        (
            await db.execute(
                select(OmrSheet.status, func.count())
                .where(OmrSheet.batch_id == batch.id)
                .group_by(OmrSheet.status)
            )
        ).all()
    )
    matched = (
        await db.execute(
            select(func.count())
            .select_from(OmrSheet)
            .where(
                OmrSheet.batch_id == batch.id,
                OmrSheet.match_status.in_([OmrMatchStatus.matched, OmrMatchStatus.manual]),
            )
        )
    ).scalar_one()

    total = sum(status_counts.values())
    failed = status_counts.get(OmrSheetStatus.failed, 0)

    batch.sheet_count = total
    batch.processed_count = total - failed - status_counts.get(OmrSheetStatus.pending, 0)
    batch.matched_count = matched
    batch.failed_count = failed
    await db.flush()
    return batch


# --- Sheets -------------------------------------------------------------------


async def create_sheet(db: AsyncSession, sheet: OmrSheet) -> OmrSheet:
    db.add(sheet)
    await db.flush()
    return sheet


async def get_sheet(db: AsyncSession, sheet_id: uuid.UUID) -> OmrSheet | None:
    result = await db.execute(select(OmrSheet).where(OmrSheet.id == sheet_id))
    return result.scalar_one_or_none()


async def list_sheets(
    db: AsyncSession,
    batch_id: uuid.UUID,
    *,
    status: OmrSheetStatus | None = None,
    match_status: OmrMatchStatus | None = None,
) -> list[tuple[OmrSheet, Student | None, User | None]]:
    query = (
        select(OmrSheet, Student, User)
        .outerjoin(Student, Student.id == OmrSheet.student_id)
        .outerjoin(User, User.id == Student.user_id)
        .where(OmrSheet.batch_id == batch_id)
        .order_by(OmrSheet.created_at.asc())
    )
    if status is not None:
        query = query.where(OmrSheet.status == status)
    if match_status is not None:
        query = query.where(OmrSheet.match_status == match_status)
    result = await db.execute(query)
    return list(result.all())


async def list_claimed_student_ids(db: AsyncSession, batch_id: uuid.UUID) -> set[uuid.UUID]:
    """Students already matched by a sheet in this batch."""
    result = await db.execute(
        select(OmrSheet.student_id).where(
            OmrSheet.batch_id == batch_id, OmrSheet.student_id.is_not(None)
        )
    )
    return {row[0] for row in result.all()}


async def list_sheet_assets(db: AsyncSession, batch_id: uuid.UUID) -> list[tuple[str, str | None]]:
    """(image_public_id, annotated_public_id) for every sheet, for asset cleanup."""
    result = await db.execute(
        select(OmrSheet.image_public_id, OmrSheet.annotated_public_id).where(
            OmrSheet.batch_id == batch_id
        )
    )
    return list(result.all())
