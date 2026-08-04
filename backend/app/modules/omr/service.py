"""OMR scanning service.

Covers the eligibility resolver (which exam subjects may be scanned, and at what
MCQ marks ceiling) and answer-key management (the correct answers each scanned
sheet is scored against, per set code).
"""

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.common.audit import record_audit_log
from app.common.dependencies import CurrentUser
from app.common.enums import OmrBatchStatus, OmrMatchStatus, OmrSheetStatus
from app.core.config import get_settings
from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.core.storage import delete_asset, fetch_asset, upload_image_bytes
from app.modules.exams import repository as exams_repository
from app.modules.exams.models import ExamSubject
from app.modules.exams.repository import ExamSubjectRow
from app.modules.omr import repository
from app.modules.omr.engine.pipeline import OMRPipeline
from app.modules.omr.engine.scorer import OMRScorer, ScoringConfig
from app.modules.omr.exporter import ResultExporter, SheetExportRow
from app.modules.omr.matcher import MatchOutcome, RollCandidate, match_roll, verify_sheet_origin
from app.modules.omr.models import OmrAnswerKey, OmrBatch, OmrSheet
from app.modules.omr.schemas import CreateBatchRequest, SaveAnswerKeyRequest
from app.modules.results import repository as results_repository
from app.modules.results import service as results_service
from app.modules.results.schemas import MarkEntryItem, SaveMarksRequest
from app.modules.teachers import repository as teachers_repository

# Ownership is deliberately shared with the results module rather than
# reimplemented: an OMR batch writes into exactly the marks roster that
# `results` guards, so a second copy of the rule could drift and quietly widen
# who can touch whose subject.
from app.modules.results.service import _assert_owns_exam_subject as assert_owns_exam_subject

logger = logging.getLogger(__name__)
settings = get_settings()

# The mark-scheme section that an OMR sheet corresponds to. Matched
# case-insensitively so "MCQ", "mcq", and "Mcq" all resolve.
MCQ_SECTION_NAME = "mcq"

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

# Sheets must be raster images the CV pipeline can decode. The shared upload
# allow-list also permits PDFs, which OpenCV cannot read.
SHEET_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def template_path(template_name: str) -> Path:
    path = TEMPLATES_DIR / f"{template_name}.json"
    if not path.is_file():
        raise ValidationException(
            f"OMR template '{template_name}' is not installed",
            details=[{"field": "template_name", "issue": "Unknown template"}],
        )
    return path


@dataclass(frozen=True)
class McqMarksResolution:
    """The MCQ marks ceiling for an exam subject, and how it was arrived at.

    `source` is "section" when an explicit MCQ section supplied the ceiling, and
    "whole_subject" when the subject carries no mark-scheme breakdown and is
    therefore treated as entirely MCQ.
    """

    mcq_full_marks: int
    source: str
    section_id: uuid.UUID | None = None
    section_name: str | None = None


