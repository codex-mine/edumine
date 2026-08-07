import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser
from app.common.enums import AttendanceStatus, InvoiceStatus, PublicationStatus, Weekday
from app.core.exceptions import NotFoundException, PermissionDeniedException, ValidationException
from app.modules.academic import repository as academic_repository
from app.modules.attendance import repository as attendance_repository
from app.modules.billing import repository as billing_repository
from app.modules.communication import service as communication_service
from app.modules.dashboard import ai_service
from app.modules.dashboard import periods
from app.modules.dashboard import repository as dashboard_repository
from app.modules.dashboard.periods import Bucket, Period
from app.modules.dashboard.schemas import AtRiskStudentsRequest, AttendanceInsightRequest, GuardianAssistantRequest
from app.modules.exams import repository as exams_repository
from app.modules.guardians import repository as guardians_repository
from app.modules.results import repository as results_repository
from app.modules.routine import repository as routine_repository
from app.modules.students import repository as students_repository
from app.modules.teachers import repository as teachers_repository

WEEKDAY_BY_INDEX = list(Weekday)


def _weekday_for(day: date) -> Weekday:
    return WEEKDAY_BY_INDEX[day.weekday()]


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _month_start(today: date) -> date:
    return today.replace(day=1)


def _day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _last_day_of_month(year: int, month: int) -> date:
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


def _attendance_percent(rows: list) -> float | None:
    if not rows:
        return None
    present = sum(1 for daily, _u, _r in rows if daily.status in (AttendanceStatus.present, AttendanceStatus.late))
    return round((present / len(rows)) * 100, 2)


async def _attendance_percent_between(db: AsyncSession, date_from: date, date_to: date) -> float | None:
    """Institution-wide attendance rate across a date range, or None when nothing is marked."""
    rows = await dashboard_repository.daily_attendance_rates(db, date_from=date_from, date_to=date_to)
    marked = sum(total for _day, _present, total in rows)
    if not marked:
        return None
    present = sum(present for _day, present, _total in rows)
    return round((present / marked) * 100, 2)


def _latest_exam_summary(rows: list) -> dict | None:
    if not rows:
        return None
    by_exam: dict[uuid.UUID, dict] = {}
    for result, exam_subject, _subject, exam in rows:
        entry = by_exam.setdefault(exam.id, {"exam": exam, "obtained": 0.0, "full": 0})
        if result.marks_obtained is not None:
            entry["obtained"] += float(result.marks_obtained)
        entry["full"] += exam_subject.full_marks
    latest_exam_id = max(by_exam, key=lambda eid: by_exam[eid]["exam"].start_date)
    entry = by_exam[latest_exam_id]
    percentage = round((entry["obtained"] / entry["full"]) * 100, 2) if entry["full"] else 0.0
    return {"exam_name": entry["exam"].name, "percentage": percentage}


async def _find_upcoming_exam(db: AsyncSession, *, academic_year_id: uuid.UUID, class_id: uuid.UUID, today: date) -> dict | None:
    exams = await exams_repository.list_exams(db, academic_year_id=academic_year_id)
    upcoming = sorted((e for e in exams if e.start_date >= today), key=lambda e: e.start_date)
    for exam in upcoming:
        classes = await exams_repository.list_exam_classes(db, exam.id)
        if any(c.id == class_id for c in classes):
            return {"name": exam.name, "start_date": exam.start_date.isoformat()}
    return None


async def _attendance_trend_weeks(db: AsyncSession, *, user_id: uuid.UUID, today: date, weeks: int = 6) -> list[dict]:
    trend = []
    for i in range(weeks - 1, -1, -1):
        week_end = today - timedelta(days=7 * i)
        week_start = week_end - timedelta(days=6)
        rows = await attendance_repository.list_daily_attendance(db, user_id=user_id, date_from=week_start, date_to=week_end)
        trend.append({"label": week_start.strftime("%b %d"), "value": _attendance_percent(rows) or 0})
    return trend


async def _student_dashboard_summary(db: AsyncSession, *, student, user) -> dict:
    today = _today()
    month_start = _month_start(today)

    daily_rows = await attendance_repository.list_daily_attendance(db, user_id=user.id, date_from=month_start, date_to=today)
    attendance_percent = _attendance_percent(daily_rows)

    outstanding = await billing_repository.list_outstanding_invoices_for_student(db, student.id)
    current_due = round(sum(float(inv.due_amount) for inv in outstanding if inv.status != InvoiceStatus.paid), 2)

    year = await academic_repository.get_active_academic_year(db)
    enrollment = None
    if year is not None:
        enrollment = await academic_repository.get_enrollment_for_student_year(
            db, student_id=student.id, academic_year_id=year.id
        )

    latest_result = None
    upcoming_exam = None
    if year is not None:
        result_rows = await results_repository.list_published_results_for_student_year(
            db, student_id=student.id, academic_year_id=year.id
        )
        latest_result = _latest_exam_summary(result_rows)
        if enrollment is not None:
            section_row = await academic_repository.get_section(db, enrollment.section_id)
            if section_row is not None:
                _section, class_entity, *_rest = section_row
                upcoming_exam = await _find_upcoming_exam(
                    db, academic_year_id=year.id, class_id=class_entity.id, today=today
                )

    return {
        "stats": {
            "attendance_percent_month": attendance_percent,
            "current_due": current_due,
            "latest_result": latest_result,
            "upcoming_exam": upcoming_exam,
        },
    }


