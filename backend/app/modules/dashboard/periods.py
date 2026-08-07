"""Period (date-range) resolution shared by every institution dashboard section.

The dashboard has one page-level period filter plus a per-card filter on each
section, and both hit the same endpoints — so range parsing, comparison-window
selection and bucketing all live here rather than being re-derived per section.

All ranges are inclusive of both ends and expressed in UTC calendar dates, the
same basis the rest of `dashboard/service.py` uses.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from fastapi import Query

from app.core.exceptions import ValidationException

TODAY = "today"
THIS_WEEK = "this_week"
LAST_WEEK = "last_week"
THIS_MONTH = "this_month"
LAST_MONTH = "last_month"
LAST_3_MONTHS = "last_3_months"
THIS_YEAR = "this_year"
CUSTOM = "custom"

PERIOD_KEYS = (TODAY, THIS_WEEK, LAST_WEEK, THIS_MONTH, LAST_MONTH, LAST_3_MONTHS, THIS_YEAR, CUSTOM)

DEFAULT_PERIOD = THIS_MONTH

# Bucket granularities, chosen from the span of the resolved range.
DAY = "day"
WEEK = "week"
MONTH = "month"


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _month_end(day: date) -> date:
    if day.month == 12:
        return date(day.year, 12, 31)
    return date(day.year, day.month + 1, 1) - timedelta(days=1)


def _shift_months(day: date, months: int) -> date:
    """`day`'s month shifted by `months`, clamped to the target month's length."""
    total = (day.year * 12 + (day.month - 1)) + months
    year, month = divmod(total, 12)
    month += 1
    last_day = _month_end(date(year, month, 1)).day
    return date(year, month, min(day.day, last_day))


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _format_range(date_from: date, date_to: date) -> str:
    if date_from == date_to:
        return date_from.strftime("%b %d, %Y")
    if date_from.year == date_to.year:
        return f"{date_from.strftime('%b %d')} – {date_to.strftime('%b %d, %Y')}"
    return f"{date_from.strftime('%b %d, %Y')} – {date_to.strftime('%b %d, %Y')}"


@dataclass(frozen=True)
class Period:
    """A resolved, inclusive date range plus the label the UI echoes back."""

    key: str
    label: str
    date_from: date
    date_to: date

    @property
    def days(self) -> int:
        return (self.date_to - self.date_from).days + 1

    @property
    def datetime_bounds(self) -> tuple[datetime, datetime]:
        """Half-open UTC datetime bounds, for columns stored as timestamps."""
        start = datetime(self.date_from.year, self.date_from.month, self.date_from.day, tzinfo=timezone.utc)
        end = datetime(self.date_to.year, self.date_to.month, self.date_to.day, tzinfo=timezone.utc) + timedelta(days=1)
        return start, end

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "date_from": self.date_from.isoformat(),
            "date_to": self.date_to.isoformat(),
        }


def resolve_period(
    key: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    *,
    today: date | None = None,
) -> Period:
    """Turns a period key (+ optional explicit dates) into a concrete range.

    Explicit `date_from`/`date_to` always win, whatever the key — a caller that
    sends both is describing a custom range regardless of what the dropdown said.
    """
    today = today or today_utc()
    key = key or DEFAULT_PERIOD

    if key not in PERIOD_KEYS:
        raise ValidationException(f"Unknown period '{key}'")

    if date_from is not None or date_to is not None or key == CUSTOM:
        if date_from is None or date_to is None:
            raise ValidationException("A custom period requires both date_from and date_to")
        if date_to < date_from:
            raise ValidationException("date_to must be on or after date_from")
        return Period(key=CUSTOM, label=_format_range(date_from, date_to), date_from=date_from, date_to=date_to)

    if key == TODAY:
        return Period(key=key, label="Today", date_from=today, date_to=today)
    if key == THIS_WEEK:
        start = _week_start(today)
        return Period(key=key, label="This week", date_from=start, date_to=start + timedelta(days=6))
    if key == LAST_WEEK:
        start = _week_start(today) - timedelta(days=7)
        return Period(key=key, label="Last week", date_from=start, date_to=start + timedelta(days=6))
    if key == THIS_MONTH:
        return Period(key=key, label="This month", date_from=_month_start(today), date_to=_month_end(today))
    if key == LAST_MONTH:
        anchor = _shift_months(_month_start(today), -1)
        return Period(key=key, label="Last month", date_from=anchor, date_to=_month_end(anchor))
    if key == LAST_3_MONTHS:
        start = _month_start(_shift_months(_month_start(today), -2))
        return Period(key=key, label="Last 3 months", date_from=start, date_to=_month_end(today))

    return Period(key=THIS_YEAR, label="This year", date_from=date(today.year, 1, 1), date_to=date(today.year, 12, 31))


def previous_period(period: Period) -> Period:
    """The comparison window sitting immediately before `period`.

    Calendar-aware for month/year keys (so "this month" compares against the
    whole previous month, not the preceding N days) and a plain shift by the
    range length for everything else.
    """
    if period.key == THIS_MONTH:
        anchor = _shift_months(period.date_from, -1)
        return Period(key=LAST_MONTH, label="Last month", date_from=anchor, date_to=_month_end(anchor))
    if period.key == LAST_MONTH:
        anchor = _shift_months(period.date_from, -1)
        return Period(key=LAST_MONTH, label="Previous month", date_from=anchor, date_to=_month_end(anchor))
    if period.key == LAST_3_MONTHS:
        start = _shift_months(period.date_from, -3)
        end = _month_end(_shift_months(period.date_to, -3))
        return Period(key=CUSTOM, label="Previous 3 months", date_from=start, date_to=end)
    if period.key == THIS_YEAR:
        year = period.date_from.year - 1
        return Period(key=CUSTOM, label="Last year", date_from=date(year, 1, 1), date_to=date(year, 12, 31))

    span = timedelta(days=period.days)
    return Period(
        key=CUSTOM,
        label="Previous period",
        date_from=period.date_from - span,
        date_to=period.date_to - span,
    )


def granularity_for(period: Period) -> str:
    if period.days <= 31:
        return DAY
    if period.days <= 120:
        return WEEK
    return MONTH


@dataclass(frozen=True)
class Bucket:
    label: str
    start: date
    end: date

    def contains(self, day: date) -> bool:
        return self.start <= day <= self.end


def build_buckets(period: Period, granularity: str | None = None) -> list[Bucket]:
    """Splits `period` into the x-axis buckets a series is plotted over."""
    granularity = granularity or granularity_for(period)
    buckets: list[Bucket] = []

    if granularity == DAY:
        fmt = "%a" if period.days <= 7 else "%b %d"
        cursor = period.date_from
        while cursor <= period.date_to:
            buckets.append(Bucket(label=cursor.strftime(fmt), start=cursor, end=cursor))
            cursor += timedelta(days=1)
        return buckets

    if granularity == WEEK:
        cursor = _week_start(period.date_from)
        while cursor <= period.date_to:
            end = cursor + timedelta(days=6)
            buckets.append(
                Bucket(
                    label=max(cursor, period.date_from).strftime("%b %d"),
                    start=max(cursor, period.date_from),
                    end=min(end, period.date_to),
                )
            )
            cursor = end + timedelta(days=1)
        return buckets

    fmt = "%b" if period.days <= 370 else "%b %y"
    cursor = _month_start(period.date_from)
    while cursor <= period.date_to:
        end = _month_end(cursor)
        buckets.append(
            Bucket(
                label=cursor.strftime(fmt),
                start=max(cursor, period.date_from),
                end=min(end, period.date_to),
            )
        )
        cursor = end + timedelta(days=1)
    return buckets


def bucket_index(buckets: list[Bucket], day: date) -> int | None:
    for index, bucket in enumerate(buckets):
        if bucket.contains(day):
            return index
    return None


def percent_change(current: float, previous: float) -> float | None:
    """Signed percentage change, or None when there is no baseline to compare to."""
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


def get_period(
    period: str | None = Query(default=None, description="Named range: this_week, this_month, last_month, …"),
    date_from: date | None = Query(default=None, description="Custom range start (inclusive)"),
    date_to: date | None = Query(default=None, description="Custom range end (inclusive)"),
) -> Period:
    """Route dependency: the shared `?period=&date_from=&date_to=` filter."""
    return resolve_period(period, date_from, date_to)
