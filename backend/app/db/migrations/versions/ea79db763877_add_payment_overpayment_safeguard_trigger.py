"""add payment overpayment safeguard trigger

Phase 10 (Billing & Fees Management). database.md 4.7 documents the business
rule "sum of payments.amount for an invoice must not exceed
invoices.total_amount — enforced at service layer with a database-level
trigger as a safeguard." The service layer already enforces this before
insert; this migration adds the documented DB-level safeguard so the
invariant holds even against a direct/concurrent write that bypasses the
service layer.

Revision ID: ea79db763877
Revises: 7e2a9c5d3f61
Create Date: 2026-07-27 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ea79db763877'
down_revision: Union[str, None] = '7e2a9c5d3f61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION check_payment_not_exceed_invoice_total()
        RETURNS TRIGGER AS $$
        DECLARE
            invoice_total NUMERIC(12,2);
            paid_so_far NUMERIC(12,2);
        BEGIN
            SELECT total_amount INTO invoice_total FROM invoices WHERE id = NEW.invoice_id;
            SELECT COALESCE(SUM(amount), 0) INTO paid_so_far FROM payments WHERE invoice_id = NEW.invoice_id;

            IF paid_so_far > invoice_total THEN
                RAISE EXCEPTION 'Sum of payments (%) exceeds invoice total (%) for invoice %',
                    paid_so_far, invoice_total, NEW.invoice_id
                    USING ERRCODE = 'check_violation';
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_check_payment_not_exceed_invoice_total
        AFTER INSERT ON payments
        FOR EACH ROW
        EXECUTE FUNCTION check_payment_not_exceed_invoice_total();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_check_payment_not_exceed_invoice_total ON payments")
    op.execute("DROP FUNCTION IF EXISTS check_payment_not_exceed_invoice_total()")