# --- Principal ---------------------------------------------------------------


async def get_principal_dashboard(db: AsyncSession, actor: CurrentUser, period: Period | None = None) -> dict:
    today = _today()
    period = period or periods.resolve_period(today=today)
    previous = periods.previous_period(period)
    month_start = _month_start(today)

    period_from_dt, period_to_dt = period.datetime_bounds
    previous_from_dt, previous_to_dt = previous.datetime_bounds

    total_income = await dashboard_repository.sum_payments_between(db, period_from_dt, period_to_dt)
    previous_income = await dashboard_repository.sum_payments_between(db, previous_from_dt, previous_to_dt)
    total_students = await dashboard_repository.count_active_students(db)
    total_staff = sum(
        [
            await dashboard_repository.count_active_users_by_role(db, role_name)
            for role_name in ("teacher", "staff", "accountant", "receptionist")
        ]
    )
    dues_outstanding = await dashboard_repository.sum_outstanding_dues(db)

    admissions_in_period = len(
        await dashboard_repository.list_admission_dates(db, date_from=period.date_from, date_to=period.date_to)
    )
    admissions_previous = len(
        await dashboard_repository.list_admission_dates(db, date_from=previous.date_from, date_to=previous.date_to)
    )

    expenses_month = await dashboard_repository.sum_approved_expenses_between(
        db, month_start, _last_day_of_month(today.year, today.month)
    )

    recent_invoice_rows = await dashboard_repository.list_recent_invoices(db, limit=8)
    recent_invoices = [
        {
            "student": user.full_name,
            "amount": f"{invoice.total_amount:,.2f}",
            "status": invoice.status.value.replace("_", " ").title(),
            "due": invoice.due_date.isoformat(),
        }
        for invoice, _student, user in recent_invoice_rows
    ]

    breakdown = await dashboard_repository.expense_breakdown_by_category(db, month_start, today)
    financial_narrative: str | None = None
    financial_narrative_error: str | None = None
    financial_context = {
        "total_income_month": round(total_income, 2),
        "total_expenses_month": round(expenses_month, 2),
        "dues_outstanding": round(dues_outstanding, 2),
        "category_breakdown": [{"category": name, "amount": round(amount, 2)} for name, amount in breakdown],
    }
    try:
        financial_narrative = await ai_service.generate_financial_narrative(
            context=financial_context,
            period_label=month_start.strftime("%B %Y"),
            data_scope="aggregated institution-wide financial figures for the current month only — no individual student/staff identities",
        )
    except ai_service.DashboardAIUnavailable as exc:
        financial_narrative_error = exc.message

    return {
        "period": period.as_dict(),
        "comparison_label": previous.label,
        "stats": {
            "total_income_month": round(total_income, 2),
            "total_income_change_percent": periods.percent_change(total_income, previous_income),
            "total_students": total_students,
            "new_admissions": admissions_in_period,
            "new_admissions_change_percent": periods.percent_change(admissions_in_period, admissions_previous),
            "total_staff": total_staff,
            "dues_outstanding": round(dues_outstanding, 2),
        },
        "recent_invoices": recent_invoices,
        "financial_narrative": financial_narrative,
        "financial_narrative_error": financial_narrative_error,
    }


# --- Admin ---------------------------------------------------------------------


