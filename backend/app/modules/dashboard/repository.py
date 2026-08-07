"""Cross-module read aggregations backing the dashboards (Phase 15).

These queries intentionally live here rather than being scattered as one-off
additions across every other module's repository.py — a dashboard aggregator
is the one place in the system meant to read across module boundaries. Every
query here is read-only.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import (
    ApprovalStatus,
    AttendanceStatus,
    EnrollmentStatus,
    InvoiceStatus,
    PublicationStatus,
)
from app.common.models import AuditLog
from app.modules.academic.models import Class, Section, StudentEnrollment
from app.modules.attendance.models import DailyAttendance
from app.modules.auth.models import Role, User
from app.modules.billing.models import Invoice, Payment
from app.modules.communication.models import Announcement
from app.modules.exams.models import Exam, ExamSubject
from app.modules.expenses.models import Expense, ExpenseCategory
from app.modules.results.models import ExamResult, ResultPublication
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


async def outstanding_split(db: AsyncSession, *, today: date) -> tuple[float, float]:
    """(not_yet_due, overdue) split of every outstanding invoice's due amount.

    An invoice counts as overdue on its `overdue` status *or* on a due date that
    has already passed — the status transition is a scheduled job, so date is
    what keeps the figure honest between runs.
    """
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(Invoice.due_date >= today, Invoice.status != InvoiceStatus.overdue),
                            Invoice.due_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            or_(Invoice.due_date < today, Invoice.status == InvoiceStatus.overdue),
                            Invoice.due_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        ).where(Invoice.status.in_(OUTSTANDING_STATUSES))
    )
    pending, overdue = result.one()
    return float(pending), float(overdue)


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


# --- Institution overview sections (Admin / Principal) ---------------------------
#
# Each function below backs one card on the overview dashboard. They return raw
# rows for the requested window; bucketing into a chart series and comparing
# against the previous window happen in service.py against `periods.py`.

PRESENT_STATUSES = (AttendanceStatus.present, AttendanceStatus.late)


async def list_admission_dates(db: AsyncSession, *, date_from: date, date_to: date) -> list[date]:
    result = await db.execute(
        select(Student.admission_date).where(
            Student.deleted_at.is_(None),
            Student.admission_date >= date_from,
            Student.admission_date <= date_to,
        )
    )
    return list(result.scalars().all())


async def list_payment_amounts(db: AsyncSession, *, date_from: datetime, date_to: datetime) -> list[tuple[datetime, float]]:
    result = await db.execute(
        select(Payment.paid_at, Payment.amount)
        .where(Payment.paid_at >= date_from, Payment.paid_at < date_to)
        .order_by(Payment.paid_at)
    )
    return [(paid_at, float(amount)) for paid_at, amount in result.all()]


async def daily_attendance_rates(db: AsyncSession, *, date_from: date, date_to: date) -> list[tuple[date, int, int]]:
    """(day, present_or_late, total_marked) for every day with attendance records."""
    result = await db.execute(
        select(
            DailyAttendance.attendance_date,
            func.count().filter(DailyAttendance.status.in_(PRESENT_STATUSES)),
            func.count(),
        )
        .where(DailyAttendance.attendance_date >= date_from, DailyAttendance.attendance_date <= date_to)
        .group_by(DailyAttendance.attendance_date)
        .order_by(DailyAttendance.attendance_date)
    )
    return [(day, int(present), int(total)) for day, present, total in result.all()]


async def enrollment_counts_by_class(db: AsyncSession, *, academic_year_id: uuid.UUID) -> list[tuple[str, int]]:
    result = await db.execute(
        select(Class.name, func.count(StudentEnrollment.id))
        .join(Section, Section.id == StudentEnrollment.section_id)
        .join(Class, Class.id == Section.class_id)
        .where(
            StudentEnrollment.academic_year_id == academic_year_id,
            StudentEnrollment.status == EnrollmentStatus.active,
        )
        .group_by(Class.name, Class.numeric_order)
        .order_by(Class.numeric_order)
    )
    return [(name, int(count)) for name, count in result.all()]


async def list_exams_between(db: AsyncSession, *, date_from: date, date_to: date, limit: int) -> list[Exam]:
    result = await db.execute(
        select(Exam)
        .where(Exam.start_date >= date_from, Exam.start_date <= date_to)
        .order_by(Exam.start_date)
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_recent_audit_entries(
    db: AsyncSession, *, date_from: datetime, date_to: datetime, limit: int
) -> list[tuple[AuditLog, str | None]]:
    # Outer join: system-generated rows carry no actor, and must still show up.
    result = await db.execute(
        select(AuditLog, User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_id)
        .where(AuditLog.created_at >= date_from, AuditLog.created_at < date_to)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return list(result.all())


async def list_recent_announcements(
    db: AsyncSession, *, date_from: datetime, date_to: datetime, limit: int
) -> list[Announcement]:
    result = await db.execute(
        select(Announcement)
        .where(
            Announcement.published_at.is_not(None),
            Announcement.published_at >= date_from,
            Announcement.published_at < date_to,
        )
        .order_by(Announcement.published_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def top_student_result_totals(
    db: AsyncSession, *, date_from: date, date_to: date, limit: int
) -> list[tuple[uuid.UUID, str, float, int]]:
    """(student_id, name, marks_obtained, marks_available) over published exams in range.

    Only published exams are aggregated — an unapproved result must not leak
    into a leaderboard — and absentees are excluded from both sides of the
    ratio so one missed paper doesn't read as a zero.
    """
    obtained = func.coalesce(func.sum(ExamResult.marks_obtained), 0)
    available = func.coalesce(func.sum(ExamSubject.full_marks), 0)
    result = await db.execute(
        select(Student.id, User.full_name, obtained, available)
        .join(ExamSubject, ExamSubject.id == ExamResult.exam_subject_id)
        .join(Exam, Exam.id == ExamSubject.exam_id)
        .join(ResultPublication, ResultPublication.exam_id == Exam.id)
        .join(Student, Student.id == ExamResult.student_id)
        .join(User, User.id == Student.user_id)
        .where(
            ResultPublication.status == PublicationStatus.published,
            Exam.start_date >= date_from,
            Exam.start_date <= date_to,
            ExamResult.is_absent.is_(False),
            ExamResult.marks_obtained.is_not(None),
            Student.deleted_at.is_(None),
        )
        .group_by(Student.id, User.full_name)
        .having(available > 0)
        .order_by((obtained / func.nullif(available, 0)).desc())
        .limit(limit)
    )
    return [(student_id, name, float(got), int(full)) for student_id, name, got, full in result.all()]


async def class_labels_for_students(
    db: AsyncSession, *, academic_year_id: uuid.UUID, student_ids: list[uuid.UUID]
) -> dict[uuid.UUID, str]:
    if not student_ids:
        return {}
    result = await db.execute(
        select(StudentEnrollment.student_id, Class.name, Section.name)
        .join(Section, Section.id == StudentEnrollment.section_id)
        .join(Class, Class.id == Section.class_id)
        .where(
            StudentEnrollment.academic_year_id == academic_year_id,
            StudentEnrollment.student_id.in_(student_ids),
        )
    )
    return {student_id: f"{class_name} - {section_name}" for student_id, class_name, section_name in result.all()}