async def resolve_mcq_marks(db: AsyncSession, exam_subject_id: uuid.UUID) -> McqMarksResolution:
    """Resolve the MCQ marks ceiling for an exam subject, per Decision D2.

    Raises ValidationException when the subject is not OMR-scannable. Option A
    of D2 restricts scanning to subjects that are entirely MCQ: `exam_results`
    stores one flat mark per (exam subject, student), so there is nowhere to
    hold an MCQ subtotal separately from a CQ or practical mark. Accepting a
    mixed subject here would mean silently writing a partial mark into a field
    the rest of the system reads as the student's whole subject result.
    """
    row = await exams_repository.get_exam_subject(db, exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    exam_subject = row[0]

    sections = await exams_repository.list_exam_subject_sections(db, exam_subject_id)

    # No mark-scheme breakdown — the subject is graded as a single block, so the
    # whole thing is the MCQ paper.
    if not sections:
        return McqMarksResolution(mcq_full_marks=exam_subject.full_marks, source="whole_subject")

    mcq_sections = [s for s in sections if s.name.strip().lower() == MCQ_SECTION_NAME]

    if not mcq_sections:
        section_names = ", ".join(s.name for s in sections)
        raise ValidationException(
            "This exam subject has no MCQ section, so there is nothing for an OMR "
            f"sheet to score against. Its sections are: {section_names}. Add a section "
            'named "MCQ", or remove the section breakdown to treat the whole subject as MCQ.',
            details=[{"field": "exam_subject_id", "issue": "No MCQ section defined"}],
        )

    if len(sections) > 1:
        raise ValidationException(
            "OMR scanning is only supported for MCQ-only exam subjects",
            details=[
                {
                    "field": "exam_subject_id",
                    "issue": (
                        "This subject's marks are split across "
                        f"{len(sections)} sections ({', '.join(s.name for s in sections)}). "
                        "A scanned sheet can only produce the MCQ portion, and an exam "
                        "result stores a single combined mark per subject."
                    ),
                }
            ],
        )

    mcq_section = mcq_sections[0]
    return McqMarksResolution(
        mcq_full_marks=mcq_section.full_marks,
        source="section",
        section_id=mcq_section.id,
        section_name=mcq_section.name,
    )


# --- Shared access helpers ----------------------------------------------------


async def _get_owned_exam_subject(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID
) -> ExamSubject:
    row = await exams_repository.get_exam_subject(db, exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    exam_subject = row[0]
    await assert_owns_exam_subject(db, actor, exam_subject)
    return exam_subject


async def _assert_not_locked_by_applied_batch(db: AsyncSession, exam_subject_id: uuid.UUID) -> None:
    if await repository.has_applied_batch(db, exam_subject_id):
        raise ConflictException(
            "This exam subject already has an OMR batch applied to the marks roster, so its "
            "answer keys can no longer be changed. Recording marks that cannot be reproduced "
            "from the stored key would make the result unauditable."
        )


# --- Eligibility --------------------------------------------------------------


async def get_eligibility(db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID) -> dict:
    """Report whether an exam subject can be OMR-scanned, without raising.

    The UI needs to show ineligible subjects with the reason attached rather than
    discovering the failure only on submit, so D2's rejection is returned as data
    here instead of as an error.
    """
    await _get_owned_exam_subject(db, actor, exam_subject_id)

    keys = await repository.list_answer_keys(db, exam_subject_id)
    payload = {
        "exam_subject_id": str(exam_subject_id),
        "answer_key_set_codes": [key.set_code for key in keys],
        # A subject whose marks already came from a scan should not be scanned
        # again — the UI needs to know that before offering a new batch.
        "has_applied_batch": await repository.has_applied_batch(db, exam_subject_id),
    }

    try:
        resolution = await resolve_mcq_marks(db, exam_subject_id)
    except ValidationException as exc:
        return {**payload, "eligible": False, "reason": exc.message}

    return {
        **payload,
        "eligible": True,
        "mcq_full_marks": resolution.mcq_full_marks,
        "source": resolution.source,
        "section_name": resolution.section_name,
    }


# --- Answer keys --------------------------------------------------------------


async def save_answer_key(
    db: AsyncSession,
    actor: CurrentUser,
    exam_subject_id: uuid.UUID,
    set_code: str,
    payload: SaveAnswerKeyRequest,
) -> tuple[OmrAnswerKey, bool]:
    """Create or replace the answer key for one set code. Returns (key, created)."""
    await _get_owned_exam_subject(db, actor, exam_subject_id)
    await resolve_mcq_marks(db, exam_subject_id)
    await _assert_not_locked_by_applied_batch(db, exam_subject_id)

    answers = payload.to_storage()
    existing = await repository.get_answer_key_for_set(
        db, exam_subject_id=exam_subject_id, set_code=set_code
    )

    if existing is None:
        entity = await repository.create_answer_key(
            db,
            exam_subject_id=exam_subject_id,
            set_code=set_code,
            total_questions=payload.total_questions,
            answers=answers,
            marks_per_correct=payload.marks_per_correct,
            negative_marks=payload.negative_marks,
            created_by=actor.id,
        )
        await record_audit_log(
            db,
            actor_id=actor.id,
            action="omr.answer_key.create",
            entity_type="omr_answer_keys",
            entity_id=entity.id,
            new_value={"set_code": set_code, "total_questions": payload.total_questions},
        )
        await db.commit()
        return entity, True

    old_value = {
        "set_code": existing.set_code,
        "total_questions": existing.total_questions,
        "answers": existing.answers,
    }
    entity = await repository.update_answer_key_fields(
        db,
        existing,
        {
            "total_questions": payload.total_questions,
            "answers": answers,
            "marks_per_correct": payload.marks_per_correct,
            "negative_marks": payload.negative_marks,
        },
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.answer_key.replace",
        entity_type="omr_answer_keys",
        entity_id=entity.id,
        old_value=old_value,
        new_value={"set_code": set_code, "total_questions": payload.total_questions},
    )
    await db.commit()
    # `updated_at` is computed server-side via onupdate, so the ORM leaves it
    # stale after an UPDATE. Refresh here, inside the async context — otherwise
    # serialising the response lazy-loads it and raises MissingGreenlet.
    await db.refresh(entity)
    return entity, False


async def list_answer_keys(
    db: AsyncSession, actor: CurrentUser, exam_subject_id: uuid.UUID
) -> list[OmrAnswerKey]:
    await _get_owned_exam_subject(db, actor, exam_subject_id)
    return await repository.list_answer_keys(db, exam_subject_id)


async def delete_answer_key(db: AsyncSession, actor: CurrentUser, answer_key_id: uuid.UUID) -> None:
    entity = await repository.get_answer_key(db, answer_key_id)
    if entity is None:
        raise NotFoundException("Answer key not found")

    await _get_owned_exam_subject(db, actor, entity.exam_subject_id)
    await _assert_not_locked_by_applied_batch(db, entity.exam_subject_id)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.answer_key.delete",
        entity_type="omr_answer_keys",
        entity_id=entity.id,
        old_value={
            "exam_subject_id": str(entity.exam_subject_id),
            "set_code": entity.set_code,
            "total_questions": entity.total_questions,
            "answers": entity.answers,
        },
    )
    await repository.delete_answer_key(db, entity)
    await db.commit()


# --- Batches ------------------------------------------------------------------


async def _visible_exam_subject_ids(db: AsyncSession, actor: CurrentUser) -> list[uuid.UUID] | None:
    """Exam subjects this actor may see batches for. None means "no restriction"."""
    if actor.role in ("admin", "principal"):
        return None
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None:
        raise NotFoundException("Teacher profile not found")
    rows = await exams_repository.list_exam_subjects_for_teacher(db, teacher_record[0].id)
    return [row[0].id for row in rows]


async def _get_owned_batch(db: AsyncSession, actor: CurrentUser, batch_id: uuid.UUID) -> OmrBatch:
    batch = await repository.get_batch(db, batch_id)
    if batch is None:
        raise NotFoundException("OMR batch not found")
    await _get_owned_exam_subject(db, actor, batch.exam_subject_id)
    return batch


async def create_batch(db: AsyncSession, actor: CurrentUser, payload: CreateBatchRequest) -> OmrBatch:
    await _get_owned_exam_subject(db, actor, payload.exam_subject_id)
    resolution = await resolve_mcq_marks(db, payload.exam_subject_id)

    keys = await repository.list_answer_keys(db, payload.exam_subject_id)
    if not keys:
        raise ValidationException(
            "Define an answer key for this exam subject before scanning sheets — "
            "without one there is nothing to score the sheets against.",
            details=[{"field": "exam_subject_id", "issue": "No answer key defined"}],
        )

    template_path(settings.omr_template_name)  # fail fast if the template is missing

    batch = await repository.create_batch(
        db,
        exam_subject_id=payload.exam_subject_id,
        name=payload.name,
        template_name=settings.omr_template_name,
        mcq_full_marks=resolution.mcq_full_marks,
        uploaded_by=actor.id,
    )
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.batch.create",
        entity_type="omr_batches",
        entity_id=batch.id,
        new_value={
            "exam_subject_id": str(payload.exam_subject_id),
            "name": payload.name,
            "mcq_full_marks": resolution.mcq_full_marks,
            "template_name": settings.omr_template_name,
        },
    )
    await db.commit()
    return batch


