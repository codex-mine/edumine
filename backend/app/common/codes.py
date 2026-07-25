import uuid
from datetime import date


def generate_identifier(prefix: str) -> str:
    """Human-readable unique-enough code, e.g. STU-2026-4F91A2. Collisions are
    caught at the DB unique-constraint level and surfaced as ConflictException."""
    return f"{prefix}-{date.today().year}-{uuid.uuid4().hex[:6].upper()}"
