from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    actor_id: str | None
    actor_name: str | None
    action: str
    entity_type: str
    entity_id: str
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    created_at: datetime