async def list_batches(
    db: AsyncSession,
    actor: CurrentUser,
    *,
    exam_subject_id: uuid.UUID | None = None,
    status: OmrBatchStatus | None = None,
) -> list[OmrBatch]:
    if exam_subject_id is not None:
        await _get_owned_exam_subject(db, actor, exam_subject_id)
        return await repository.list_batches(db, exam_subject_id=exam_subject_id, status=status)

    visible = await _visible_exam_subject_ids(db, actor)
    if visible is not None and not visible:
        return []
    return await repository.list_batches(db, exam_subject_ids=visible, status=status)


async def get_batch(db: AsyncSession, actor: CurrentUser, batch_id: uuid.UUID) -> OmrBatch:
    return await _get_owned_batch(db, actor, batch_id)


async def list_sheets(
    db: AsyncSession,
    actor: CurrentUser,
    batch_id: uuid.UUID,
    *,
    status: OmrSheetStatus | None = None,
    match_status: OmrMatchStatus | None = None,
) -> list[tuple[OmrSheet, object, object]]:
    await _get_owned_batch(db, actor, batch_id)
    return await repository.list_sheets(db, batch_id, status=status, match_status=match_status)


async def get_sheet(db: AsyncSession, actor: CurrentUser, sheet_id: uuid.UUID) -> OmrSheet:
    sheet = await repository.get_sheet(db, sheet_id)
    if sheet is None:
        raise NotFoundException("OMR sheet not found")
    await _get_owned_batch(db, actor, sheet.batch_id)
    return sheet


async def delete_batch(db: AsyncSession, actor: CurrentUser, batch_id: uuid.UUID) -> None:
    batch = await _get_owned_batch(db, actor, batch_id)
    if batch.status == OmrBatchStatus.applied:
        raise ConflictException(
            "This batch has already been applied to the marks roster and can no longer be "
            "deleted — the scanned sheets are the evidence for marks that are now recorded."
        )

    assets = await repository.list_sheet_assets(db, batch_id)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.batch.delete",
        entity_type="omr_batches",
        entity_id=batch.id,
        old_value={
            "exam_subject_id": str(batch.exam_subject_id),
            "name": batch.name,
            "sheet_count": batch.sheet_count,
        },
    )
    await repository.delete_batch(db, batch)
    await db.commit()

    # Remote assets are removed only after the rows are safely gone: a failed
    # delete here leaves an orphaned image, whereas deleting first and then
    # failing the commit would leave rows pointing at images that no longer exist.
    for image_public_id, annotated_public_id in assets:
        for public_id in (image_public_id, annotated_public_id):
            if not public_id:
                continue
            try:
                await delete_asset(public_id)
            except Exception:
                logger.exception("Failed to delete OMR asset %s for batch %s", public_id, batch_id)


# --- Sheet upload and processing ----------------------------------------------


def _scale_to_ceiling(adjusted_score: float, key_max_marks: float, ceiling: int) -> float:
    """Rescale a key's raw score onto the batch's MCQ ceiling and clamp it.

    Clamping matters because negative marking can drive a raw score below zero,
    and `exam_results.marks_obtained` must never receive a negative mark.
    """
    if key_max_marks <= 0:
        return 0.0
    scaled = adjusted_score if key_max_marks == ceiling else adjusted_score / key_max_marks * ceiling
    return round(min(max(scaled, 0.0), float(ceiling)), 2)


def _select_answer_key(
    keys: list[OmrAnswerKey], detected_set_code: str | None
) -> tuple[OmrAnswerKey | None, str | None]:
    """Choose the key matching the sheet's set code. Returns (key, reason_if_none)."""
    if detected_set_code:
        for key in keys:
            if key.set_code.lower() == detected_set_code.lower():
                return key, None
        return None, f"No answer key is defined for set code '{detected_set_code}'"

    if len(keys) == 1:
        return keys[0], None
    return None, "The set code could not be read and this subject has more than one answer key"


