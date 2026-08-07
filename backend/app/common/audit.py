"""Audit trail writer shared by every module that mutates sensitive records.

Data Integrity Rule 7 (database.md Section 8): hard delete is a separate,
explicitly audited operation. Architecture.md 2.6 additionally requires
create/update/delete actions on sensitive modules (billing, results, users)
to be logged with actor, action, and timestamp.
"""

import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.models import AuditLog


def _json_safe(value: Any) -> Any:
    """Coerce a value into something the JSONB columns can serialize.

    Callers routinely pass the same `fields` dict they hand to the repository
    layer, so it still holds live UUIDs, enums, dates, and Decimals. Those are
    not JSON-serializable, and the failure surfaces as a 500 on an otherwise
    valid update (e.g. relocating an asset, reassigning a section's teacher).
    Normalising here fixes every call site at once and leaves values that were
    already JSON-safe untouched.
    """
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    if isinstance(value, enum.Enum):
        return _json_safe(value.value)
    if isinstance(value, (uuid.UUID, datetime, date, time)):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    return value


async def record_audit_log(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=_json_safe(old_value),
            new_value=_json_safe(new_value),
        )
    )
    await db.flush()
