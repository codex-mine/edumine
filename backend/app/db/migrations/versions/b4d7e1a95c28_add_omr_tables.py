"""add OMR scanning tables (answer keys, batches, sheets)

Phase 3 of the OMR checker integration (docs/omr-implementation.md §3.1).

Three tables back the scan → review → apply workflow:
- `omr_answer_keys` — correct answers per (exam subject, set code). Keyed per set
  code because the answer sheet carries a Set Code field, so one exam can be sat
  with shuffled question orders.
- `omr_batches` — one scanning run against a single exam subject. `mcq_full_marks`
  is snapshotted at creation so later edits to the exam's mark scheme cannot
  retroactively rescale sheets already scored, and `template_name` is per batch so
  a second sheet template needs no migration.
- `omr_sheets` — one scanned image: its Cloudinary location, what the pipeline
  read, which student it resolved to, and what it scored.

All state lives here rather than in process memory: the standalone OMR backend
cached results in module-level dicts, which would be incoherent across the two
uvicorn workers this deployment runs.

Revision ID: b4d7e1a95c28
Revises: ea79db763877
Create Date: 2026-08-04 09:10:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b4d7e1a95c28'
down_revision: Union[str, None] = 'ea79db763877'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'omr_answer_keys',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            'exam_subject_id', UUID(as_uuid=True), sa.ForeignKey('exam_subjects.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('set_code', sa.String(length=10), server_default=sa.text("'Ka'"), nullable=False),
        sa.Column('total_questions', sa.SmallInteger(), nullable=False),
        sa.Column('answers', JSONB(), nullable=False),
        sa.Column('marks_per_correct', sa.Numeric(4, 2), server_default=sa.text('1'), nullable=False),
        sa.Column('negative_marks', sa.Numeric(4, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.UniqueConstraint('exam_subject_id', 'set_code', name='uq_omr_answer_keys_subject_set'),
    )

    op.create_table(
        'omr_batches',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            'exam_subject_id', UUID(as_uuid=True), sa.ForeignKey('exam_subjects.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column(
            'status',
            sa.Enum('draft', 'processing', 'ready', 'applied', 'failed', name='omr_batch_status'),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column('template_name', sa.String(length=60), nullable=False),
        sa.Column('mcq_full_marks', sa.SmallInteger(), nullable=False),
        sa.Column('sheet_count', sa.SmallInteger(), server_default=sa.text('0'), nullable=False),
        sa.Column('processed_count', sa.SmallInteger(), server_default=sa.text('0'), nullable=False),
        sa.Column('matched_count', sa.SmallInteger(), server_default=sa.text('0'), nullable=False),
        sa.Column('failed_count', sa.SmallInteger(), server_default=sa.text('0'), nullable=False),
        sa.Column('uploaded_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('applied_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'omr_sheets',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('batch_id', UUID(as_uuid=True), sa.ForeignKey('omr_batches.id', ondelete='CASCADE'), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'processed', 'needs_review', 'failed', 'applied', name='omr_sheet_status'),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column(
            'match_status',
            sa.Enum(
                'matched', 'unmatched', 'ambiguous', 'duplicate', 'unreadable', 'manual',
                name='omr_match_status',
            ),
            nullable=True,
        ),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('image_url', sa.Text(), nullable=False),
        sa.Column('image_public_id', sa.String(length=255), nullable=False),
        sa.Column('annotated_image_url', sa.Text(), nullable=True),
        sa.Column('annotated_public_id', sa.String(length=255), nullable=True),
        sa.Column('detected_class', sa.SmallInteger(), nullable=True),
        sa.Column('detected_roll', sa.String(length=20), nullable=True),
        sa.Column('detected_subject_code', sa.String(length=10), nullable=True),
        sa.Column('detected_set_code', sa.String(length=10), nullable=True),
        sa.Column('alignment_method', sa.String(length=30), nullable=True),
        sa.Column('student_id', UUID(as_uuid=True), sa.ForeignKey('students.id'), nullable=True),
        sa.Column('matched_manually', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('correct_count', sa.SmallInteger(), nullable=True),
        sa.Column('wrong_count', sa.SmallInteger(), nullable=True),
        sa.Column('blank_count', sa.SmallInteger(), nullable=True),
        sa.Column('multiple_count', sa.SmallInteger(), nullable=True),
        sa.Column('marks_obtained', sa.Numeric(5, 2), nullable=True),
        sa.Column('percentage', sa.Numeric(5, 2), nullable=True),
        sa.Column('answers', JSONB(), nullable=True),
        sa.Column('score_details', JSONB(), nullable=True),
        sa.Column('review_note', sa.Text(), nullable=True),
        sa.Column('reviewed_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('processing_time_ms', sa.Integer(), nullable=True),
    )
    op.create_index('ix_omr_sheets_batch_status', 'omr_sheets', ['batch_id', 'status'])
    op.create_index('ix_omr_sheets_batch_student', 'omr_sheets', ['batch_id', 'student_id'])


def downgrade() -> None:
    op.drop_index('ix_omr_sheets_batch_student', table_name='omr_sheets')
    op.drop_index('ix_omr_sheets_batch_status', table_name='omr_sheets')
    op.drop_table('omr_sheets')
    op.drop_table('omr_batches')
    op.drop_table('omr_answer_keys')

    # Native Postgres ENUM types are not dropped automatically by op.drop_table();
    # remove them explicitly now that every column referencing them is gone.
    for enum_name in ('omr_sheet_status', 'omr_match_status', 'omr_batch_status'):
        op.execute(sa.text(f'DROP TYPE IF EXISTS {enum_name}'))
