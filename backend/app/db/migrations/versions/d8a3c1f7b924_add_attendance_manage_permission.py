"""add attendance.manage permission (device registry + punch ingestion)

Phase 7 (Attendance Management) introduces biometric device registration and
raw punch-event ingestion — infrastructural actions distinct from a teacher's
"mark my class's attendance" (attendance.mark) or general "view records"
(attendance.view) permissions. Neither existing permission is an appropriate
gate for these (teacher holds attendance.mark but must never register
devices), so this adds a new permission row and grants it to Admin only
(Principal already bypasses all permission checks at the application layer).

Revision ID: d8a3c1f7b924
Revises: c7f92a4d6e15
Create Date: 2026-07-26 11:00:00.000000

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd8a3c1f7b924'
down_revision: Union[str, None] = 'c7f92a4d6e15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

roles_table = sa.table(
    "roles",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("name", sa.String),
)
permissions_table = sa.table(
    "permissions",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("code", sa.String),
    sa.column("module", sa.String),
    sa.column("description", sa.Text),
)
role_permissions_table = sa.table(
    "role_permissions",
    sa.column("role_id", UUID(as_uuid=True)),
    sa.column("permission_id", UUID(as_uuid=True)),
)

PERMISSION_CODE = "attendance.manage"
PERMISSION_MODULE = "attendance"
PERMISSION_DESCRIPTION = "Register biometric devices and ingest punch events"
GRANTED_TO_ROLES = ["admin"]


def upgrade() -> None:
    bind = op.get_bind()

    permission_id = uuid.uuid4()
    op.bulk_insert(
        permissions_table,
        [{"id": permission_id, "code": PERMISSION_CODE, "module": PERMISSION_MODULE, "description": PERMISSION_DESCRIPTION}],
    )

    role_rows = bind.execute(
        sa.select(roles_table.c.id, roles_table.c.name).where(roles_table.c.name.in_(GRANTED_TO_ROLES))
    ).fetchall()

    op.bulk_insert(
        role_permissions_table,
        [{"role_id": role_id, "permission_id": permission_id} for role_id, _ in role_rows],
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = :code)"),
        {"code": PERMISSION_CODE},
    )
    bind.execute(sa.text("DELETE FROM permissions WHERE code = :code"), {"code": PERMISSION_CODE})
