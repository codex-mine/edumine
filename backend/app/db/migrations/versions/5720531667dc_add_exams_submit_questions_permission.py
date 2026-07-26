"""add exams.submit_questions permission (teacher question submission + AI draft-assist)

Phase 8 introduces a teacher-facing mutating action (submit/save exam
questions, request a question-deadline extension, request an AI draft) that
is distinct from the existing read-only "exams.view" permission teachers
already hold, and distinct from "exams.manage" (Admin/Principal exam
creation and configuration). Granted to Admin as well so Admin/Principal can
exercise the same submission endpoints on a teacher's behalf if needed.

Revision ID: 5720531667dc
Revises: fc9a7b9d9f16
Create Date: 2026-07-26 15:05:00.000000

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '5720531667dc'
down_revision: Union[str, None] = 'fc9a7b9d9f16'
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

PERMISSION_CODE = "exams.submit_questions"
PERMISSION_MODULE = "exams"
PERMISSION_DESCRIPTION = "Submit/edit exam questions for own assigned exam subjects; request deadline extensions"
GRANTED_TO_ROLES = ["admin", "teacher"]


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