async def get_admin_dashboard(db: AsyncSession, actor: CurrentUser, period: Period | None = None) -> dict:
    today = _today()
    period = period or periods.resolve_period(today=today)
    previous = periods.previous_period(period)
    period_from_dt, period_to_dt = period.datetime_bounds
    previous_from_dt, previous_to_dt = previous.datetime_bounds

    new_admissions = len(
        await dashboard_repository.list_admission_dates(db, date_from=period.date_from, date_to=period.date_to)
    )
    previous_admissions = len(
        await dashboard_repository.list_admission_dates(db, date_from=previous.date_from, date_to=previous.date_to)
    )

    collections = await dashboard_repository.sum_payments_between(db, period_from_dt, period_to_dt)
    previous_collections = await dashboard_repository.sum_payments_between(db, previous_from_dt, previous_to_dt)

    attendance_percent = await _attendance_percent_between(db, period.date_from, period.date_to)
    previous_attendance_percent = await _attendance_percent_between(db, previous.date_from, previous.date_to)

    pending_activations = len(await students_repository.list_pending_students(db))
    pending_expenses = await dashboard_repository.count_pending_expenses(db)

    total_students = await dashboard_repository.count_active_students(db)

    return {
        "period": period.as_dict(),
        "comparison_label": previous.label,
        "stats": {
            "total_students": total_students,
            "new_admissions": new_admissions,
            "new_admissions_change_percent": periods.percent_change(new_admissions, previous_admissions),
            "attendance_percent": attendance_percent,
            "attendance_change_percent": (
                periods.percent_change(attendance_percent, previous_attendance_percent)
                if attendance_percent is not None and previous_attendance_percent is not None
                else None
            ),
            "pending_approvals": pending_activations + pending_expenses,
            "collections": round(collections, 2),
            "collections_change_percent": periods.percent_change(collections, previous_collections),
        },
    }


# --- Institution overview sections (Admin / Principal) ---------------------------
#
# One function per card on the overview dashboard. Every one takes the same
# resolved `Period`, so the page-level filter and a single card's own filter are
# the same code path — the card just passes a different range.

ACTION_LABELS = {
    "create": "created",
    "update": "updated",
    "delete": "deleted",
    "hard_delete": "permanently deleted",
    "soft_delete": "archived",
    "approve": "approved",
    "reject": "rejected",
    "publish": "published",
    "promote": "promoted",
    "mark": "attendance marked",
    "mark_paid": "marked paid",
    "record_payment": "payment recorded",
    "add_discount": "discount added",
    "cancel": "cancelled",
    "submit_marks": "marks submitted",
    "save_marks": "marks saved",
    "submit_questions": "questions submitted",
    "approve_questions": "questions approved",
    "request_question_revision": "revision requested",
    "generate_invoice": "invoice generated",
    "generate_invoices_batch": "invoices generated",
    "generate_payroll_run": "payroll run generated",
    "link_guardian": "guardian linked",
    "unlink_guardian": "guardian unlinked",
    "configure_subjects": "subjects configured",
    "set_fee_structure": "fee structure set",
}


def _humanize(value: str) -> str:
    return value.replace("_", " ").replace(".", " ").strip()


def _bucket_counts(buckets: list[Bucket], days: list[date]) -> list[int]:
    counts = [0] * len(buckets)
    for day in days:
        index = periods.bucket_index(buckets, day)
        if index is not None:
            counts[index] += 1
    return counts


def _section_envelope(period: Period, previous: Period | None = None) -> dict:
    envelope = {"period": period.as_dict()}
    if previous is not None:
        envelope["comparison_label"] = previous.label
    return envelope


async def get_admissions_overview(db: AsyncSession, period: Period) -> dict:
    """New admissions over the period, plotted against the equivalent window before it."""
    previous = periods.previous_period(period)
    granularity = periods.granularity_for(period)
    current_buckets = periods.build_buckets(period, granularity)
    previous_buckets = periods.build_buckets(previous, granularity)

    current_counts = _bucket_counts(
        current_buckets,
        await dashboard_repository.list_admission_dates(db, date_from=period.date_from, date_to=period.date_to),
    )
    previous_counts = _bucket_counts(
        previous_buckets,
        await dashboard_repository.list_admission_dates(db, date_from=previous.date_from, date_to=previous.date_to),
    )

    today = _today()
    points = [
        {
            "label": bucket.label,
            # A bucket that hasn't happened yet is a gap in the line, not a zero —
            # otherwise the rest of an in-progress month reads as "no admissions".
            "current": current_counts[index] if bucket.start <= today else None,
            # Buckets are zipped by position, not by date — that is what lines up
            # "Jan" of this year with "Jan" of last year on a single axis.
            "previous": previous_counts[index] if index < len(previous_counts) else 0,
        }
        for index, bucket in enumerate(current_buckets)
    ]

    total = sum(current_counts)
    previous_total = sum(previous_counts)
    return {
        **_section_envelope(period, previous),
        "points": points,
        "total": total,
        "previous_total": previous_total,
        "change_percent": periods.percent_change(total, previous_total),
    }