def _answers_with_int_keys(stored: dict | None) -> dict[int, dict]:
    """Stored answers are JSONB (string keys); the scorer keys by question number."""
    return {int(question): entry for question, entry in (stored or {}).items()}


def _score_into_sheet(
    sheet: OmrSheet, *, answers: dict[int, dict], keys: list[OmrAnswerKey], mcq_full_marks: int
) -> str | None:
    """Score `answers` into the sheet's mark fields. Returns a reason if it could not.

    Shared by upload and review so a corrected sheet is scored by exactly the
    same key-selection, scaling, and clamping rules as a freshly scanned one.
    """
    key, key_problem = _select_answer_key(keys, sheet.detected_set_code)
    if key is None:
        sheet.correct_count = None
        sheet.wrong_count = None
        sheet.blank_count = None
        sheet.multiple_count = None
        sheet.score_details = None
        sheet.marks_obtained = None
        sheet.percentage = None
        return key_problem

    scorer = OMRScorer(
        config=ScoringConfig(
            marks_per_correct=float(key.marks_per_correct),
            negative_marks=float(key.negative_marks),
        )
    )
    score = scorer.score(answers, {"answers": key.answers})

    sheet.correct_count = score["correct"]
    sheet.wrong_count = score["wrong"]
    sheet.blank_count = score["blank"]
    sheet.multiple_count = score["multiple"]
    sheet.score_details = score["details"]
    sheet.marks_obtained = _scale_to_ceiling(
        score["adjusted_score"], score["max_marks"], mcq_full_marks
    )
    sheet.percentage = (
        round(float(sheet.marks_obtained) / mcq_full_marks * 100, 2) if mcq_full_marks else 0.0
    )
    return None


def _apply_review_status(
    sheet: OmrSheet,
    *,
    answers: dict[int, dict],
    key_problem: str | None,
    verification_flags: list[str],
    extra_note: str | None = None,
) -> None:
    """Recompute status and the review note from the sheet's current state."""
    reasons = list(verification_flags)
    if key_problem:
        reasons.append(key_problem)
    if sheet.match_status not in (OmrMatchStatus.matched, OmrMatchStatus.manual):
        reasons.append(f"Student match needs attention ({sheet.match_status.value})")

    unclear = sorted(
        question
        for question, entry in answers.items()
        if entry.get("status") in ("multiple", "ambiguous")
    )
    if unclear:
        reasons.append(
            f"{len(unclear)} question(s) read as multiple or ambiguous: "
            + ", ".join(str(q) for q in unclear[:10])
            + ("..." if len(unclear) > 10 else "")
        )

    sheet.status = OmrSheetStatus.needs_review if reasons else OmrSheetStatus.processed
    if extra_note:
        reasons.append(extra_note)
    sheet.review_note = "\n".join(reasons) or None


async def _sync_batch_status(db: AsyncSession, batch: OmrBatch) -> OmrBatch:
    """Recount the batch and move it between draft / processing / ready.

    An applied batch is terminal — its sheets are the evidence for marks already
    recorded, so nothing here may walk it back.
    """
    await repository.recount_batch(db, batch)
    if batch.status == OmrBatchStatus.applied:
        return batch

    total = batch.sheet_count
    outstanding = await repository.count_sheets_needing_attention(db, batch.id)

    if total == 0:
        batch.status = OmrBatchStatus.draft
    elif outstanding:
        batch.status = OmrBatchStatus.processing
    else:
        batch.status = OmrBatchStatus.ready
    await db.flush()
    return batch


async def _load_roll_candidates(db: AsyncSession, row: ExamSubjectRow) -> list[RollCandidate]:
    _exam_subject, exam, class_entity, _subject, _teacher, _user = row
    students = await results_repository.list_students_in_class(
        db, academic_year_id=exam.academic_year_id, class_id=class_entity.id
    )
    return [
        RollCandidate(student_id=student.id, roll_number=enrollment.roll_number)
        for student, _user, enrollment, _section in students
    ]


