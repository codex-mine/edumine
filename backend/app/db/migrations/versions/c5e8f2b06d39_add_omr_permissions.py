"""seed OMR scanning permissions and grant them to Admin and Teacher

Phase 3 of the OMR checker integration (docs/omr-implementation.md §3.3).

Four permissions separate the stages of the scanning workflow so that the
capability to run a scanner is not the same as the capability to push its output
into the marks roster:

- omr.manage_keys — define the correct answers for an exam subject
- omr.scan        — create batches and upload answer sheets
- omr.review      — correct what the scanner flagged (reassign a student,
                    override an answer, reprocess a sheet)
- omr.apply       — write verified scores into the exam marks roster

Granted to Admin and Teacher. Teachers are already the role that enters marks
("results.enter"), and every OMR route additionally enforces exam-subject
ownership, so a teacher can only scan their own subjects. Principal bypasses all
permission checks at the application layer (CurrentUser.has_permission) and so is
not granted rows here, matching how the base seed treats that role.

Note that omr.apply does not widen anyone's authority over results: applying a
batch routes through the existing results.save_marks path, which re-checks
ownership, the submission deadline, and the already-submitted guard, and the
Principal remains the sole approver and publisher.

Revision ID: c5e8f2b06d39
Revises: b4d7e1a95c28
Create Date: 2026-08-04 09:20:00.000000

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c5e8f2b06d39'
down_revision: Union[str, None] = 'b4d7e1a95c28'
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

PERMISSION_MODULE = "omr"
PERMISSIONS = [
    ("omr.manage_keys", "Create and modify OMR answer keys"),
    ("omr.scan", "Create OMR batches and upload answer sheets for scanning"),
    ("omr.review", "Review, correct, and reprocess scanned OMR sheets"),
    ("omr.apply", "Apply verified OMR scores to the exam marks roster"),
]
GRANTED_TO_ROLES = ["admin", "teacher"]


def upgrade() -> None:
    bind = op.get_bind()

    permission_ids = {code: uuid.uuid4() for code, _ in PERMISSIONS}
    op.bulk_insert(
        permissions_table,
        [
            {
                "id": permission_ids[code],
                "code": code,
                "module": PERMISSION_MODULE,
                "description": description,
            }
            for code, description in PERMISSIONS
        ],
    )

    role_rows = bind.execute(
        sa.select(roles_table.c.id).where(roles_table.c.name.in_(GRANTED_TO_ROLES))
    ).fetchall()
    role_ids = [role_id for (role_id,) in role_rows]

    op.bulk_insert(
        role_permissions_table,
        [
            {"role_id": role_id, "permission_id": permission_id}
            for role_id in role_ids
            for permission_id in permission_ids.values()
        ],
    )


def downgrade() -> None:
    bind = op.get_bind()
    codes = [code for code, _ in PERMISSIONS]

    bind.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code = ANY(:codes))"
        ),
        {"codes": codes},
    )
    bind.execute(sa.text("DELETE FROM permissions WHERE code = ANY(:codes)"), {"codes": codes})