async def get_fee_collection_overview(db: AsyncSession, period: Period) -> dict:
    """Collected vs still-owed money: collections land inside the period, dues are as-of-now."""
    today = _today()
    period_from_dt, period_to_dt = period.datetime_bounds
    previous = periods.previous_period(period)
    previous_from_dt, previous_to_dt = previous.datetime_bounds

    collected = await dashboard_repository.sum_payments_between(db, period_from_dt, period_to_dt)
    previous_collected = await dashboard_repository.sum_payments_between(db, previous_from_dt, previous_to_dt)
    pending, overdue = await dashboard_repository.outstanding_split(db, today=today)

    total = collected + pending + overdue

    def share(amount: float) -> float:
        return round((amount / total) * 100, 1) if total else 0.0

    return {
        **_section_envelope(period, previous),
        "total": round(total, 2),
        "collected": round(collected, 2),
        "change_percent": periods.percent_change(collected, previous_collected),
        "segments": [
            {"key": "collected", "label": "Collected", "amount": round(collected, 2), "percent": share(collected)},
            {"key": "pending", "label": "Pending", "amount": round(pending, 2), "percent": share(pending)},
            {"key": "overdue", "label": "Overdue", "amount": round(overdue, 2), "percent": share(overdue)},
        ],
    }


async def get_attendance_overview(db: AsyncSession, period: Period) -> dict:
    """Institution-wide attendance rate per bucket across the period."""
    previous = periods.previous_period(period)
    buckets = periods.build_buckets(period)
    rates = await dashboard_repository.daily_attendance_rates(db, date_from=period.date_from, date_to=period.date_to)

    present_by_bucket = [0] * len(buckets)
    marked_by_bucket = [0] * len(buckets)
    for day, present, marked in rates:
        index = periods.bucket_index(buckets, day)
        if index is not None:
            present_by_bucket[index] += present
            marked_by_bucket[index] += marked

    points = [
        {
            "label": bucket.label,
            # Nothing marked (a holiday, a weekend, a day still to come) is a gap
            # on the axis — plotting it as 0% would read as "nobody turned up".
            "value": round((present_by_bucket[index] / marked_by_bucket[index]) * 100, 1)
            if marked_by_bucket[index]
            else None,
            "present": present_by_bucket[index],
            "marked": marked_by_bucket[index],
        }
        for index, bucket in enumerate(buckets)
    ]

    average = await _attendance_percent_between(db, period.date_from, period.date_to)
    previous_average = await _attendance_percent_between(db, previous.date_from, previous.date_to)

    return {
        **_section_envelope(period, previous),
        "points": points,
        "average_percent": average,
        "change_percent": (
            periods.percent_change(average, previous_average)
            if average is not None and previous_average is not None
            else None
        ),
    }


async def _academic_year_for_period(db: AsyncSession, period: Period):
    """The academic year the period sits in — the one it overlaps most.

    Enrollment is a standing figure per year rather than something that accrues
    day by day, so a period filter selects *which year* is shown rather than
    slicing days out of one.
    """
    years = await academic_repository.list_academic_years(db)
    best = None
    best_overlap = 0
    for year in years:
        overlap_start = max(year.start_date, period.date_from)
        overlap_end = min(year.end_date, period.date_to)
        overlap = (overlap_end - overlap_start).days + 1
        if overlap > best_overlap:
            best, best_overlap = year, overlap
    return best or await academic_repository.get_active_academic_year(db)


async def get_students_by_class_overview(db: AsyncSession, period: Period) -> dict:
    """Active-enrollment headcount per class, for the academic year the period falls in."""
    year = await _academic_year_for_period(db, period)
    rows = (
        await dashboard_repository.enrollment_counts_by_class(db, academic_year_id=year.id)
        if year is not None
        else []
    )
    total = sum(count for _name, count in rows)

    return {
        **_section_envelope(period),
        "academic_year": year.name if year is not None else None,
        "total": total,
        "segments": [
            {
                "label": name,
                "value": count,
                "percent": round((count / total) * 100, 1) if total else 0.0,
            }
            for name, count in rows
        ],
    }


async def get_upcoming_events(db: AsyncSession, period: Period, limit: int = 6) -> dict:
    """Scheduled exams falling inside the period, nearest first."""
    exams = await dashboard_repository.list_exams_between(
        db, date_from=period.date_from, date_to=period.date_to, limit=limit
    )
    events = [
        {
            "id": str(exam.id),
            "title": exam.name,
            "date": exam.start_date.isoformat(),
            "end_date": exam.end_date.isoformat(),
            "timing": "All day"
            if exam.start_date == exam.end_date
            else f"{exam.start_date.strftime('%b %d')} – {exam.end_date.strftime('%b %d')}",
            "category": exam.term or "Examination",
            "status": _humanize(exam.status.value).title(),
        }
        for exam in exams
    ]
    return {**_section_envelope(period), "events": events}


async def get_recent_activities(db: AsyncSession, period: Period, limit: int = 8) -> dict:
    """The audit trail for the period, phrased for a dashboard reader."""
    period_from_dt, period_to_dt = period.datetime_bounds
    entries = await dashboard_repository.list_recent_audit_entries(
        db, date_from=period_from_dt, date_to=period_to_dt, limit=limit
    )

    activities = [
        {
            "id": str(log.id),
            "activity": f"{_humanize(log.entity_type).title()} {ACTION_LABELS.get(log.action, _humanize(log.action))}",
            "entity_type": log.entity_type,
            "action": log.action,
            "actor": actor_name or "System",
            "at": log.created_at.isoformat(),
        }
        for log, actor_name in entries
    ]
    return {**_section_envelope(period), "activities": activities}


