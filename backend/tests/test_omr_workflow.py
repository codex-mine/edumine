"""OMR scanning workflow tests.

Phase 3 scope: the eligibility resolver (Decision D2 in
docs/omr-implementation.md) — which exam subjects may be OMR-scanned, and what
MCQ marks ceiling applies to each.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.modules.academic.models import AcademicYear, Class, Subject
from app.modules.exams.models import Exam, ExamSubject, ExamSubjectSection
from app.modules.omr.service import resolve_mcq_marks
from app.modules.teachers.models import Teacher


async def _make_exam_subject(
    db: AsyncSession,
    suffix: str,
    *,
    full_marks: int = 100,
    sections: list[tuple[str, int]] | None = None,
) -> ExamSubject:
    """Build the minimal exam-subject chain the resolver needs.

    `sections` is a list of (name, full_marks); omit it for a subject with no
    mark-scheme breakdown.
    """
    teacher = (await db.execute(select(Teacher).limit(1))).scalars().first()
    assert teacher is not None, "the demo seed should provide at least one teacher"

    year = AcademicYear(
        name=f"Y{suffix}"[:20],
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        is_active=False,  # a partial unique index allows only one active year
    )
    class_entity = Class(name=f"Class {suffix}", numeric_order=9)
    subject = Subject(name=f"Subject {suffix}", code=f"S{suffix}"[:20])
    db.add_all([year, class_entity, subject])
    await db.flush()

    exam = Exam(
        academic_year_id=year.id,
        name=f"Exam {suffix}",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 10),
        created_by=teacher.user_id,
    )
    db.add(exam)
    await db.flush()

    now = datetime.now(timezone.utc)
    exam_subject = ExamSubject(
        exam_id=exam.id,
        class_id=class_entity.id,
        subject_id=subject.id,
        teacher_id=teacher.id,
        full_marks=full_marks,
        pass_marks=int(full_marks * 0.33),
        question_deadline=now + timedelta(hours=2),
        marks_deadline=now + timedelta(hours=3),
    )
    db.add(exam_subject)
    await db.flush()

    for order, (name, section_marks) in enumerate(sections or []):
        db.add(
            ExamSubjectSection(
                exam_subject_id=exam_subject.id,
                name=name,
                full_marks=section_marks,
                pass_marks=int(section_marks * 0.33),
                display_order=order,
            )
        )
    await db.flush()
    return exam_subject


# --- Eligible: the whole subject is MCQ ---------------------------------------


async def test_subject_without_sections_uses_flat_full_marks(db_session, unique_suffix):
    exam_subject = await _make_exam_subject(db_session, unique_suffix, full_marks=40)

    resolution = await resolve_mcq_marks(db_session, exam_subject.id)

    assert resolution.mcq_full_marks == 40
    assert resolution.source == "whole_subject"
    assert resolution.section_id is None


async def test_single_mcq_section_supplies_the_ceiling(db_session, unique_suffix):
    exam_subject = await _make_exam_subject(
        db_session, unique_suffix, full_marks=50, sections=[("MCQ", 50)]
    )

    resolution = await resolve_mcq_marks(db_session, exam_subject.id)

    assert resolution.mcq_full_marks == 50
    assert resolution.source == "section"
    assert resolution.section_name == "MCQ"
    assert resolution.section_id is not None


@pytest.mark.parametrize("name", ["mcq", "Mcq", "  MCQ  "])
async def test_mcq_section_name_matches_case_insensitively(db_session, unique_suffix, name):
    exam_subject = await _make_exam_subject(
        db_session, f"{unique_suffix}{abs(hash(name)) % 997}", full_marks=30, sections=[(name, 30)]
    )

    resolution = await resolve_mcq_marks(db_session, exam_subject.id)

    assert resolution.mcq_full_marks == 30
    assert resolution.source == "section"


# --- Ineligible ---------------------------------------------------------------


async def test_multi_section_subject_is_rejected(db_session, unique_suffix):
    """D2 option A: an MCQ subtotal has nowhere to live in the flat
    exam_results.marks_obtained, so mixed subjects are refused outright."""
    exam_subject = await _make_exam_subject(
        db_session, unique_suffix, full_marks=100, sections=[("MCQ", 40), ("CQ", 60)]
    )

    with pytest.raises(ValidationException) as exc:
        await resolve_mcq_marks(db_session, exam_subject.id)

    assert exc.value.message == "OMR scanning is only supported for MCQ-only exam subjects"
    assert "CQ" in exc.value.details[0]["issue"]


async def test_subject_with_sections_but_no_mcq_is_rejected(db_session, unique_suffix):
    exam_subject = await _make_exam_subject(
        db_session, unique_suffix, full_marks=100, sections=[("Written", 70), ("Practical", 30)]
    )

    with pytest.raises(ValidationException) as exc:
        await resolve_mcq_marks(db_session, exam_subject.id)

    message = exc.value.message
    assert "no MCQ section" in message
    # The message must name what the subject actually has, so the fix is obvious.
    assert "Written" in message and "Practical" in message


async def test_unknown_exam_subject_raises_not_found(db_session):
    with pytest.raises(NotFoundException):
        await resolve_mcq_marks(db_session, uuid.uuid4())
