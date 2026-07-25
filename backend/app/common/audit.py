"""Audit trail writer shared by every module that mutates sensitive records.

Data Integrity Rule 7 (database.md Section 8): hard delete is a separate,
explicitly audited operation. Architecture.md 2.6 additionally requires
create/update/delete actions on sensitive modules (billing, results, users)
to be logged with actor, action, and timestamp.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.models import AuditLog


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
            old_value=old_value,
            new_value=new_value,
        )
    )
    await db.flush()