async def upload_sheets(
    db: AsyncSession, actor: CurrentUser, batch_id: uuid.UUID, files: list[UploadFile]
) -> dict:
    batch = await _get_owned_batch(db, actor, batch_id)
    if batch.status == OmrBatchStatus.applied:
        raise ConflictException("This batch has already been applied and cannot accept more sheets")

    if not files:
        raise ValidationException("No sheets were uploaded")
    if len(files) > settings.omr_max_sheets_per_request:
        raise ValidationException(
            f"Upload at most {settings.omr_max_sheets_per_request} sheets per request — "
            f"{len(files)} were sent. Split the scan into smaller batches of images.",
            details=[{"field": "images", "issue": "Too many files in one request"}],
        )

    row = await exams_repository.get_exam_subject(db, batch.exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    _exam_subject, _exam, class_entity, subject, _teacher, _user = row

    keys = await repository.list_answer_keys(db, batch.exam_subject_id)
    candidates = await _load_roll_candidates(db, row)
    claimed = await repository.list_claimed_student_ids(db, batch_id)

    pipeline = OMRPipeline(
        template_path=template_path(batch.template_name),
        answer_key=None,  # scoring happens per sheet, once its set code is known
        debug=settings.omr_save_annotated_images,
    )

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    created: list[OmrSheet] = []
    rejected: list[dict] = []

    for upload in files:
        filename = upload.filename or "sheet"

        if upload.content_type not in SHEET_CONTENT_TYPES:
            rejected.append({"filename": filename, "reason": f"Unsupported file type '{upload.content_type}' — upload JPEG, PNG, or WEBP images"})
            continue

        data = await upload.read()
        if not data:
            rejected.append({"filename": filename, "reason": "File is empty"})
            continue
        if len(data) > max_bytes:
            rejected.append({"filename": filename, "reason": f"File exceeds the {settings.max_upload_size_mb}MB upload limit"})
            continue

        sheet_id = uuid.uuid4()
        folder = f"omr/{batch.exam_subject_id}/{batch.id}"

        try:
            asset = await upload_image_bytes(
                data, folder=folder, public_id=str(sheet_id), content_type=upload.content_type
            )
        except Exception as exc:
            # Nothing was stored, so there is no image to reprocess later and no
            # row worth keeping — report it and move on.
            logger.exception("Cloudinary upload failed for %s", filename)
            rejected.append({"filename": filename, "reason": f"Could not store the image: {exc}"})
            continue

        sheet = await _process_one_sheet(
            db,
            sheet_id=sheet_id,
            batch=batch,
            asset=asset,
            data=data,
            filename=filename,
            content_type=upload.content_type,
            folder=folder,
            pipeline=pipeline,
            keys=keys,
            candidates=candidates,
            claimed=claimed,
            expected_class_order=class_entity.numeric_order,
            expected_subject_code=subject.code,
        )
        created.append(sheet)
        if sheet.student_id is not None and sheet.match_status == OmrMatchStatus.matched:
            claimed.add(sheet.student_id)

    await _sync_batch_status(db, batch)

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.batch.upload_sheets",
        entity_type="omr_batches",
        entity_id=batch.id,
        new_value={"accepted": len(created), "rejected": len(rejected)},
    )
    await db.commit()
    # The batch row was UPDATEd (status + counters), so its server-side
    # `updated_at` is stale until refreshed — see the same note in save_answer_key.
    await db.refresh(batch)

    return {"batch": batch, "sheets": created, "rejected": rejected}


# --- Review and correction ----------------------------------------------------


async def _sheet_context(
    db: AsyncSession, actor: CurrentUser, sheet_id: uuid.UUID
) -> tuple[OmrSheet, OmrBatch, ExamSubjectRow]:
    sheet = await repository.get_sheet(db, sheet_id)
    if sheet is None:
        raise NotFoundException("OMR sheet not found")
    batch = await _get_owned_batch(db, actor, sheet.batch_id)
    if batch.status == OmrBatchStatus.applied:
        raise ConflictException(
            "This batch has already been applied to the marks roster; its sheets are now read-only"
        )
    row = await exams_repository.get_exam_subject(db, batch.exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    return sheet, batch, row


def _merge_answer_overrides(answers: dict[int, dict], overrides: dict[str, str]) -> list[int]:
    """Apply a reviewer's answers over the scanner's. Returns the questions changed."""
    changed = []
    for raw_question, option in overrides.items():
        question = int(raw_question)
        if question not in answers:
            raise ValidationException(
                f"Question {question} is not on this sheet",
                details=[{"field": "answer_overrides", "issue": f"Unknown question {question}"}],
            )
        previous = answers[question]
        answers[question] = {
            **previous,
            # The engine stores options upper-cased; keep that so the scorer's
            # comparison sees the same shape for scanned and overridden answers.
            "answer": option.upper(),
            "status": "answered",
            "confidence": "MANUAL",
            "overridden": True,
        }
        changed.append(question)
    return sorted(changed)


async def _assert_assignable_student(
    db: AsyncSession, sheet: OmrSheet, batch: OmrBatch, row: ExamSubjectRow, student_id: uuid.UUID
) -> None:
    candidates = await _load_roll_candidates(db, row)
    if student_id not in {candidate.student_id for candidate in candidates}:
        raise ValidationException(
            "That student is not enrolled in this batch's class for the exam's academic year",
            details=[{"field": "student_id", "issue": "Not enrolled in this class"}],
        )

    claimed = await repository.list_claimed_student_ids(db, batch.id, exclude_sheet_id=sheet.id)
    if student_id in claimed:
        raise ConflictException(
            "Another sheet in this batch is already matched to that student. Resolve the other "
            "sheet first — two sheets for one student means one of them is a mis-scan."
        )


async def patch_sheet(
    db: AsyncSession, actor: CurrentUser, sheet_id: uuid.UUID, payload
) -> OmrSheet:
    sheet, batch, row = await _sheet_context(db, actor, sheet_id)
    if sheet.status == OmrSheetStatus.failed and payload.student_id is not None:
        raise ValidationException(
            "This sheet could not be read, so there are no marks to attach to a student. "
            "Reprocess it first, or delete it and re-scan."
        )

    _exam_subject, _exam, class_entity, subject, _teacher, _user = row
    old_value = {
        "student_id": str(sheet.student_id) if sheet.student_id else None,
        "match_status": sheet.match_status.value if sheet.match_status else None,
        "marks_obtained": float(sheet.marks_obtained) if sheet.marks_obtained is not None else None,
    }

    if payload.student_id is not None:
        await _assert_assignable_student(db, sheet, batch, row, payload.student_id)
        sheet.student_id = payload.student_id
        sheet.match_status = OmrMatchStatus.manual
        sheet.matched_manually = True

    answers = _answers_with_int_keys(sheet.answers)
    overridden: list[int] = []
    if payload.answer_overrides:
        overridden = _merge_answer_overrides(answers, payload.answer_overrides)
        sheet.answers = {str(question): entry for question, entry in answers.items()}

    key_problem = _score_into_sheet(
        sheet, answers=answers, keys=await repository.list_answer_keys(db, batch.exam_subject_id),
        mcq_full_marks=batch.mcq_full_marks,
    )
    _apply_review_status(
        sheet,
        answers=answers,
        key_problem=key_problem,
        verification_flags=verify_sheet_origin(
            detected_class=sheet.detected_class,
            detected_subject_code=sheet.detected_subject_code,
            expected_class_order=class_entity.numeric_order,
            expected_subject_code=subject.code,
        ),
        extra_note=payload.review_note,
    )

    sheet.reviewed_by = actor.id
    sheet.reviewed_at = _utcnow()
    await db.flush()

    await _sync_batch_status(db, batch)
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.sheet.review",
        entity_type="omr_sheets",
        entity_id=sheet.id,
        old_value=old_value,
        new_value={
            "student_id": str(sheet.student_id) if sheet.student_id else None,
            "match_status": sheet.match_status.value if sheet.match_status else None,
            "marks_obtained": float(sheet.marks_obtained) if sheet.marks_obtained is not None else None,
            "overridden_questions": overridden,
        },
    )
    await db.commit()
    await db.refresh(sheet)
    return sheet


