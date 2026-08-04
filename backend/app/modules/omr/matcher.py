"""Resolve a scanned sheet to a student (Decision D3 in docs/omr-implementation.md).

A batch is bound to one exam subject, so the class, subject, and academic year
are already known before any sheet is read. That leaves the roll number as the
only lookup key — and it makes the sheet's own class and subject-code fields
*verification* signals rather than search terms: when they disagree with the
batch, the sheet was probably scanned into the wrong batch, which is worth
flagging for a human but must not change who the sheet is matched to.
"""

import uuid
from dataclasses import dataclass, field

from app.common.enums import OmrMatchStatus

# The sheet's roll field is a fixed 6-column grid, so an unreadable column comes
# back as "?" from the extractor rather than being omitted.
UNREADABLE_DIGIT = "?"


@dataclass(frozen=True)
class RollCandidate:
    """One enrolled student a detected roll number could refer to."""

    student_id: uuid.UUID
    roll_number: str


@dataclass(frozen=True)
class MatchOutcome:
    match_status: OmrMatchStatus
    student_id: uuid.UUID | None = None
    verification_flags: list[str] = field(default_factory=list)


def _exact(detected: str, roll: str) -> bool:
    return detected == roll


def _zero_stripped(detected: str, roll: str) -> bool:
    """The sheet zero-pads to 6 columns ("012"); enrollment rolls rarely do ("12")."""
    return detected.lstrip("0") == roll.lstrip("0")


def _numeric(detected: str, roll: str) -> bool:
    try:
        return int(detected) == int(roll)
    except ValueError:
        return False


# Tried in order, stopping at the first tier that yields any candidate. Ordered
# rather than OR-ed so a looser rule can never pull in extra students when a
# stricter one already found the answer.
_MATCH_TIERS = (_exact, _zero_stripped, _numeric)


def match_roll(
    detected_roll: str | None,
    candidates: list[RollCandidate],
    *,
    claimed_student_ids: set[uuid.UUID],
) -> MatchOutcome:
    """Resolve a detected roll number against the batch class's enrolled students.

    `claimed_student_ids` are students already matched by another sheet in the
    same batch — a second sheet for the same student is a duplicate scan, not a
    silent overwrite.
    """
    if not detected_roll or UNREADABLE_DIGIT in detected_roll:
        return MatchOutcome(OmrMatchStatus.unreadable)

    detected = detected_roll.strip()

    matches: list[RollCandidate] = []
    for tier in _MATCH_TIERS:
        matches = [c for c in candidates if tier(detected, c.roll_number.strip())]
        if matches:
            break

    if not matches:
        return MatchOutcome(OmrMatchStatus.unmatched)

    # Roll numbers are unique per (section, roll), not per class — two sections of
    # the same class can both legitimately have a roll "1". Picking the first
    # would silently assign marks to the wrong student, so this needs a human.
    if len({c.student_id for c in matches}) > 1:
        return MatchOutcome(OmrMatchStatus.ambiguous)

    student_id = matches[0].student_id
    if student_id in claimed_student_ids:
        return MatchOutcome(OmrMatchStatus.duplicate, student_id=student_id)

    return MatchOutcome(OmrMatchStatus.matched, student_id=student_id)


def verify_sheet_origin(
    *,
    detected_class: int | None,
    detected_subject_code: str | None,
    expected_class_order: int,
    expected_subject_code: str,
) -> list[str]:
    """Cross-check the sheet's own class/subject fields against the batch.

    Both checks are skipped when they cannot be compared meaningfully: the class
    field is only compared when it was actually read, and the subject field only
    when the school's subject code is numeric. Subject codes here are free-form
    strings (e.g. "MATH101") while the sheet's field is three digits, so
    comparing them unconditionally would flag every single sheet and train
    reviewers to ignore the flag.
    """
    flags: list[str] = []

    if detected_class is not None and detected_class != expected_class_order:
        flags.append(
            f"Sheet is marked class {detected_class} but this batch is for class {expected_class_order}"
        )

    if detected_subject_code and UNREADABLE_DIGIT not in detected_subject_code:
        expected = expected_subject_code.strip()
        if expected.isdigit() and int(detected_subject_code) != int(expected):
            flags.append(
                f"Sheet is marked subject code {detected_subject_code} but this batch is for {expected}"
            )

    return flags