async def get_top_performing_students(db: AsyncSession, period: Period, limit: int = 5) -> dict:
    """Highest scoring students across exams published within the period."""
    rows = await dashboard_repository.top_student_result_totals(
        db, date_from=period.date_from, date_to=period.date_to, limit=limit
    )

    year = await academic_repository.get_active_academic_year(db)
    class_labels = (
        await dashboard_repository.class_labels_for_students(
            db, academic_year_id=year.id, student_ids=[student_id for student_id, *_rest in rows]
        )
        if year is not None
        else {}
    )

    students = []
    for rank, (student_id, name, obtained, available) in enumerate(rows, start=1):
        percentage = round((obtained / available) * 100, 2) if available else 0.0
        students.append(
            {
                "rank": rank,
                "student_id": str(student_id),
                "name": name,
                "class_label": class_labels.get(student_id),
                "percentage": percentage,
                # A 4.0-scale figure alongside the percentage, since report cards
                # here are read in GPA terms.
                "gpa": round(min(percentage / 20, 5.0), 2),
            }
        )
    return {**_section_envelope(period), "students": students}


async def get_recent_notifications(db: AsyncSession, period: Period, limit: int = 6) -> dict:
    """Announcements published inside the period, newest first."""
    period_from_dt, period_to_dt = period.datetime_bounds
    announcements = await dashboard_repository.list_recent_announcements(
        db, date_from=period_from_dt, date_to=period_to_dt, limit=limit
    )
    return {
        **_section_envelope(period),
        "notifications": [
            {
                "id": str(announcement.id),
                "title": announcement.title,
                "audience": _humanize(announcement.audience_type.value).title(),
                "at": announcement.published_at.isoformat() if announcement.published_at else None,
            }
            for announcement in announcements
        ]
    }


# --- Teacher ---------------------------------------------------------------------


async def get_teacher_dashboard(db: AsyncSession, actor: CurrentUser) -> dict:
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None:
        raise NotFoundException("Teacher profile not found")
    teacher, user = teacher_record
    today = _today()
    weekday = _weekday_for(today)

    todays_slots = await routine_repository.list_slots(
        db, academic_year_id=None, section_id=None, teacher_id=teacher.id, day_of_week=weekday
    )
    todays_slots.sort(key=lambda row: row[0].period_number)

    marked_count = 0
    for slot, _section, _class_entity, _subject, _teacher, _teacher_user, _room in todays_slots:
        marks = await attendance_repository.map_class_attendance_for_slot_date(
            db, routine_slot_id=slot.id, attendance_date=today
        )
        if marks:
            marked_count += 1

    exam_subject_rows = await exams_repository.list_exam_subjects_for_teacher(db, teacher.id)
    pending_marks = sum(1 for exam_subject, *_rest in exam_subject_rows if exam_subject.marks_submitted_at is None)

    month_start = _month_start(today)
    own_daily = await attendance_repository.list_daily_attendance(db, user_id=user.id, date_from=month_start, date_to=today)
    monthly_attendance_percent = _attendance_percent(own_daily)

    todays_schedule = [
        {
            "id": str(slot.id),
            "label": f"Period {slot.period_number} · {subject.name} · {section.name}",
            "secondary": f"{slot.start_time.strftime('%I:%M %p')}–{slot.end_time.strftime('%I:%M %p')}",
        }
        for slot, section, _class_entity, subject, _teacher, _teacher_user, _room in todays_slots
    ]

    exam_status_rows = []
    for exam_subject, exam, class_entity, _subject, _teacher, _teacher_user in exam_subject_rows[:10]:
        if exam_subject.marks_submitted_at is not None:
            status = "Marks submitted"
        elif exam_subject.question_submitted_at is None:
            status = "Question pending"
        else:
            status = "Marks pending"
        exam_status_rows.append({"exam": exam.name, "class": class_entity.name, "status": status})

    return {
        "stats": {
            "todays_classes": len(todays_slots),
            "attendance_marked": marked_count,
            "pending_marks_entry": pending_marks,
            "monthly_attendance_percent": monthly_attendance_percent,
        },
        "todays_schedule": todays_schedule,
        "exam_status_rows": exam_status_rows,
    }


# --- Accountant / Receptionist (billing operations) -----------------------------


