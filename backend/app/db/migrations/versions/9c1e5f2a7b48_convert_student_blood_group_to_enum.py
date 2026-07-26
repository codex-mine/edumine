"""convert students.blood_group from free text to a blood_group enum

Bug Fix & Feature Requirements (Students #1): Blood Group must be a
select/dropdown field, not a text input. The column was previously an
unconstrained varchar(5). This creates a native Postgres enum with the eight
standard blood groups and migrates the column to it, normalizing existing
values (trimmed/uppercased) and nulling out anything that doesn't match one
of the eight groups rather than failing the migration.

Revision ID: 9c1e5f2a7b48
Revises: 6a2d9f4e1b83
Create Date: 2026-07-26 17:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9c1e5f2a7b48'
down_revision: Union[str, None] = '6a2d9f4e1b83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BLOOD_GROUP_VALUES = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")


def upgrade() -> None:
    bind = op.get_bind()

    blood_group_enum = sa.Enum(*BLOOD_GROUP_VALUES, name="blood_group")
    blood_group_enum.create(bind, checkfirst=True)

    op.execute(
        """
        ALTER TABLE students
        ALTER COLUMN blood_group TYPE blood_group
        USING (
            CASE WHEN upper(trim(blood_group)) IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
                THEN upper(trim(blood_group))
                ELSE NULL
            END
        )::blood_group
        """
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.execute("ALTER TABLE students ALTER COLUMN blood_group TYPE VARCHAR(5) USING blood_group::text")

    blood_group_enum = sa.Enum(*BLOOD_GROUP_VALUES, name="blood_group")
    blood_group_enum.drop(bind, checkfirst=True)
