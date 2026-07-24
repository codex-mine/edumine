import enum

from sqlalchemy import Enum as SAEnum

_enum_cache: dict[str, SAEnum] = {}


def pg_enum(python_enum: type[enum.Enum], name: str) -> SAEnum:
    """Native Postgres ENUM type bound to a Python str-enum, keyed by value (not member name).

    Cached by type name so an enum shared across multiple tables (e.g. `attendance_status`,
    `employment_status`) resolves to a single SQLAlchemy type instance and Postgres CREATE TYPE
    is only ever emitted once for it.
    """

    if name not in _enum_cache:
        _enum_cache[name] = SAEnum(python_enum, name=name, values_callable=lambda obj: [e.value for e in obj])
    return _enum_cache[name]


class GenderType(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class StudentStatus(str, enum.Enum):
    active = "active"
    transferred = "transferred"
    graduated = "graduated"
    dropped = "dropped"


class EmploymentStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    resigned = "resigned"
    terminated = "terminated"


class EnrollmentStatus(str, enum.Enum):
    active = "active"
    promoted = "promoted"
    transferred = "transferred"
    graduated = "graduated"
    dropped = "dropped"


class Weekday(str, enum.Enum):
    monday = "monday"
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    half_day = "half_day"
    leave = "leave"


class ExamStatus(str, enum.Enum):
    draft = "draft"
    question_pending = "question_pending"
    ready = "ready"
    results_pending = "results_pending"
    published = "published"


class PublicationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    published = "published"
    rejected = "rejected"


class InvoiceStatus(str, enum.Enum):
    unpaid = "unpaid"
    partially_paid = "partially_paid"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class DiscountType(str, enum.Enum):
    flat = "flat"
    percentage = "percentage"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    online = "online"
    bank_transfer = "bank_transfer"
    cheque = "cheque"


class PayrollStatus(str, enum.Enum):
    draft = "draft"
    processed = "processed"
    paid = "paid"


class PayslipStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class AssetCondition(str, enum.Enum):
    new = "new"
    good = "good"
    fair = "fair"
    damaged = "damaged"
    disposed = "disposed"


class AssetChangeType(str, enum.Enum):
    quantity_update = "quantity_update"
    condition_update = "condition_update"
    relocation = "relocation"
    disposal = "disposal"


class AudienceType(str, enum.Enum):
    all = "all"
    students = "students"
    teachers = "teachers"
    staff = "staff"
    guardians = "guardians"
    specific_class = "specific_class"


class SmsStatus(str, enum.Enum):
    queued = "queued"
    sent = "sent"
    failed = "failed"