async def reprocess_sheet(
    db: AsyncSession, actor: CurrentUser, sheet_id: uuid.UUID, *, reset_match: bool = False
) -> OmrSheet:
    """Re-run the pipeline over the stored image, replacing every detected field.

    A manual student assignment survives by default — a reviewer's decision
    should not be silently undone by a re-read that still cannot see the roll.
    """
    sheet, batch, row = await _sheet_context(db, actor, sheet_id)
    _exam_subject, _exam, class_entity, subject, _teacher, _user = row

    keep_manual = sheet.matched_manually and not reset_match
    manual_student_id = sheet.student_id if keep_manual else None

    try:
        data = await fetch_asset(sheet.image_public_id, sheet.image_url)
    except Exception as exc:
        logger.exception("Could not read stored image for sheet %s", sheet_id)
        raise ValidationException(f"The stored sheet image could not be read back: {exc}") from exc

    pipeline = OMRPipeline(
        template_path=template_path(batch.template_name),
        answer_key=None,
        debug=settings.omr_save_annotated_images,
    )
    result = await run_in_threadpool(pipeline.process, data, str(sheet.id))

    if not result.get("success"):
        sheet.status = OmrSheetStatus.failed
        sheet.error_message = result.get("message") or "The sheet could not be read"
        sheet.processing_time_ms = result.get("processing_time_ms")
        sheet.reviewed_by = actor.id
        sheet.reviewed_at = _utcnow()
        await db.flush()
        await _sync_batch_status(db, batch)
        await db.commit()
        await db.refresh(sheet)
        return sheet

    metadata = result.get("metadata") or {}
    answers = result.get("answers") or {}

    sheet.error_message = None
    sheet.processing_time_ms = result.get("processing_time_ms")
    sheet.alignment_method = result.get("alignment_method")
    sheet.detected_class = (metadata.get("class_value") or {}).get("value")
    sheet.detected_roll = (metadata.get("roll_number") or {}).get("roll_number")
    sheet.detected_subject_code = (metadata.get("subject_code") or {}).get("subject_code")
    sheet.detected_set_code = (metadata.get("set_code") or {}).get("value")
    sheet.answers = {str(question): entry for question, entry in answers.items()}

    if result.get("annotated_png"):
        try:
            annotated = await upload_image_bytes(
                result["annotated_png"],
                folder=f"omr/{batch.exam_subject_id}/{batch.id}",
                public_id=f"{sheet.id}_annotated",
                content_type="image/png",
            )
            sheet.annotated_image_url = annotated.url
            sheet.annotated_public_id = annotated.public_id
        except Exception:
            logger.exception("Failed to store annotated overlay while reprocessing %s", sheet_id)

    key_problem = _score_into_sheet(
        sheet,
        answers=answers,
        keys=await repository.list_answer_keys(db, batch.exam_subject_id),
        mcq_full_marks=batch.mcq_full_marks,
    )

    if keep_manual:
        sheet.student_id = manual_student_id
        sheet.match_status = OmrMatchStatus.manual
    else:
        sheet.matched_manually = False
        candidates = await _load_roll_candidates(db, row)
        claimed = await repository.list_claimed_student_ids(db, batch.id, exclude_sheet_id=sheet.id)
        outcome = match_roll(sheet.detected_roll, candidates, claimed_student_ids=claimed)
        sheet.match_status = outcome.match_status
        sheet.student_id = outcome.student_id

    _apply_review_status(
        sheet,
        answers=answers,
        key_problem=key_problem,
        verification_flags=verify_sheet_origin(
            detected_class=sheet.detected_class,
            detected_subject_code=sheet.detected_subject_code,
            expected_class_order=class_entity.numeric_order,
            expected_subject_code=subject.code,
        ),
    )

    sheet.reviewed_by = actor.id
    sheet.reviewed_at = _utcnow()
    await db.flush()

    await _sync_batch_status(db, batch)
    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.sheet.reprocess",
        entity_type="omr_sheets",
        entity_id=sheet.id,
        new_value={
            "reset_match": reset_match,
            "detected_roll": sheet.detected_roll,
            "match_status": sheet.match_status.value if sheet.match_status else None,
        },
    )
    await db.commit()
    await db.refresh(sheet)
    return sheet


