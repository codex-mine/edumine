"""seed demo users for RBAC login testing

One login-capable user per role so every role from database.md can be
exercised end-to-end (login -> session -> gated dashboard shell) before
Phase 4 (People & Identity Management) introduces real account creation.
All demo accounts share the password "Passw0rd!123" (bcrypt-hashed below).

Revision ID: ea9d203fb1f2
Revises: f3301ef1c0b3
Create Date: 2026-07-24 16:00:10.542105

"""
import uuid
from typing import Sequence, Union

import bcrypt
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ea9d203fb1f2'
down_revision: Union[str, None] = 'f3301ef1c0b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

roles_table = sa.table(
    "roles",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("name", sa.String),
)
users_table = sa.table(
    "users",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("role_id", UUID(as_uuid=True)),
    sa.column("full_name", sa.String),
    sa.column("email", sa.String),
    sa.column("phone", sa.String),
    sa.column("password_hash", sa.String),
)

DEMO_PASSWORD = "Passw0rd!123"

# role_name -> (full_name, phone, email)
DEMO_USERS = {
    "principal": ("Demo Principal", "01700000001", "principal@codexedumine.test"),
    "admin": ("Demo Admin", "01700000002", "admin@codexedumine.test"),
    "teacher": ("Demo Teacher", "01700000003", "teacher@codexedumine.test"),
    "accountant": ("Demo Accountant", "01700000004", "accountant@codexedumine.test"),
    "receptionist": ("Demo Receptionist", "01700000005", "receptionist@codexedumine.test"),
    "staff": ("Demo Staff", "01700000006", "staff@codexedumine.test"),
    "student": ("Demo Student", "01700000007", "student@codexedumine.test"),
    "guardian": ("Demo Guardian", "01700000008", "guardian@codexedumine.test"),
}


def upgrade() -> None:
    bind = op.get_bind()
    password_hash = bcrypt.hashpw(DEMO_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    role_rows = bind.execute(sa.select(roles_table.c.id, roles_table.c.name)).fetchall()
    role_ids = {name: role_id for role_id, name in role_rows}

    op.bulk_insert(
        users_table,
        [
            {
                "id": uuid.uuid4(),
                "role_id": role_ids[role_name],
                "full_name": full_name,
                "email": email,
                "phone": phone,
                "password_hash": password_hash,
            }
            for role_name, (full_name, phone, email) in DEMO_USERS.items()
        ],
    )


def downgrade() -> None:
    bind = op.get_bind()
    phones = [phone for _, phone, _ in DEMO_USERS.values()]
    stmt = sa.text("DELETE FROM users WHERE phone IN :phones").bindparams(
        sa.bindparam("phones", expanding=True)
    )
    bind.execute(stmt, {"phones": phones})
