"""add results.compile permission; restrict results.publish to Principal only

Phase 9 (Result Management) adds an Admin-facing "compile submitted marks and
submit for Principal approval" action, distinct from a teacher's own
"results.enter" (mark entry) and from the Principal-only "results.approve" /
"results.publish" actions — so this adds a dedicated "results.compile"
permission granted to Admin.

It also corrects the base seed (f3301ef1c0b3), which granted "results.publish"
to Admin as part of its "all permissions except results.approve" rule.
requirements.md 3.1 states the Principal holds "sole authority to approve and
publish final exam results" — so publishing, like approving, must not be
grantable to Admin. Principal already bypasses all permission checks at the
application layer (CurrentUser.has_permission), so revoking this row from
Admin leaves Principal as the only role that can publish, matching how
"results.approve" was already scoped in the base seed.

Revision ID: 6a2d9f4e1b83
Revises: 5720531667dc
Create Date: 2026-07-26 16:30:00.000000

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '6a2d9f4e1b83'
down_revision: Union[str, None] = '5720531667dc'
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

PERMISSION_CODE = "results.compile"
PERMISSION_MODULE = "results"
PERMISSION_DESCRIPTION = "Compile submitted marks and submit exam results for Principal approval"
GRANTED_TO_ROLES = ["admin"]

RESTRICTED_CODE = "results.publish"
RESTRICTED_FROM_ROLES = ["admin"]


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
    admin_role_ids = [role_id for role_id, _ in role_rows]
    op.bulk_insert(
        role_permissions_table,
        [{"role_id": role_id, "permission_id": permission_id} for role_id in admin_role_ids],
    )

    restricted_permission_id = bind.execute(
        sa.select(permissions_table.c.id).where(permissions_table.c.code == RESTRICTED_CODE)
    ).scalar_one()
    bind.execute(
        role_permissions_table.delete().where(
            role_permissions_table.c.permission_id == restricted_permission_id,
            role_permissions_table.c.role_id.in_(admin_role_ids),
        )
    )


def downgrade() -> None:
    bind = op.get_bind()

    role_rows = bind.execute(
        sa.select(roles_table.c.id).where(roles_table.c.name.in_(RESTRICTED_FROM_ROLES))
    ).fetchall()
    role_ids = [role_id for (role_id,) in role_rows]
    restricted_permission_id = bind.execute(
        sa.select(permissions_table.c.id).where(permissions_table.c.code == RESTRICTED_CODE)
    ).scalar_one()
    op.bulk_insert(
        role_permissions_table,
        [{"role_id": role_id, "permission_id": restricted_permission_id} for role_id in role_ids],
    )

    bind.execute(
        sa.text("DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = :code)"),
        {"code": PERMISSION_CODE},
    )
    bind.execute(sa.text("DELETE FROM permissions WHERE code = :code"), {"code": PERMISSION_CODE})
