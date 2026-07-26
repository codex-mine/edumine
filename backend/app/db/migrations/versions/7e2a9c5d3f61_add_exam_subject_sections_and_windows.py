"""add exam subject submission windows and configurable mark-scheme sections

Bug Fix & Feature Requirements (Exam Section):
- Question and Marks Submission Deadline must support a selectable date range
  — adds `question_window_opens_at` / `marks_window_opens_at` alongside the
  existing `question_deadline` / `marks_deadline` (closing bound) columns.
- Support multiple configurable subsections within a subject (CQ, MCQ,
  Practical, Lab, or custom), each with dedicated Total Marks and Pass Marks
  — adds `exam_subject_sections`, optional per exam subject.

Revision ID: 7e2a9c5d3f61
Revises: 3f6d8b1c4a72
Create Date: 2026-07-26 19:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '7e2a9c5d3f61'
down_revision: Union[str, None] = '3f6d8b1c4a72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('exam_subjects', sa.Column('question_window_opens_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('exam_subjects', sa.Column('marks_window_opens_at', sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        'exam_subject_sections',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            'exam_subject_id', UUID(as_uuid=True), sa.ForeignKey('exam_subjects.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('full_marks', sa.SmallInteger(), nullable=False),
        sa.Column('pass_marks', sa.SmallInteger(), nullable=False),
        sa.Column('display_order', sa.SmallInteger(), server_default=sa.text('0'), nullable=False),
    )
    op.create_index('ix_exam_subject_sections_exam_subject_id', 'exam_subject_sections', ['exam_subject_id'])


def downgrade() -> None:
    op.drop_index('ix_exam_subject_sections_exam_subject_id', table_name='exam_subject_sections')
    op.drop_table('exam_subject_sections')

    op.drop_column('exam_subjects', 'marks_window_opens_at')
    op.drop_column('exam_subjects', 'question_window_opens_at')
