"""add NID, previous employment, and multi-entry qualifications to teachers/staff

Bug Fix & Feature Requirements (Teachers/Staff):
- NID Card upload (number + document URL)
- Previous Employment (optional free-text section)
- Qualifications must support multiple entries, each with education title,
  institute, grade, passing year, additional info, and certificate/marksheet
  document uploads — modeled as dedicated child tables rather than a single
  text column so each entry can carry its own documents.

Revision ID: 3f6d8b1c4a72
Revises: 9c1e5f2a7b48
Create Date: 2026-07-26 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3f6d8b1c4a72'
down_revision: Union[str, None] = '9c1e5f2a7b48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('teachers', sa.Column('nid_number', sa.String(length=30), nullable=True))
    op.add_column('teachers', sa.Column('nid_document_url', sa.String(length=500), nullable=True))
    op.add_column('teachers', sa.Column('previous_employment', sa.Text(), nullable=True))

    op.add_column('staff', sa.Column('nid_number', sa.String(length=30), nullable=True))
    op.add_column('staff', sa.Column('nid_document_url', sa.String(length=500), nullable=True))
    op.add_column('staff', sa.Column('previous_employment', sa.Text(), nullable=True))

    op.create_table(
        'teacher_qualifications',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('teacher_id', UUID(as_uuid=True), sa.ForeignKey('teachers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('education_title', sa.String(length=150), nullable=False),
        sa.Column('institute', sa.String(length=200), nullable=False),
        sa.Column('grade', sa.String(length=30), nullable=True),
        sa.Column('passing_year', sa.Integer(), nullable=True),
        sa.Column('additional_info', sa.Text(), nullable=True),
        sa.Column('certificate_url', sa.String(length=500), nullable=True),
        sa.Column('marksheet_url', sa.String(length=500), nullable=True),
    )
    op.create_index('ix_teacher_qualifications_teacher_id', 'teacher_qualifications', ['teacher_id'])

    op.create_table(
        'staff_qualifications',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('staff_id', UUID(as_uuid=True), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('education_title', sa.String(length=150), nullable=False),
        sa.Column('institute', sa.String(length=200), nullable=False),
        sa.Column('grade', sa.String(length=30), nullable=True),
        sa.Column('passing_year', sa.Integer(), nullable=True),
        sa.Column('additional_info', sa.Text(), nullable=True),
        sa.Column('certificate_url', sa.String(length=500), nullable=True),
        sa.Column('marksheet_url', sa.String(length=500), nullable=True),
    )
    op.create_index('ix_staff_qualifications_staff_id', 'staff_qualifications', ['staff_id'])


def downgrade() -> None:
    op.drop_index('ix_staff_qualifications_staff_id', table_name='staff_qualifications')
    op.drop_table('staff_qualifications')

    op.drop_index('ix_teacher_qualifications_teacher_id', table_name='teacher_qualifications')
    op.drop_table('teacher_qualifications')

    op.drop_column('staff', 'previous_employment')
    op.drop_column('staff', 'nid_document_url')
    op.drop_column('staff', 'nid_number')

    op.drop_column('teachers', 'previous_employment')
    op.drop_column('teachers', 'nid_document_url')
    op.drop_column('teachers', 'nid_number')
