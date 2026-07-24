"""seed roles and permissions

Revision ID: f3301ef1c0b3
Revises: 7bcce9c0a390
Create Date: 2026-07-24 15:42:05.121383

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f3301ef1c0b3'
down_revision: Union[str, None] = '7bcce9c0a390'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

roles_table = sa.table(
    "roles",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("description", sa.Text),
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

# Roles exactly as enumerated in database.md's `roles.name` description.
ROLES = [
    ("principal", "Head of institute; full system access including result approval and hard delete."),
    ("admin", "Day-to-day administrator; manages people, academics, billing, and operations."),
    ("teacher", "Subject/class teacher; manages attendance, question/marks submission for own classes."),
    ("accountant", "Manages billing, payments, and payroll."),
    ("receptionist", "Front-desk operations; student/guardian records and fee collection."),
    ("staff", "General non-teaching staff; asset handling and general operations."),
    ("student", "Read-only access to own academic, attendance, and billing records."),
    ("guardian", "Read-only access to linked students' academic, attendance, and billing records."),
]

# code, module, description
PERMISSIONS = [
    ("users.view", "users", "View admin/staff/accountant/receptionist accounts"),
    ("users.create", "users", "Create admin/staff/accountant/receptionist accounts"),
    ("users.update", "users", "Update admin/staff/accountant/receptionist accounts"),
    ("users.delete", "users", "Deactivate/soft-delete admin/staff/accountant/receptionist accounts"),
    ("students.view", "students", "View student profiles"),
    ("students.create", "students", "Create student profiles"),
    ("students.update", "students", "Update student profiles"),
    ("students.delete", "students", "Soft-delete student profiles"),
    ("teachers.view", "teachers", "View teacher profiles"),
    ("teachers.create", "teachers", "Create teacher profiles"),
    ("teachers.update", "teachers", "Update teacher profiles"),
    ("teachers.delete", "teachers", "Soft-delete teacher profiles"),
    ("guardians.view", "guardians", "View guardian profiles"),
    ("guardians.create", "guardians", "Create guardian profiles"),
    ("guardians.update", "guardians", "Update guardian profiles"),
    ("guardians.delete", "guardians", "Soft-delete guardian profiles"),
    ("academic.view", "academic", "View academic years, classes, sections, subjects, rooms"),
    ("academic.manage", "academic", "Manage academic years, classes, sections, subjects, rooms"),
    ("routine.view", "routine", "View class routines"),
    ("routine.manage", "routine", "Create/update class routines"),
    ("attendance.view", "attendance", "View biometric and class attendance records"),
    ("attendance.mark", "attendance", "Mark subject-wise/period-wise attendance"),
    ("exams.view", "exams", "View exam schedules and configuration"),
    ("exams.manage", "exams", "Create/update exams and exam-subject configuration"),
    ("results.view", "results", "View exam results"),
    ("results.enter", "results", "Enter/update student marks"),
    ("results.approve", "results", "Approve compiled results for publication (Principal)"),
    ("results.publish", "results", "Publish approved results to students/guardians"),
    ("billing.view", "billing", "View invoices and dues"),
    ("billing.manage", "billing", "Create invoices, discounts, and fee structures"),
    ("billing.collect_payment", "billing", "Record fee payments against invoices"),
    ("payroll.view", "payroll", "View salary structures, payroll runs, and payslips"),
    ("payroll.manage", "payroll", "Manage salary structures and process payroll runs"),
    ("expenses.view", "expenses", "View expense records"),
    ("expenses.create", "expenses", "Submit expense requests"),
    ("expenses.approve", "expenses", "Approve/reject expense requests"),
    ("assets.view", "assets", "View asset registry and logs"),
    ("assets.manage", "assets", "Create/update assets and record asset changes"),
    ("communication.view", "communication", "View announcements and SMS logs"),
    ("communication.manage", "communication", "Create/send announcements"),
    ("audit.view", "audit", "View system audit logs"),
    ("dashboard.view", "dashboard", "View role-specific dashboard widgets"),
]

# role_name -> list of permission codes; "__ALL__" grants every permission defined above.
ROLE_PERMISSION_CODES = {
    "principal": "__ALL__",
    "admin": [code for code, *_ in PERMISSIONS if code != "results.approve"],
    "teacher": [
        "students.view",
        "teachers.view",
        "attendance.view",
        "attendance.mark",
        "exams.view",
        "results.view",
        "results.enter",
        "routine.view",
        "communication.view",
        "dashboard.view",
    ],
    "accountant": [
        "billing.view",
        "billing.manage",
        "billing.collect_payment",
        "payroll.view",
        "payroll.manage",
        "expenses.view",
        "expenses.create",
        "dashboard.view",
    ],
    "receptionist": [
        "students.view",
        "guardians.view",
        "communication.view",
        "communication.manage",
        "billing.view",
        "billing.collect_payment",
        "dashboard.view",
    ],
    "staff": [
        "assets.view",
        "assets.manage",
        "communication.view",
        "dashboard.view",
    ],
    "student": [
        "dashboard.view",
        "results.view",
        "attendance.view",
        "billing.view",
        "communication.view",
    ],
    "guardian": [
        "dashboard.view",
        "results.view",
        "attendance.view",
        "billing.view",
        "communication.view",
    ],
}


def upgrade() -> None:
    role_ids = {name: uuid.uuid4() for name, _ in ROLES}
    permission_ids = {code: uuid.uuid4() for code, _, _ in PERMISSIONS}

    op.bulk_insert(
        roles_table,
        [{"id": role_ids[name], "name": name, "description": description} for name, description in ROLES],
    )
    op.bulk_insert(
        permissions_table,
        [
            {"id": permission_ids[code], "code": code, "module": module, "description": description}
            for code, module, description in PERMISSIONS
        ],
    )

    role_permission_rows = []
    for role_name, codes in ROLE_PERMISSION_CODES.items():
        resolved_codes = list(permission_ids.keys()) if codes == "__ALL__" else codes
        for code in resolved_codes:
            role_permission_rows.append({"role_id": role_ids[role_name], "permission_id": permission_ids[code]})

    op.bulk_insert(role_permissions_table, role_permission_rows)


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions")
    op.execute("DELETE FROM permissions")
    op.execute("DELETE FROM roles")