async def get_billing_ops_dashboard(db: AsyncSession, actor: CurrentUser) -> dict:
    today = _today()
    today_from, today_to = _day_bounds_utc(today)

    todays_collections = await dashboard_repository.sum_payments_between(db, today_from, today_to)
    dues_outstanding = await dashboard_repository.sum_outstanding_dues(db)
    pending_invoices = await dashboard_repository.count_outstanding_invoices(db)

    recent_payments = await dashboard_repository.list_recent_payments(db, limit=8)
    recent_payment_items = [
        {
            "id": str(payment.id),
            "label": user.full_name,
            "secondary": f"{payment.method.value.replace('_', ' ').title()} · {payment.paid_at.strftime('%b %d, %I:%M %p')}",
            "trailing": f"{payment.amount:,.2f}",
        }
        for payment, _student, user in recent_payments
    ]

    outstanding_rows = await dashboard_repository.list_top_outstanding_invoices(db, limit=10)
    outstanding_dues_rows = [
        {"student": user.full_name, "amount": f"{invoice.due_amount:,.2f}", "due": invoice.due_date.isoformat()}
        for invoice, _student, user in outstanding_rows
    ]

    return {
        "stats": {
            "todays_collections": round(todays_collections, 2),
            "dues_outstanding": round(dues_outstanding, 2),
            "pending_invoices": pending_invoices,
        },
        "recent_payments": recent_payment_items,
        "outstanding_dues_rows": outstanding_dues_rows,
    }


# --- Staff -----------------------------------------------------------------------


async def get_staff_dashboard(db: AsyncSession, actor: CurrentUser) -> dict:
    today = _today()
    month_start = _month_start(today)

    today_row = await attendance_repository.get_daily_attendance(db, user_id=actor.id, attendance_date=today)
    today_status = today_row.status.value.replace("_", " ").title() if today_row is not None else "Not marked yet"

    month_rows = await attendance_repository.list_daily_attendance(db, user_id=actor.id, date_from=month_start, date_to=today)
    monthly_attendance_percent = _attendance_percent(month_rows)

    items, _total = await communication_service.list_inbox_announcements(db, actor, page=1, limit=30)
    unread_count = sum(1 for item in items if item["read_at"] is None)
    recent_activity = [
        {"id": item["id"], "label": item["title"], "secondary": item["created_at"][:10]} for item in items[:5]
    ]

    return {
        "stats": {
            "today_status": today_status,
            "monthly_attendance_percent": monthly_attendance_percent,
            "unread_announcements": unread_count,
        },
        "recent_activity": recent_activity,
    }


# --- Student ---------------------------------------------------------------------


async def get_student_dashboard(db: AsyncSession, actor: CurrentUser) -> dict:
    record = await students_repository.get_student_by_user_id(db, actor.id)
    if record is None:
        raise NotFoundException("Student profile not found")
    student, user = record
    summary = await _student_dashboard_summary(db, student=student, user=user)
    summary["attendance_trend"] = await _attendance_trend_weeks(db, user_id=user.id, today=_today())
    return summary


# --- Guardian --------------------------------------------------------------------


async def get_guardian_dashboard(db: AsyncSession, actor: CurrentUser) -> dict:
    guardian_record = await guardians_repository.get_guardian_by_user_id(db, actor.id)
    if guardian_record is None:
        raise NotFoundException("Guardian profile not found")
    guardian, _user = guardian_record
    linked = await students_repository.list_students_for_guardian(db, guardian.id)

    children = []
    for _link, student, user in linked:
        summary = await _student_dashboard_summary(db, student=student, user=user)
        summary["attendance_trend"] = await _attendance_trend_weeks(db, user_id=user.id, today=_today())
        children.append({"student_id": str(student.id), "full_name": user.full_name, **summary})

    return {"children": children}


# --- Teacher scope guards for on-demand AI widgets --------------------------------


async def _assert_teacher_scope_for_section(db: AsyncSession, actor: CurrentUser, section_id: uuid.UUID) -> None:
    teacher_record = await teachers_repository.get_teacher_by_user_id(db, actor.id)
    if teacher_record is None:
        raise NotFoundException("Teacher profile not found")
    teacher = teacher_record[0]
    if not await routine_repository.teacher_has_slot_in_section(db, teacher_id=teacher.id, section_id=section_id):
        raise PermissionDeniedException("You can only request this for classes you teach")


async def _assert_teacher_scope_for_student(db: AsyncSession, actor: CurrentUser, student_id: uuid.UUID) -> None:
    year = await academic_repository.get_active_academic_year(db)
    if year is None:
        raise PermissionDeniedException("You do not have access to this student")
    enrollment = await academic_repository.get_enrollment_for_student_year(db, student_id=student_id, academic_year_id=year.id)
    if enrollment is None:
        raise PermissionDeniedException("You do not have access to this student")
    await _assert_teacher_scope_for_section(db, actor, enrollment.section_id)


