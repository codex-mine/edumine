"""add question approval workflow to exam_subjects

Teacher question submission previously had a single signal --
`question_submitted_at IS NULL` -- with no review step, so admins could neither
see nor act on what teachers had sent in. This adds the review state machine
(draft -> pending -> approved | revision_requested) plus reviewer attribution
and the note explaining a revision request.

Existing rows are backfilled from the old signal: anything already submitted
becomes `pending` review, everything else stays `draft`. Nothing is
auto-approved -- an admin has to look at it.

Revision ID: d1f4a7c39b52
Revises: c5e8f2b06d39
Create Date: 2026-08-06 20:05:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd1f4a7c39b52'
down_revision: Union[str, None] = 'c5e8f2b06d39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

QUESTION_APPROVAL_STATUS = postgresql.ENUM(
    "draft",
    "pending",
    "approved",
    "revision_requested",
    name="question_approval_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    QUESTION_APPROVAL_STATUS.create(bind, checkfirst=True)

    op.add_column(
        "exam_subjects",
        sa.Column(
            "question_status",
            QUESTION_APPROVAL_STATUS,
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
    )
    op.add_column(
        "exam_subjects",
        sa.Column("question_reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "exam_subjects",
        sa.Column("question_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("exam_subjects", sa.Column("question_review_note", sa.Text(), nullable=True))

    op.create_foreign_key(
        "fk_exam_subjects_question_reviewed_by_users",
        "exam_subjects",
        "users",
        ["question_reviewed_by"],
        ["id"],
    )
    # Admin review queues filter on this column across every exam.
    op.create_index("ix_exam_subjects_question_status", "exam_subjects", ["question_status"])

    bind.execute(
        sa.text(
            "UPDATE exam_subjects SET question_status = 'pending' "
            "WHERE question_submitted_at IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_exam_subjects_question_status", table_name="exam_subjects")
    op.drop_constraint("fk_exam_subjects_question_reviewed_by_users", "exam_subjects", type_="foreignkey")
    op.drop_column("exam_subjects", "question_review_note")
    op.drop_column("exam_subjects", "question_reviewed_at")
    op.drop_column("exam_subjects", "question_reviewed_by")
    op.drop_column("exam_subjects", "question_status")
    QUESTION_APPROVAL_STATUS.drop(op.get_bind(), checkfirst=True)
