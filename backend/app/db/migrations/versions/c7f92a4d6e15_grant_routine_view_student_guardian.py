"""grant routine.view permission to student and guardian roles

Phase 6 (Routine Management) requires Student/Guardian to view their own
section's schedule. The routine.view permission row already exists (seeded
in f3301ef1c0b3) but was not granted to these two roles — this migration
only adds the missing role_permissions links, it does not touch the
original seed migration.

Revision ID: c7f92a4d6e15
Revises: b2e4f6a8c1d3
Create Date: 2026-07-26 10:00:00.000000

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c7f92a4d6e15'
down_revision: Union[str, None] = 'b2e4f6a8c1d3'
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
)
role_permissions_table = sa.table(
    "role_permissions",
    sa.column("role_id", UUID(as_uuid=True)),
    sa.column("permission_id", UUID(as_uuid=True)),
)

TARGET_ROLES = ["student", "guardian"]
PERMISSION_CODE = "routine.view"


def upgrade() -> None:
    bind = op.get_bind()

    role_rows = bind.execute(
        sa.select(roles_table.c.id, roles_table.c.name).where(roles_table.c.name.in_(TARGET_ROLES))
    ).fetchall()
    permission_id = bind.execute(
        sa.select(permissions_table.c.id).where(permissions_table.c.code == PERMISSION_CODE)
    ).scalar_one()

    op.bulk_insert(
        role_permissions_table,
        [{"role_id": role_id, "permission_id": permission_id} for role_id, _ in role_rows],
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE permission_id = (SELECT id FROM permissions WHERE code = :code)
              AND role_id IN (SELECT id FROM roles WHERE name IN :roles)
            """
        ).bindparams(sa.bindparam("roles", expanding=True)),
        {"code": PERMISSION_CODE, "roles": TARGET_ROLES},
    )