async def delete_sheet(db: AsyncSession, actor: CurrentUser, sheet_id: uuid.UUID) -> None:
    sheet, batch, _row = await _sheet_context(db, actor, sheet_id)
    assets = [sheet.image_public_id, sheet.annotated_public_id]

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.sheet.delete",
        entity_type="omr_sheets",
        entity_id=sheet.id,
        old_value={
            "batch_id": str(sheet.batch_id),
            "original_filename": sheet.original_filename,
            "detected_roll": sheet.detected_roll,
            "student_id": str(sheet.student_id) if sheet.student_id else None,
            "marks_obtained": float(sheet.marks_obtained) if sheet.marks_obtained is not None else None,
        },
    )
    await repository.delete_sheet(db, sheet)
    await _sync_batch_status(db, batch)
    await db.commit()

    for public_id in assets:
        if not public_id:
            continue
        try:
            await delete_asset(public_id)
        except Exception:
            logger.exception("Failed to delete OMR asset %s for sheet %s", public_id, sheet_id)


# --- Export -------------------------------------------------------------------


def _slugify(value: str, *, fallback: str = "batch") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", (value or "").strip()).strip("_")
    return cleaned[:60] or fallback


async def export_batch(
    db: AsyncSession, actor: CurrentUser, batch_id: uuid.UUID, export_format: str
) -> tuple[bytes, str, str]:
    """Render a batch to CSV or Excel. Returns (payload, filename, media_type)."""
    batch = await _get_owned_batch(db, actor, batch_id)

    row = await exams_repository.get_exam_subject(db, batch.exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    _exam_subject, exam, class_entity, subject, _teacher, _user = row

    records = await repository.list_sheets_for_export(
        db, batch_id, academic_year_id=exam.academic_year_id
    )

    rows = [
        SheetExportRow(
            student_name=student_user.full_name if student_user else None,
            admission_number=student.admission_number if student else None,
            class_roll=enrollment.roll_number if enrollment else None,
            status=sheet.status.value,
            match_status=sheet.match_status.value if sheet.match_status else None,
            detected_class=sheet.detected_class,
            detected_roll=sheet.detected_roll,
            detected_subject_code=sheet.detected_subject_code,
            detected_set_code=sheet.detected_set_code,
            correct=sheet.correct_count,
            wrong=sheet.wrong_count,
            blank=sheet.blank_count,
            multiple=sheet.multiple_count,
            marks_obtained=float(sheet.marks_obtained) if sheet.marks_obtained is not None else None,
            percentage=float(sheet.percentage) if sheet.percentage is not None else None,
            # Graded with the results module's own bands so this preview matches
            # the grade publish_results will eventually write.
            grade=(
                results_service._compute_grade(float(sheet.marks_obtained), batch.mcq_full_marks)
                if sheet.marks_obtained is not None
                else None
            ),
            source_file=sheet.original_filename,
            note=sheet.error_message or sheet.review_note,
            score_details=sheet.score_details,
        )
        for sheet, student, student_user, enrollment in records
    ]

    exporter = ResultExporter(
        title=f"{exam.name} — {class_entity.name} {subject.name} (OMR)",
        max_marks=batch.mcq_full_marks,
    )

    stem = "_".join(
        _slugify(part)
        for part in (exam.name, class_entity.name, subject.name)
    )
    date_stamp = _utcnow().date().isoformat()

    if export_format == "csv":
        return exporter.export_csv(rows), f"{stem}_omr_{date_stamp}.csv", "text/csv"

    return (
        exporter.export_excel(rows),
        f"{stem}_omr_{date_stamp}.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# --- Apply to the marks roster ------------------------------------------------


async def apply_batch(db: AsyncSession, actor: CurrentUser, batch_id: uuid.UUID) -> dict:
    """Write a reviewed batch's scores into the exam marks roster.

    The marks themselves are written by `results.service.save_marks`, not here:
    that is the function the whole approval chain is built around, and routing
    through it means ownership, the already-submitted guard, the deadline check,
    the enrolment check, and the full_marks ceiling all apply unchanged. Its
    exceptions are deliberately left to propagate — a teacher who missed the
    marks deadline should see the results module's own message, not an OMR
    paraphrase of it.
    """
    batch = await _get_owned_batch(db, actor, batch_id)
    if batch.status == OmrBatchStatus.applied:
        raise ConflictException(
            "This batch has already been applied to the marks roster"
        )
    if batch.status != OmrBatchStatus.ready:
        raise ConflictException(
            f"This batch is '{batch.status.value}'. Every sheet must be processed and its review "
            "resolved before the batch can be applied."
        )

    row = await exams_repository.get_exam_subject(db, batch.exam_subject_id)
    if row is None:
        raise NotFoundException("Exam subject configuration not found")
    _exam_subject, exam, class_entity, _subject, _teacher, _user = row

    applicable: list[OmrSheet] = []
    skipped: list[dict] = []
    for sheet, _student, _student_user in await repository.list_sheets(db, batch_id):
        if (
            sheet.match_status in (OmrMatchStatus.matched, OmrMatchStatus.manual)
            and sheet.student_id is not None
            and sheet.marks_obtained is not None
        ):
            applicable.append(sheet)
        else:
            skipped.append(
                {
                    "sheet_id": str(sheet.id),
                    "original_filename": sheet.original_filename,
                    "status": sheet.status.value,
                    "match_status": sheet.match_status.value if sheet.match_status else None,
                    "detected_roll": sheet.detected_roll,
                }
            )

    if not applicable:
        raise ValidationException(
            "No sheet in this batch is matched to a student with a score, so there is nothing "
            "to apply. Assign students to the scanned sheets first."
        )

    payload = SaveMarksRequest(
        items=[
            MarkEntryItem(
                student_id=sheet.student_id,
                marks_obtained=float(sheet.marks_obtained),
                is_absent=False,
            )
            for sheet in applicable
        ]
    )

    # Students with no sheet are reported back, never written. A missing sheet
    # means "not scanned", which is not the same as "absent" — inferring an
    # absence here would silently record a zero the student never earned.
    applied_student_ids = {sheet.student_id for sheet in applicable}
    enrolled = await results_repository.list_students_in_class(
        db, academic_year_id=exam.academic_year_id, class_id=class_entity.id
    )
    unscanned = [
        {
            "student_id": str(student.id),
            "full_name": student_user.full_name,
            "roll_number": enrollment.roll_number,
        }
        for student, student_user, enrollment, _section in enrolled
        if student.id not in applied_student_ids
    ]

    # Mutate the batch and sheets before delegating: save_marks commits, so
    # flushing first makes the whole apply land — or roll back — as one unit.
    batch.status = OmrBatchStatus.applied
    batch.applied_by = actor.id
    batch.applied_at = _utcnow()
    for sheet in applicable:
        sheet.status = OmrSheetStatus.applied

    await record_audit_log(
        db,
        actor_id=actor.id,
        action="omr.batch.apply",
        entity_type="omr_batches",
        entity_id=batch.id,
        new_value={
            "exam_subject_id": str(batch.exam_subject_id),
            "applied_count": len(applicable),
            "skipped_count": len(skipped),
            "unscanned_count": len(unscanned),
        },
    )
    await db.flush()

    await results_service.save_marks(db, actor, batch.exam_subject_id, payload)

    await db.refresh(batch)
    return {
        "batch": batch,
        "applied_count": len(applicable),
        "unscanned": unscanned,
        "skipped": skipped,
    }


async def _process_one_sheet(
    db: AsyncSession,
    *,
    sheet_id: uuid.UUID,
    batch: OmrBatch,
    asset,
    data: bytes,
    filename: str,
    content_type: str,
    folder: str,
    pipeline: OMRPipeline,
    keys: list[OmrAnswerKey],
    candidates: list[RollCandidate],
    claimed: set[uuid.UUID],
    expected_class_order: int,
    expected_subject_code: str,
) -> OmrSheet:
    """Read, score, and match one sheet. Never raises — a bad sheet is recorded
    as failed so the rest of the upload still lands."""
    sheet = OmrSheet(
        id=sheet_id,
        batch_id=batch.id,
        original_filename=filename[:255],
        image_url=asset.url,
        image_public_id=asset.public_id,
        status=OmrSheetStatus.pending,
    )

    try:
        result = await run_in_threadpool(pipeline.process, data, str(sheet_id))
    except Exception as exc:  # defensive: pipeline.process already traps its own errors
        logger.exception("OMR pipeline crashed for %s", filename)
        sheet.status = OmrSheetStatus.failed
        sheet.error_message = str(exc)
        return await repository.create_sheet(db, sheet)

    if not result.get("success"):
        sheet.status = OmrSheetStatus.failed
        sheet.error_message = result.get("message") or "The sheet could not be read"
        sheet.processing_time_ms = result.get("processing_time_ms")
        return await repository.create_sheet(db, sheet)

    metadata = result.get("metadata") or {}
    answers = result.get("answers") or {}

    sheet.processing_time_ms = result.get("processing_time_ms")
    sheet.alignment_method = result.get("alignment_method")
    sheet.detected_class = (metadata.get("class_value") or {}).get("value")
    sheet.detected_roll = (metadata.get("roll_number") or {}).get("roll_number")
    sheet.detected_subject_code = (metadata.get("subject_code") or {}).get("subject_code")
    sheet.detected_set_code = (metadata.get("set_code") or {}).get("value")
    sheet.answers = {str(question): data_ for question, data_ in answers.items()}

    if result.get("annotated_png"):
        try:
            annotated = await upload_image_bytes(
                result["annotated_png"],
                folder=folder,
                public_id=f"{sheet_id}_annotated",
                content_type="image/png",
            )
            sheet.annotated_image_url = annotated.url
            sheet.annotated_public_id = annotated.public_id
        except Exception:
            # The overlay is a review aid, not the record — losing it must not
            # cost us a sheet that was read successfully.
            logger.exception("Failed to store annotated overlay for %s", filename)

    # --- Score ---------------------------------------------------------------
    key_problem = _score_into_sheet(
        sheet, answers=answers, keys=keys, mcq_full_marks=batch.mcq_full_marks
    )

    # --- Match ---------------------------------------------------------------
    outcome: MatchOutcome = match_roll(sheet.detected_roll, candidates, claimed_student_ids=claimed)
    sheet.match_status = outcome.match_status
    sheet.student_id = outcome.student_id

    # --- Status --------------------------------------------------------------
    _apply_review_status(
        sheet,
        answers=answers,
        key_problem=key_problem,
        verification_flags=verify_sheet_origin(
            detected_class=sheet.detected_class,
            detected_subject_code=sheet.detected_subject_code,
            expected_class_order=expected_class_order,
            expected_subject_code=expected_subject_code,
        ),
    )

    return await repository.create_sheet(db, sheet)
