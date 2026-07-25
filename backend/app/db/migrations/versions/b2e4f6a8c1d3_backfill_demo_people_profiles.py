"""backfill demo people profiles for phase 4 people management

The RBAC demo-user seed (ea9d203fb1f2) only created `users` rows so every role
could log in before Phase 4 existed. Phase 4 introduces the students/teachers/
staff/guardians profile tables as first-class managed records, and the demo
teacher/staff/accountant/receptionist/guardian/student accounts need a matching
profile row to satisfy the "every role-typed user has a profile" data
integrity rule (database.md Section 8, Rule 1) and to exercise self-view
end-to-end without first requiring a fresh admission through the API. A demo
guardian-student link is also seeded so the bidirectional linking UI has data
to show immediately.

Revision ID: b2e4f6a8c1d3
Revises: a1c3e7f9b2d4
Create Date: 2026-07-25 10:00:00.000000

"""
import uuid
from datetime import date
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2e4f6a8c1d3'
down_revision: Union[str, None] = 'a1c3e7f9b2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

users_table = sa.table(
    "users",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("phone", sa.String),
)
teachers_table = sa.table(
    "teachers",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("user_id", UUID(as_uuid=True)),
    sa.column("employee_code", sa.String),
    sa.column("joining_date", sa.Date),
    sa.column("designation", sa.String),
)
staff_table = sa.table(
    "staff",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("user_id", UUID(as_uuid=True)),
    sa.column("employee_code", sa.String),
    sa.column("department", sa.String),
    sa.column("designation", sa.String),
    sa.column("joining_date", sa.Date),
)
guardians_table = sa.table(
    "guardians",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("user_id", UUID(as_uuid=True)),
    sa.column("occupation", sa.String),
)
students_table = sa.table(
    "students",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("user_id", UUID(as_uuid=True)),
    sa.column("admission_number", sa.String),
    sa.column("admission_date", sa.Date),
)
student_guardians_table = sa.table(
    "student_guardians",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("student_id", UUID(as_uuid=True)),
    sa.column("guardian_id", UUID(as_uuid=True)),
    sa.column("relation", sa.String),
    sa.column("is_primary", sa.Boolean),
)

# phone -> role, from ea9d203fb1f2's DEMO_USERS
DEMO_PHONES = {
    "teacher": "01700000003",
    "accountant": "01700000004",
    "receptionist": "01700000005",
    "staff": "01700000006",
    "student": "01700000007",
    "guardian": "01700000008",
}

STAFF_LIKE_DESIGNATION = {
    "accountant": ("ACC-DEMO-0001", "Accounts", "Accountant"),
    "receptionist": ("REC-DEMO-0001", "Front Desk", "Receptionist"),
    "staff": ("STF-DEMO-0001", "General", "General Staff"),
}


def upgrade() -> None:
    bind = op.get_bind()
    today = date.today()

    user_rows = bind.execute(
        sa.select(users_table.c.id, users_table.c.phone).where(users_table.c.phone.in_(DEMO_PHONES.values()))
    ).fetchall()
    user_id_by_phone = {phone: user_id for user_id, phone in user_rows}

    teacher_user_id = user_id_by_phone.get(DEMO_PHONES["teacher"])
    if teacher_user_id is not None:
        op.bulk_insert(
            teachers_table,
            [
                {
                    "id": uuid.uuid4(),
                    "user_id": teacher_user_id,
                    "employee_code": "TCH-DEMO-0001",
                    "joining_date": today,
                    "designation": "Subject Teacher",
                }
            ],
        )

    for role in ("accountant", "receptionist", "staff"):
        user_id = user_id_by_phone.get(DEMO_PHONES[role])
        if user_id is None:
            continue
        employee_code, department, designation = STAFF_LIKE_DESIGNATION[role]
        op.bulk_insert(
            staff_table,
            [
                {
                    "id": uuid.uuid4(),
                    "user_id": user_id,
                    "employee_code": employee_code,
                    "department": department,
                    "designation": designation,
                    "joining_date": today,
                }
            ],
        )

    guardian_id = None
    guardian_user_id = user_id_by_phone.get(DEMO_PHONES["guardian"])
    if guardian_user_id is not None:
        guardian_id = uuid.uuid4()
        op.bulk_insert(
            guardians_table,
            [{"id": guardian_id, "user_id": guardian_user_id, "occupation": "Guardian"}],
        )

    student_id = None
    student_user_id = user_id_by_phone.get(DEMO_PHONES["student"])
    if student_user_id is not None:
        student_id = uuid.uuid4()
        op.bulk_insert(
            students_table,
            [
                {
                    "id": student_id,
                    "user_id": student_user_id,
                    "admission_number": "STU-DEMO-0001",
                    "admission_date": today,
                }
            ],
        )

    if guardian_id is not None and student_id is not None:
        op.bulk_insert(
            student_guardians_table,
            [
                {
                    "id": uuid.uuid4(),
                    "student_id": student_id,
                    "guardian_id": guardian_id,
                    "relation": "guardian",
                    "is_primary": True,
                }
            ],
        )


def downgrade() -> None:
    bind = op.get_bind()
    phones = list(DEMO_PHONES.values())
    user_rows = bind.execute(
        sa.select(users_table.c.id).where(users_table.c.phone.in_(phones))
    ).fetchall()
    user_ids = [row[0] for row in user_rows]
    if not user_ids:
        return

    student_id_rows = bind.execute(
        sa.select(students_table.c.id).where(students_table.c.user_id.in_(user_ids))
    ).fetchall()
    guardian_id_rows = bind.execute(
        sa.select(guardians_table.c.id).where(guardians_table.c.user_id.in_(user_ids))
    ).fetchall()
    student_ids = [row[0] for row in student_id_rows]
    guardian_ids = [row[0] for row in guardian_id_rows]

    if student_ids or guardian_ids:
        op.execute(
            student_guardians_table.delete().where(
                sa.or_(
                    student_guardians_table.c.student_id.in_(student_ids or [uuid.uuid4()]),
                    student_guardians_table.c.guardian_id.in_(guardian_ids or [uuid.uuid4()]),
                )
            )
        )

    op.execute(teachers_table.delete().where(teachers_table.c.user_id.in_(user_ids)))
    op.execute(staff_table.delete().where(staff_table.c.user_id.in_(user_ids)))
    op.execute(guardians_table.delete().where(guardians_table.c.user_id.in_(user_ids)))
    op.execute(students_table.delete().where(students_table.c.user_id.in_(user_ids)))
