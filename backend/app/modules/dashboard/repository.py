"""Cross-module read aggregations backing the dashboards (Phase 15).

These queries intentionally live here rather than being scattered as one-off
additions across every other module's repository.py — a dashboard aggregator
is the one place in the system meant to read across module boundaries. Every
query here is read-only.
"""

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import ApprovalStatus, InvoiceStatus
from app.modules.auth.models import Role, User
from app.modules.billing.models import Invoice, Payment
from app.modules.expenses.models import Expense, ExpenseCategory
from app.modules.students.models import Student

# --- Students / staff headcounts --------------------------------------------


async def count_active_students(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Student)
        .join(User, User.id == Student.user_id)
        .where(Student.deleted_at.is_(None), User.is_active.is_(True))
    )
    return result.scalar_one()


async def count_new_admissions_since(db: AsyncSession, since: date) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Student)
        .where(Student.deleted_at.is_(None), Student.admission_date >= since)
    )
    return result.scalar_one()


async def count_active_users_by_role(db: AsyncSession, role_name: str) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(User)
        .join(Role, Role.id == User.role_id)
        .where(Role.name == role_name, User.deleted_at.is_(None), User.is_active.is_(True))
    )
    return result.scalar_one()


# --- Billing aggregates -------------------------------------------------------

OUTSTANDING_STATUSES = (InvoiceStatus.unpaid, InvoiceStatus.partially_paid, InvoiceStatus.overdue)


async def sum_outstanding_dues(db: AsyncSession) -> float:
    result = await db.execute(
        select(func.coalesce(func.sum(Invoice.due_amount), 0)).where(Invoice.status.in_(OUTSTANDING_STATUSES))
    )
    return float(result.scalar_one())


async def count_outstanding_invoices(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(Invoice).where(Invoice.status.in_(OUTSTANDING_STATUSES))
    )
    return result.scalar_one()


async def sum_payments_between(db: AsyncSession, date_from: datetime, date_to: datetime) -> float:
    result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.paid_at >= date_from, Payment.paid_at < date_to
        )
    )
    return float(result.scalar_one())


PaymentRow = tuple[Payment, Student, User]


async def list_recent_payments(db: AsyncSession, *, limit: int) -> list[PaymentRow]:
    result = await db.execute(
        select(Payment, Student, User)
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .join(Student, Student.id == Invoice.student_id)
        .join(User, User.id == Student.user_id)
        .order_by(Payment.paid_at.desc())
        .limit(limit)
    )
    return list(result.all())


InvoiceRow = tuple[Invoice, Student, User]


async def list_recent_invoices(db: AsyncSession, *, limit: int) -> list[InvoiceRow]:
    result = await db.execute(
        select(Invoice, Student, User)
        .join(Student, Student.id == Invoice.student_id)
        .join(User, User.id == Student.user_id)
        .order_by(Invoice.created_at.desc())
        .limit(limit)
    )
    return list(result.all())


async def list_top_outstanding_invoices(db: AsyncSession, *, limit: int) -> list[InvoiceRow]:
    result = await db.execute(
        select(Invoice, Student, User)
        .join(Student, Student.id == Invoice.student_id)
        .join(User, User.id == Student.user_id)
        .where(Invoice.status.in_(OUTSTANDING_STATUSES))
        .order_by(Invoice.due_amount.desc())
        .limit(limit)
    )
    return list(result.all())


async def monthly_payment_totals(db: AsyncSession, *, months: list[tuple[int, int]]) -> dict[tuple[int, int], float]:
    """Returns {(year, month): total_collected} for the given (year, month) pairs."""
    totals: dict[tuple[int, int], float] = {}
    for year, month in months:
        result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                func.extract("year", Payment.paid_at) == year,
                func.extract("month", Payment.paid_at) == month,
            )
        )
        totals[(year, month)] = float(result.scalar_one())
    return totals


# --- Expense aggregates --------------------------------------------------------


async def sum_approved_expenses_between(db: AsyncSession, date_from: date, date_to: date) -> float:
    result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.status == ApprovalStatus.approved,
            Expense.expense_date >= date_from,
            Expense.expense_date <= date_to,
        )
    )
    return float(result.scalar_one())


async def count_pending_expenses(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(Expense).where(Expense.status == ApprovalStatus.pending)
    )
    return result.scalar_one()


async def expense_breakdown_by_category(db: AsyncSession, date_from: date, date_to: date) -> list[tuple[str, float]]:
    result = await db.execute(
        select(ExpenseCategory.name, func.coalesce(func.sum(Expense.amount), 0))
        .join(Expense, Expense.category_id == ExpenseCategory.id)
        .where(
            Expense.status == ApprovalStatus.approved,
            Expense.expense_date >= date_from,
            Expense.expense_date <= date_to,
        )
        .group_by(ExpenseCategory.name)
        .order_by(func.coalesce(func.sum(Expense.amount), 0).desc())
    )
    return [(name, float(total)) for name, total in result.all()]
