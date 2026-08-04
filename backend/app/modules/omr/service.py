"""OMR scanning service.

Phase 3 scope: the eligibility resolver only. It answers a single question —
"can this exam subject be OMR-scanned, and if so what is the MCQ marks ceiling?"
— which every later phase depends on (batch creation snapshots the ceiling,
scoring scales into it, and apply-to-roster is bounded by it).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.modules.exams import repository as exams_repository

# The mark-scheme section that an OMR sheet corresponds to. Matched
# case-insensitively so "MCQ", "mcq", and "Mcq" all resolve.
MCQ_SECTION_NAME = "mcq"


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
