"""add exam_subjects.questions_payload (question submission content)

Phase 8 (Examination Management) tracks question *submission* (the
question_deadline/question_submitted_at pair already in database.md), but a
teacher's "Submit" action needs somewhere to persist the finalized question
set they authored/edited — including drafts produced via the AI draft-assist
flow and then reviewed/edited before submission. database.md's exam_subjects
table only tracks the submission timestamp, not content, so this is an
additive, nullable column scoped to this phase's explicit need — it does not
alter any existing column, constraint, or relationship.

Revision ID: fc9a7b9d9f16
Revises: d8a3c1f7b924
Create Date: 2026-07-26 15:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'fc9a7b9d9f16'
down_revision: Union[str, None] = 'd8a3c1f7b924'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exam_subjects', sa.Column('questions_payload', JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('exam_subjects', 'questions_payload')