async def _class_attendance_series(db: AsyncSession, *, section_id: uuid.UUID, date_from: date, date_to: date) -> list[dict]:
    enrollments = await academic_repository.list_enrollments(db, academic_year_id=None, section_id=section_id, student_id=None)
    user_ids = {user.id for _enrollment, _student, user, _year, _section, _class in enrollments}
    if not user_ids:
        return []
    rows = await attendance_repository.list_daily_attendance(db, user_id=None, date_from=date_from, date_to=date_to)
    by_date: dict[date, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for daily, user, _role_name in rows:
        if user.id in user_ids:
            by_date[daily.attendance_date][daily.status.value] += 1

    series = []
    total = len(user_ids)
    for day in sorted(by_date):
        counts = by_date[day]
        present = counts.get("present", 0) + counts.get("late", 0)
        series.append({"date": day.isoformat(), "present": present, "absent": counts.get("absent", 0), "total_students": total})
    return series


# --- 4.5 Attendance Pattern Insight (on-demand, Admin/Teacher) --------------------


async def get_attendance_pattern_insight(db: AsyncSession, actor: CurrentUser, payload: AttendanceInsightRequest) -> dict:
    if not actor.has_role("admin", "teacher"):
        raise PermissionDeniedException("You do not have access to this insight")

    if payload.scope == "student":
        record = await students_repository.get_student_by_id(db, payload.student_id)
        if record is None:
            raise NotFoundException("Student not found")
        student, user = record
        if actor.role == "teacher":
            await _assert_teacher_scope_for_student(db, actor, student.id)

        rows = await attendance_repository.list_daily_attendance(
            db, user_id=user.id, date_from=payload.date_from, date_to=payload.date_to
        )
        if not rows:
            raise ValidationException("There isn't enough attendance data yet to identify a pattern.")
        context = {
            "student_name": user.full_name,
            "days": [{"date": daily.attendance_date.isoformat(), "status": daily.status.value} for daily, _u, _r in rows],
        }
        data_scope = f"attendance for student {user.full_name} only, {payload.date_from.isoformat()} to {payload.date_to.isoformat()}"
    else:
        section_row = await academic_repository.get_section(db, payload.section_id)
        if section_row is None:
            raise NotFoundException("Section not found")
        section, class_entity, *_rest = section_row
        if actor.role == "teacher":
            await _assert_teacher_scope_for_section(db, actor, section.id)

        series = await _class_attendance_series(db, section_id=section.id, date_from=payload.date_from, date_to=payload.date_to)
        if not series:
            raise ValidationException("There isn't enough attendance data yet to identify a pattern.")
        context = {"class_name": f"{class_entity.name} - {section.name}", "days": series}
        data_scope = (
            f"aggregated attendance for {class_entity.name} - {section.name} only, "
            f"{payload.date_from.isoformat()} to {payload.date_to.isoformat()}"
        )

    period_label = f"{payload.date_from.isoformat()} to {payload.date_to.isoformat()}"
    try:
        observations = await ai_service.generate_attendance_pattern_insight(
            role=actor.role, context=context, period_label=period_label, data_scope=data_scope
        )
    except ai_service.DashboardAIUnavailable as exc:
        raise ValidationException(exc.message) from exc

    return {"observations": observations}


# --- 4.7 At-Risk Student Recommendation (on-demand, Admin/Teacher) ----------------


async def get_at_risk_students(db: AsyncSession, actor: CurrentUser, payload: AtRiskStudentsRequest) -> dict:
    if not actor.has_role("admin", "teacher"):
        raise PermissionDeniedException("You do not have access to this recommendation")

    section_row = await academic_repository.get_section(db, payload.section_id)
    if section_row is None:
        raise NotFoundException("Section not found")
    section, class_entity, *_rest = section_row

    if actor.role == "teacher":
        await _assert_teacher_scope_for_section(db, actor, section.id)

    enrollments = await academic_repository.list_enrollments(db, academic_year_id=None, section_id=section.id, student_id=None)
    student_index = {student.id: (student, user) for _enrollment, student, user, _year, _section, _class in enrollments}
    if not student_index:
        raise ValidationException("This section has no enrolled students to evaluate")

    attendance_by_student: dict[uuid.UUID, float] = {}
    if payload.attendance_threshold_percent is not None:
        for student_id, (_student, user) in student_index.items():
            rows = await attendance_repository.list_daily_attendance(
                db, user_id=user.id, date_from=payload.attendance_date_from, date_to=payload.attendance_date_to
            )
            percent = _attendance_percent(rows)
            if percent is not None:
                attendance_by_student[student_id] = percent

    marks_by_student: dict[uuid.UUID, float] = {}
    if payload.marks_threshold_percent is not None:
        pub = await results_repository.get_publication(db, payload.exam_id)
        if pub is None or pub.status != PublicationStatus.published:
            raise ValidationException("Results for the selected exam are not published yet")

        exam_subjects = await exams_repository.list_exam_subjects_for_exam(db, payload.exam_id)
        exam_subjects = [row for row in exam_subjects if row[0].class_id == class_entity.id]

        totals: dict[uuid.UUID, list] = defaultdict(lambda: [0.0, 0])
        for exam_subject, _exam, _class, _subject, _teacher, _teacher_user in exam_subjects:
            results = await results_repository.list_exam_results_for_subject(db, exam_subject.id)
            for result, student, _user in results:
                if result.is_absent or result.marks_obtained is None or student.id not in student_index:
                    continue
                totals[student.id][0] += float(result.marks_obtained)
                totals[student.id][1] += exam_subject.full_marks
        for student_id, (obtained, full) in totals.items():
            if full:
                marks_by_student[student_id] = round((obtained / full) * 100, 2)

    students_payload = []
    for student_id, (_student, user) in student_index.items():
        entry: dict = {"student_id": str(student_id), "name": user.full_name}
        if student_id in attendance_by_student:
            entry["attendance_percent"] = attendance_by_student[student_id]
        if student_id in marks_by_student:
            entry["average_marks_percent"] = marks_by_student[student_id]
        students_payload.append(entry)

    thresholds: dict = {}
    if payload.attendance_threshold_percent is not None:
        thresholds["attendance_below_percent"] = payload.attendance_threshold_percent
    if payload.marks_threshold_percent is not None:
        thresholds["average_marks_below_percent"] = payload.marks_threshold_percent

    data_scope = f"aggregated attendance/result data for {class_entity.name} - {section.name} only, within provided thresholds"
    try:
        flagged = await ai_service.generate_at_risk_recommendation(
            role=actor.role, thresholds=thresholds, students=students_payload, data_scope=data_scope
        )
    except ai_service.DashboardAIUnavailable as exc:
        raise ValidationException(exc.message) from exc

    # `students_payload` is the same input list handed to the AI (not part of its output) —
    # returned alongside so the UI can resolve student_id -> name for the worklist display.
    return {"flagged_students": flagged, "students": students_payload}


# --- 4.4 Guardian Support Assistant (+ §8 Conversation Memory) --------------------


async def _guardian_scoped_context(db: AsyncSession, *, student, user, category: str) -> dict:
    today = _today()
    context: dict = {"student_name": user.full_name}

    if category == "attendance":
        month_start = _month_start(today)
        rows = await attendance_repository.list_daily_attendance(db, user_id=user.id, date_from=month_start, date_to=today)
        context["attendance_this_month"] = [
            {"date": daily.attendance_date.isoformat(), "status": daily.status.value} for daily, _u, _r in rows
        ]
    elif category == "dues_payment":
        outstanding = await billing_repository.list_outstanding_invoices_for_student(db, student.id)
        context["outstanding_invoices"] = [
            {
                "invoice_number": inv.invoice_number,
                "due_amount": float(inv.due_amount),
                "due_date": inv.due_date.isoformat(),
                "status": inv.status.value,
            }
            for inv in outstanding
            if inv.status != InvoiceStatus.paid
        ]
    elif category == "result":
        year = await academic_repository.get_active_academic_year(db)
        if year is not None:
            rows = await results_repository.list_published_results_for_student_year(
                db, student_id=student.id, academic_year_id=year.id
            )
            context["latest_published_result"] = _latest_exam_summary(rows)
    else:
        context["note"] = "No specific record type matched this question; only general information already provided may be used."

    return context


async def guardian_assistant(db: AsyncSession, actor: CurrentUser, payload: GuardianAssistantRequest) -> dict:
    guardian_record = await guardians_repository.get_guardian_by_user_id(db, actor.id)
    if guardian_record is None:
        raise NotFoundException("Guardian profile not found")
    guardian, _user = guardian_record
    linked = await students_repository.list_students_for_guardian(db, guardian.id)
    match = next((row for row in linked if row[1].id == payload.student_id), None)
    if match is None:
        raise PermissionDeniedException("You can only ask about your own linked child")
    _link, student, user = match

    try:
        category = await ai_service.classify_guardian_question(question=payload.question)
    except ai_service.DashboardAIUnavailable as exc:
        raise ValidationException(exc.message) from exc

    if category == "out_of_scope":
        return {"category": category, "answer": ai_service.GUARDIAN_OUT_OF_SCOPE_MESSAGE}

    context = await _guardian_scoped_context(db, student=student, user=user, category=category)
    data_scope = f"data linked to {user.full_name} only"
    conversation_summary = ai_service.condense_conversation([(turn.question, turn.answer) for turn in payload.conversation])

    try:
        answer = await ai_service.answer_guardian_question(
            question=payload.question,
            category=category,
            context=context,
            conversation_summary=conversation_summary,
            data_scope=data_scope,
        )
    except ai_service.DashboardAIUnavailable as exc:
        raise ValidationException(exc.message) from exc

    return {"category": category, "answer": answer}
