"""Large-scale, historical dev-data seed for Codex Edumine.

Creates a full school's worth of people and then drives every module's real
workflow over a *past* date range (March 2026 -> today) so the dashboards,
reports, and list screens have months of data rather than a single day.

People created (all with the password below):

    250 students        student1@gmail.com   .. student250@gmail.com
     23 teachers        teacher1@gmail.com   .. teacher23@gmail.com
      5 staff           staff1@gmail.com     .. staff5@gmail.com
      2 receptionists   receptionist1@gmail.com .. receptionist2@gmail.com
      1 accountant      accountant1@gmail.com
      2 admins          admin1@gmail.com     .. admin2@gmail.com
    150 guardians       guardian1@gmail.com  .. guardian150@gmail.com

Everything downstream (sections, class-subjects, routine, attendance, exams,
results, invoices, payments, payroll, expenses, assets, announcements, OMR
answer keys) is generated through the app's own service layer so computed
fields, invariants, and audit-log entries stay correct. Where a service
deliberately refuses to backdate -- exam question/marks deadlines, payment
timestamps, publication dates -- the workflow is run against "now" and the
resulting rows are then backdated in a single pass (`backdate_history`).

Idempotent: safe to re-run. Every section skips rows that already exist.

Run from the backend/ directory:
    ./.venv/Scripts/python.exe scripts/seed_bulk_data.py
"""

import asyncio
import calendar
import random
import sys
import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.common.dependencies import CurrentUser
from app.common.enums import (
    AssetCondition,
    AttendanceStatus,
    AudienceType,
    BloodGroupType,
    DiscountType,
    GenderType,
    PaymentMethod,
    Weekday,
)
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.core.security import hash_password
from app.db.session import get_db

from app.modules.academic import repository as academic_repository
from app.modules.academic import schemas as academic_schemas
from app.modules.academic import service as academic_service
from app.modules.academic.models import Class, ClassSubject, Room, Section, StudentEnrollment, Subject

from app.modules.auth import repository as auth_repository
from app.modules.auth.models import Role, User

from app.modules.students import repository as students_repository
from app.modules.students import schemas as students_schemas
from app.modules.students import service as students_service
from app.modules.students.models import Student, StudentGuardian

from app.modules.teachers import schemas as teachers_schemas
from app.modules.teachers import service as teachers_service
from app.modules.teachers.models import Teacher

from app.modules.guardians import schemas as guardians_schemas
from app.modules.guardians import service as guardians_service

from app.modules.users import schemas as users_schemas
from app.modules.users import service as users_service

from app.modules.routine import repository as routine_repository
from app.modules.routine import schemas as routine_schemas
from app.modules.routine import service as routine_service

from app.modules.attendance import repository as attendance_repository
from app.modules.attendance import schemas as attendance_schemas
from app.modules.attendance import service as attendance_service
from app.modules.attendance.models import ClassAttendance, DailyAttendance

from app.modules.exams import repository as exams_repository
from app.modules.exams import schemas as exams_schemas
from app.modules.exams import service as exams_service
from app.modules.exams.models import Exam

from app.modules.results import repository as results_repository
from app.modules.results import schemas as results_schemas
from app.modules.results import service as results_service

from app.modules.billing import repository as billing_repository
from app.modules.billing import schemas as billing_schemas
from app.modules.billing import service as billing_service
from app.modules.billing.models import FeeType

from app.modules.payroll import repository as payroll_repository
from app.modules.payroll import schemas as payroll_schemas
from app.modules.payroll import service as payroll_service

from app.modules.expenses import repository as expenses_repository
from app.modules.expenses import schemas as expenses_schemas
from app.modules.expenses import service as expenses_service
from app.modules.expenses.models import ExpenseCategory

from app.modules.assets import repository as assets_repository
from app.modules.assets import schemas as assets_schemas
from app.modules.assets import service as assets_service
from app.modules.assets.models import Asset, AssetCategory

from app.modules.communication import schemas as communication_schemas
from app.modules.communication import service as communication_service

from app.modules.omr import repository as omr_repository

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SEED_PASSWORD = "Password123!"

STUDENT_COUNT = 250
TEACHER_COUNT = 23
STAFF_COUNT = 5
RECEPTIONIST_COUNT = 2
ACCOUNTANT_COUNT = 1
ADMIN_COUNT = 2
GUARDIAN_COUNT = 150

# Every generated account uses the 019xxxxxxxx block, which no existing row
# occupies -- phone is unique on `users`, so a clash would abort the run.
PHONE_BASE = {
    "student": 1900000000,
    "teacher": 1910000000,
    "staff": 1920000000,
    "receptionist": 1930000000,
    "accountant": 1940000000,
    "admin": 1950000000,
    "guardian": 1960000000,
}

TODAY = date.today()
HISTORY_START = date(2026, 3, 1)          # daily attendance / invoices / payroll from here
# Subject-wise attendance is by far the heaviest table (~1.3k rows per school
# day), but splitting it into windows leaves visible month-shaped holes in the
# reports, so it covers the same continuous range as everything else.
CLASS_ATTENDANCE_BLOCKS = [(HISTORY_START, TODAY)]

SECTIONS_PER_CLASS = ("A", "B")
PERIODS = [
    (1, time(9, 0), time(9, 45)),
    (2, time(9, 45), time(10, 30)),
    (3, time(10, 30), time(11, 15)),
    (4, time(11, 45), time(12, 30)),
    (5, time(12, 30), time(13, 15)),
]
SCHOOL_DAYS = [Weekday.monday, Weekday.tuesday, Weekday.wednesday, Weekday.thursday, Weekday.friday]

CORE_SUBJECTS = [
    ("Bangla", "BAN"),
    ("English", "ENG121"),
    ("Math", "Math212"),
    ("General Science", "GSCI"),
    ("Social Science", "SOCS"),
    ("ICT", "ICT"),
]

FIRST_NAMES_M = [
    "Rakib", "Tanvir", "Sabbir", "Nayeem", "Imran", "Shakil", "Rifat", "Arif", "Mahin", "Sajid",
    "Fahim", "Rasel", "Jubayer", "Sohan", "Tamim", "Naeem", "Hasib", "Ridoy", "Siam", "Anik",
    "Mizan", "Rana", "Farhan", "Shanto", "Nafis", "Rohan", "Zahid", "Mehedi", "Tousif", "Rayhan",
]
FIRST_NAMES_F = [
    "Nusrat", "Tasnim", "Sadia", "Jannat", "Mim", "Farzana", "Sumaiya", "Rima", "Afsana", "Lamia",
    "Nishat", "Sabina", "Tanjila", "Ishrat", "Mahira", "Rupa", "Sharmin", "Nabila", "Rubaiya", "Shirin",
    "Anika", "Tahmina", "Marzia", "Fariha", "Umme", "Jarin", "Sanjida", "Priya", "Rehnuma", "Sneha",
]
LAST_NAMES = [
    "Ahmed", "Hossain", "Islam", "Rahman", "Chowdhury", "Khan", "Sarker", "Mia", "Akter", "Begum",
    "Haque", "Uddin", "Talukder", "Bhuiyan", "Mondal", "Sheikh", "Kabir", "Alam", "Siddique", "Molla",
]

BLOOD_GROUPS = list(BloodGroupType)
DHAKA_AREAS = [
    "Mirpur, Dhaka", "Uttara, Dhaka", "Dhanmondi, Dhaka", "Mohammadpur, Dhaka", "Bashundhara, Dhaka",
    "Banasree, Dhaka", "Badda, Dhaka", "Khilgaon, Dhaka", "Savar, Dhaka", "Gazipur",
]

random.seed(20260807)


def log(msg: str) -> None:
    print(f"[seed] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


async def _one(db, model, **filters):
    conditions = [getattr(model, key) == value for key, value in filters.items()]
    result = await db.execute(select(model).where(*conditions))
    return result.scalars().first()


def phone_for(kind: str, index: int) -> str:
    return f"0{PHONE_BASE[kind] + index}"


def person_name(index: int, gender: GenderType) -> str:
    pool = FIRST_NAMES_M if gender == GenderType.male else FIRST_NAMES_F
    return f"{pool[index % len(pool)]} {LAST_NAMES[(index // 3) % len(LAST_NAMES)]}"


def gender_for(index: int) -> GenderType:
    return GenderType.male if index % 2 == 1 else GenderType.female


def school_days_between(start: date, end: date) -> list[date]:
    """Mon-Fri only; the rest of the app already treats those as school days."""
    days, cursor = [], start
    while cursor <= end:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days


def month_starts(start: date, end: date) -> list[date]:
    months, cursor = [], date(start.year, start.month, 1)
    while cursor <= end:
        months.append(cursor)
        cursor = date(cursor.year + (cursor.month == 12), (cursor.month % 12) + 1, 1)
    return months


async def bulk_insert(db, model, rows: list[dict], *, index_elements: list[str], chunk: int = 4000) -> int:
    """Chunked INSERT ... ON CONFLICT DO NOTHING -- the volumes here (tens of
    thousands of attendance rows) are far too large for per-row ORM upserts."""
    written = 0
    for offset in range(0, len(rows), chunk):
        batch = rows[offset : offset + chunk]
        if not batch:
            continue
        statement = pg_insert(model).values(batch).on_conflict_do_nothing(index_elements=index_elements)
        result = await db.execute(statement)
        written += result.rowcount or 0
        await db.commit()
    return written


async def actor_from_email(db, email: str, role_name: str) -> CurrentUser:
    user = await auth_repository.get_user_by_email(db, email)
    assert user is not None, f"expected seed user with email {email} to already exist"
    return CurrentUser(
        id=user.id, full_name=user.full_name, phone=user.phone, email=user.email,
        role=role_name, permissions=frozenset(),
    )


def actor_for_user(user: User, role_name: str) -> CurrentUser:
    return CurrentUser(
        id=user.id, full_name=user.full_name, phone=user.phone, email=user.email,
        role=role_name, permissions=frozenset(),
    )


# ---------------------------------------------------------------------------
# 1. Reference data: rooms + subjects
# ---------------------------------------------------------------------------


async def seed_reference_data(db, principal: CurrentUser):
    rooms = {r.name: r for r in (await db.execute(select(Room).where(Room.deleted_at.is_(None)))).scalars()}
    for floor in range(1, 4):
        for number in range(1, 6):
            name = f"Room {floor}{number:02d}"
            if name in rooms:
                continue
            rooms[name] = await academic_service.create_room(
                db, principal, academic_schemas.CreateRoomRequest(name=name, capacity=random.choice([30, 40, 45, 50]))
            )
    log(f"rooms available: {len(rooms)}")

    subjects = {
        s.name: s
        for s in (await db.execute(select(Subject).where(Subject.deleted_at.is_(None)))).scalars()
    }
    for name, code in CORE_SUBJECTS:
        if name in subjects:
            continue
        subjects[name] = await academic_service.create_subject(
            db, principal, academic_schemas.CreateSubjectRequest(name=name, code=code)
        )
        log(f"created subject {name}")

    classes = {
        c.name: c
        for c in (await db.execute(select(Class).where(Class.deleted_at.is_(None)).order_by(Class.numeric_order))).scalars()
    }
    log(f"classes available: {', '.join(sorted(classes, key=lambda n: classes[n].numeric_order))}")
    return rooms, subjects, classes


# ---------------------------------------------------------------------------
# 2. Staffing: teachers, staff-like accounts, admins
# ---------------------------------------------------------------------------


async def seed_teachers(db, principal: CurrentUser) -> list[tuple[Teacher, User]]:
    designations = ["Assistant Teacher", "Senior Teacher", "Lecturer", "Head of Department"]
    created = 0
    for index in range(1, TEACHER_COUNT + 1):
        email = f"teacher{index}@gmail.com"
        if await auth_repository.get_user_by_email(db, email) is not None:
            continue
        gender = gender_for(index)
        await teachers_service.create_teacher(
            db, principal,
            teachers_schemas.CreateTeacherRequest(
                full_name=person_name(index + 7, gender),
                email=email,
                phone=phone_for("teacher", index),
                gender=gender,
                date_of_birth=date(1980 + (index % 15), ((index * 5) % 12) + 1, ((index * 3) % 27) + 1),
                joining_date=date(2018 + (index % 7), ((index * 2) % 12) + 1, 1),
                designation=designations[index % len(designations)],
                nid_number=f"19{8000000000 + index * 137}",
                previous_employment=None if index % 3 else "Dhaka Model School",
                qualifications=[
                    teachers_schemas.QualificationInput(
                        education_title=random.choice(["B.Ed", "M.Ed", "B.Sc (Hons)", "M.A.", "M.Sc"]),
                        institute=random.choice(
                            ["University of Dhaka", "Jahangirnagar University", "BUET", "Rajshahi University", "National University"]
                        ),
                        grade=random.choice(["A+", "A", "A-", "First Class"]),
                        passing_year=2005 + (index % 15),
                    )
                ],
            ),
        )
        created += 1
    log(f"teachers: {created} created ({TEACHER_COUNT} requested)")

    rows = (
        await db.execute(
            select(Teacher, User)
            .join(User, User.id == Teacher.user_id)
            .where(Teacher.deleted_at.is_(None), User.is_active.is_(True))
            .order_by(Teacher.employee_code.asc())
        )
    ).all()
    return list(rows)


async def seed_staff_accounts(db, principal: CurrentUser) -> None:
    plans = [
        ("staff", STAFF_COUNT, "Support Staff", "Administration"),
        ("receptionist", RECEPTIONIST_COUNT, "Receptionist", "Front Desk"),
        ("accountant", ACCOUNTANT_COUNT, "Accounts Officer", "Finance"),
        ("admin", ADMIN_COUNT, None, None),
    ]
    for role, count, designation, department in plans:
        created = 0
        for index in range(1, count + 1):
            email = f"{role}{index}@gmail.com"
            if await auth_repository.get_user_by_email(db, email) is not None:
                continue
            gender = gender_for(index + (0 if role == "staff" else 1))
            payload = users_schemas.CreateUserAccountRequest(
                role=role,
                full_name=person_name(index * 4 + len(role), gender),
                email=email,
                phone=phone_for(role, index),
                gender=gender,
                date_of_birth=date(1985 + (index % 12), ((index * 7) % 12) + 1, ((index * 5) % 27) + 1),
                # Admin keeps a client-supplied password; staff-like roles get a
                # DOB-derived one, which `apply_seed_password` overwrites later.
                password=SEED_PASSWORD if role == "admin" else None,
                department=department,
                designation=designation,
                joining_date=None if role == "admin" else date(2020 + (index % 5), ((index * 3) % 12) + 1, 1),
                nid_number=f"19{7000000000 + index * 911}",
                qualifications=[]
                if role == "admin"
                else [
                    users_schemas.QualificationInput(
                        education_title=random.choice(["B.Com", "BBA", "HSC", "B.A."]),
                        institute=random.choice(["National University", "Dhaka College", "Titumir College"]),
                        grade=random.choice(["A", "A-", "B"]),
                        passing_year=2008 + (index % 14),
                    )
                ],
            )
            await users_service.create_user_account(db, principal, payload)
            created += 1
        log(f"{role}: {created} created ({count} requested)")


# ---------------------------------------------------------------------------
# 3. Academic structure: sections + class-subject-teacher assignments
# ---------------------------------------------------------------------------


async def seed_sections(db, principal: CurrentUser, year, classes, rooms, teachers) -> tuple[list[Section], list[Section]]:
    """Returns (all active sections, the A/B sections this script owns).

    New sections are created without a capacity cap: the 250 students are
    distributed across them round-robin, and a cap would only turn an even
    spread into a mid-run enrollment failure."""
    room_pool = sorted(rooms.values(), key=lambda r: r.name)
    ordered_classes = sorted(classes.values(), key=lambda c: c.numeric_order)

    index = 0
    intake_ids: list[uuid.UUID] = []
    for class_entity in ordered_classes:
        for section_name in SECTIONS_PER_CLASS:
            existing = await academic_repository.get_section_by_year_class_name(
                db, academic_year_id=year.id, class_id=class_entity.id, name=section_name
            )
            if existing is not None:
                intake_ids.append(existing.id)
                index += 1
                continue
            teacher, _user = teachers[index % len(teachers)]
            section = await academic_service.create_section(
                db, principal,
                academic_schemas.CreateSectionRequest(
                    academic_year_id=year.id, class_id=class_entity.id,
                    room_id=room_pool[index % len(room_pool)].id,
                    name=section_name, capacity=None, class_teacher_id=teacher.id,
                ),
            )
            intake_ids.append(section.id)
            log(f"created section {class_entity.name}/{section_name}")
            index += 1

    sections = list(
        (
            await db.execute(
                select(Section)
                .where(Section.academic_year_id == year.id, Section.deleted_at.is_(None))
                .order_by(Section.name.asc())
            )
        ).scalars()
    )
    # Keep sections grouped by class order so student distribution is even.
    order = {c.id: c.numeric_order for c in ordered_classes}
    sections.sort(key=lambda s: (order.get(s.class_id, 99), s.name))
    intake = [s for s in sections if s.id in set(intake_ids)]
    log(f"sections in {year.name}: {len(sections)} total, {len(intake)} taking the new intake")
    return sections, intake


async def seed_class_subjects(db, principal: CurrentUser, year, classes, subjects, teachers) -> dict:
    """Every class gets all core subjects, each with a distinct teacher where
    possible -- the routine builder relies on that spread to avoid clashes."""
    ordered_classes = sorted(classes.values(), key=lambda c: c.numeric_order)
    core = [subjects[name] for name, _code in CORE_SUBJECTS if name in subjects]

    cursor = 0
    for class_entity in ordered_classes:
        for subject in core:
            teacher, _user = teachers[cursor % len(teachers)]
            cursor += 1
            existing = await academic_repository.get_class_subject_by_year_class_subject(
                db, academic_year_id=year.id, class_id=class_entity.id, subject_id=subject.id
            )
            if existing is not None:
                if existing.teacher_id is None:
                    await academic_service.update_class_subject(
                        db, principal, existing.id,
                        academic_schemas.UpdateClassSubjectRequest(teacher_id=teacher.id),
                    )
                continue
            try:
                await academic_service.create_class_subject(
                    db, principal,
                    academic_schemas.CreateClassSubjectRequest(
                        academic_year_id=year.id, class_id=class_entity.id, subject_id=subject.id,
                        teacher_id=teacher.id, full_marks=100,
                    ),
                )
            except (ConflictException, ValidationException) as exc:
                log(f"class_subject {class_entity.name}/{subject.name} skipped: {exc}")

    by_class: dict[uuid.UUID, list[tuple[Subject, Teacher]]] = {}
    teachers_by_id = {t.id: (t, u) for t, u in teachers}
    rows = (
        await db.execute(select(ClassSubject).where(ClassSubject.academic_year_id == year.id))
    ).scalars().all()
    subjects_by_id = {s.id: s for s in subjects.values()}
    for class_subject in rows:
        if class_subject.teacher_id is None or class_subject.teacher_id not in teachers_by_id:
            continue
        subject = subjects_by_id.get(class_subject.subject_id)
        if subject is None:
            continue
        by_class.setdefault(class_subject.class_id, []).append(
            (subject, teachers_by_id[class_subject.teacher_id][0])
        )
    log(f"class-subject assignments: {sum(len(v) for v in by_class.values())}")
    return by_class


# ---------------------------------------------------------------------------
# 4. Students + guardians
# ---------------------------------------------------------------------------


async def seed_students(db, principal: CurrentUser, sections: list[Section]) -> None:
    created = 0
    for index in range(1, STUDENT_COUNT + 1):
        email = f"student{index}@gmail.com"
        if await auth_repository.get_user_by_email(db, email) is not None:
            continue
        gender = gender_for(index)
        section = sections[index % len(sections)]
        try:
            await students_service.create_student(
                db, principal,
                students_schemas.CreateStudentRequest(
                    full_name=person_name(index, gender),
                    email=email,
                    phone=phone_for("student", index),
                    gender=gender,
                    date_of_birth=date(2010 + (index % 6), ((index * 7) % 12) + 1, ((index * 11) % 27) + 1),
                    section_id=section.id,
                    admission_date=date(2026, 1, ((index % 25) + 1)),
                    blood_group=BLOOD_GROUPS[index % len(BLOOD_GROUPS)],
                    address=DHAKA_AREAS[index % len(DHAKA_AREAS)],
                    emergency_contact=phone_for("guardian", (index % GUARDIAN_COUNT) + 1),
                ),
            )
        except (ConflictException, ValidationException) as exc:
            # create_student writes the user row before enrolling, so a failure
            # part-way leaves uncommitted rows the next student would trip over.
            await db.rollback()
            log(f"student{index} skipped: {exc}")
            continue
        created += 1
        if created and created % 25 == 0:
            log(f"  ... {created} students admitted")
    log(f"students: {created} created ({STUDENT_COUNT} requested)")

    # An interrupted earlier run can leave a student row whose enrollment never
    # landed. Everything downstream (results, invoices, class attendance) keys
    # off the enrollment, so backfill before moving on.
    unenrolled = (
        await db.execute(
            select(Student)
            .join(User, User.id == Student.user_id)
            .outerjoin(StudentEnrollment, StudentEnrollment.student_id == Student.id)
            .where(Student.deleted_at.is_(None), User.is_active.is_(True), StudentEnrollment.id.is_(None))
            .order_by(Student.admission_number.asc())
        )
    ).scalars().all()
    backfilled = 0
    for position, student in enumerate(unenrolled):
        try:
            await academic_service.enroll_student(
                db, principal,
                academic_schemas.EnrollStudentRequest(
                    student_id=student.id, academic_year_id=None,
                    section_id=sections[position % len(sections)].id, roll_number=None,
                ),
            )
            backfilled += 1
        except (ConflictException, ValidationException) as exc:
            await db.rollback()
            log(f"enrollment backfill skipped for {student.admission_number}: {exc}")
    if backfilled:
        log(f"enrollments backfilled: {backfilled}")

    total = (
        await db.execute(
            text(
                "SELECT count(*) FROM students s JOIN users u ON u.id = s.user_id "
                "WHERE s.deleted_at IS NULL AND u.is_active AND u.email ~ '^student[0-9]+@gmail\\.com$'"
            )
        )
    ).scalar_one()
    log(f"seeded students now in the database: {total}")


async def seed_guardians(db, principal: CurrentUser) -> None:
    created = 0
    for index in range(1, GUARDIAN_COUNT + 1):
        email = f"guardian{index}@gmail.com"
        if await auth_repository.get_user_by_email(db, email) is not None:
            continue
        gender = gender_for(index)
        await guardians_service.create_guardian(
            db, principal,
            guardians_schemas.CreateGuardianRequest(
                full_name=person_name(index * 2 + 5, gender),
                email=email,
                phone=phone_for("guardian", index),
                password=SEED_PASSWORD,
                gender=gender,
                date_of_birth=date(1975 + (index % 15), ((index * 5) % 12) + 1, ((index * 7) % 27) + 1),
                occupation=random.choice(["Business", "Service", "Teacher", "Doctor", "Engineer", "Homemaker"]),
                address=DHAKA_AREAS[index % len(DHAKA_AREAS)],
            ),
        )
        created += 1
    log(f"guardians: {created} created ({GUARDIAN_COUNT} requested)")

    # Link every unlinked student to a guardian, letting some guardians carry
    # two children so the "siblings" case is represented.
    guardian_rows = (
        await db.execute(
            text(
                "SELECT g.id FROM guardians g JOIN users u ON u.id = g.user_id "
                "WHERE u.email LIKE 'guardian%@gmail.com' ORDER BY u.email"
            )
        )
    ).all()
    guardian_ids = [row[0] for row in guardian_rows]
    if not guardian_ids:
        return

    linked_student_ids = {row[0] for row in (await db.execute(select(StudentGuardian.student_id))).all()}
    students = (
        await db.execute(
            select(Student)
            .join(User, User.id == Student.user_id)
            .where(Student.deleted_at.is_(None), User.is_active.is_(True))
            .order_by(Student.admission_number.asc())
        )
    ).scalars().all()

    links = 0
    for position, student in enumerate(students):
        if student.id in linked_student_ids:
            continue
        guardian_id = guardian_ids[position % len(guardian_ids)]
        relation = "Father" if position % 2 == 0 else "Mother"
        try:
            await students_service.link_guardian(db, principal, student.id, guardian_id, relation, True)
            links += 1
        except (ConflictException, NotFoundException) as exc:
            log(f"guardian link skipped: {exc}")
    log(f"student-guardian links created: {links}")


async def apply_seed_password(db) -> None:
    """All generated accounts share one password. The service layer derives
    student/teacher/staff passwords from date of birth, so overwrite the hash
    once here rather than fighting each onboarding flow."""
    password_hash = hash_password(SEED_PASSWORD)
    result = await db.execute(
        text(
            "UPDATE users SET password_hash = :hash "
            "WHERE email ~ '^(student|teacher|staff|receptionist|accountant|admin|guardian)[0-9]+@gmail\\.com$'"
        ),
        {"hash": password_hash},
    )
    await db.commit()
    log(f"password set to '{SEED_PASSWORD}' for {result.rowcount} seeded accounts")


# ---------------------------------------------------------------------------
# 5. Weekly routine
# ---------------------------------------------------------------------------


async def seed_routine(db, principal: CurrentUser, year, sections, class_subjects, rooms) -> list:
    """Greedy timetable build. `routine_slots` is uniquely constrained on both
    (section, day, period) and (teacher, day, period), so a teacher already
    booked in that period is simply skipped and the section tries its next
    subject -- leaving an occasional free period, which is realistic anyway."""
    room_pool = sorted(rooms.values(), key=lambda r: r.name)
    existing_slots = await routine_repository.list_slots(
        db, academic_year_id=year.id, section_id=None, teacher_id=None, day_of_week=None
    )
    booked: dict[tuple[Weekday, int], set[uuid.UUID]] = {}
    filled: set[tuple[uuid.UUID, Weekday, int]] = set()
    for slot, *_rest in existing_slots:
        booked.setdefault((slot.day_of_week, slot.period_number), set()).add(slot.teacher_id)
        filled.add((slot.section_id, slot.day_of_week, slot.period_number))

    created = 0
    for day_index, day in enumerate(SCHOOL_DAYS):
        for period_number, start_time, end_time in PERIODS:
            busy = booked.setdefault((day, period_number), set())
            for section_index, section in enumerate(sections):
                if (section.id, day, period_number) in filled:
                    continue
                candidates = class_subjects.get(section.class_id, [])
                if not candidates:
                    continue
                offset = (section_index + day_index * 2 + period_number) % len(candidates)
                rotated = candidates[offset:] + candidates[:offset]
                for subject, teacher in rotated:
                    if teacher.id in busy:
                        continue
                    try:
                        await routine_service.create_slot(
                            db, principal,
                            routine_schemas.CreateRoutineSlotRequest(
                                academic_year_id=year.id, section_id=section.id, subject_id=subject.id,
                                teacher_id=teacher.id,
                                room_id=room_pool[(section_index + period_number) % len(room_pool)].id,
                                day_of_week=day, period_number=period_number,
                                start_time=start_time, end_time=end_time,
                            ),
                        )
                    except (ConflictException, ValidationException):
                        continue
                    busy.add(teacher.id)
                    filled.add((section.id, day, period_number))
                    created += 1
                    break

    slots = await routine_repository.list_slots(
        db, academic_year_id=year.id, section_id=None, teacher_id=None, day_of_week=None
    )
    log(f"routine slots: {created} created, {len(slots)} total")
    return slots


# ---------------------------------------------------------------------------
# 6. Attendance: punches, daily attendance, subject-wise class attendance
# ---------------------------------------------------------------------------


async def seed_attendance(db, principal: CurrentUser, year, slots) -> None:
    devices = await attendance_repository.list_devices(db)
    if not devices:
        for serial, location in (("BIO-GATE-01", "Main Gate"), ("BIO-GATE-02", "Staff Entrance")):
            await attendance_repository.create_device(db, device_serial=serial, location=location)
        await db.commit()
        devices = await attendance_repository.list_devices(db)
        log(f"created {len(devices)} biometric devices")
    device = devices[0]

    people = (
        await db.execute(
            select(User.id, Role.name)
            .join(Role, Role.id == User.role_id)
            .where(
                Role.name.in_(["student", "teacher", "staff", "accountant", "receptionist", "admin", "principal"]),
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
    ).all()
    log(f"attendance population: {len(people)} people")

    # A stable ~4% of the roll are chronic absentees, so the At-Risk widgets
    # have a real signal rather than uniform noise.
    at_risk = {user_id for user_id, role in people if role == "student" and random.random() < 0.04}

    days = school_days_between(HISTORY_START, TODAY)
    daily_rows: list[dict] = []
    for day in days:
        for user_id, _role in people:
            roll = random.random()
            if user_id in at_risk:
                status = AttendanceStatus.absent if roll < 0.45 else (
                    AttendanceStatus.late if roll < 0.65 else AttendanceStatus.present
                )
            elif roll < 0.04:
                status = AttendanceStatus.absent
            elif roll < 0.07:
                status = AttendanceStatus.leave
            elif roll < 0.18:
                status = AttendanceStatus.late
            else:
                status = AttendanceStatus.present

            if status in (AttendanceStatus.absent, AttendanceStatus.leave):
                entry_time = exit_time = None
            else:
                minute = random.randint(31, 55) if status == AttendanceStatus.late else random.randint(0, 25)
                entry_time = datetime(day.year, day.month, day.day, 8, minute, tzinfo=timezone.utc)
                exit_time = entry_time + timedelta(hours=6, minutes=random.randint(0, 90))
            daily_rows.append(
                {
                    "user_id": user_id,
                    "attendance_date": day,
                    "entry_time": entry_time,
                    "exit_time": exit_time,
                    "status": status,
                    "created_at": datetime(day.year, day.month, day.day, 18, 0, tzinfo=timezone.utc),
                    "updated_at": datetime(day.year, day.month, day.day, 18, 0, tzinfo=timezone.utc),
                }
            )
    written = await bulk_insert(
        db, DailyAttendance, daily_rows, index_elements=["user_id", "attendance_date"]
    )
    log(f"daily attendance: {written} rows written across {len(days)} school days ({HISTORY_START} -> {TODAY})")

    # A handful of genuine punch events through the real ingestion pipeline, so
    # attendance_punches is populated by the code path that owns it.
    recent = [d for d in days if d >= TODAY - timedelta(days=4)]
    punch_people = [user_id for user_id, role in people if role in ("teacher", "staff", "admin")][:12]
    punches = 0
    for day in recent:
        for user_id in punch_people:
            morning = datetime(day.year, day.month, day.day, 8, random.randint(0, 20), tzinfo=timezone.utc)
            for punched_at in (morning, morning + timedelta(hours=7, minutes=random.randint(0, 45))):
                try:
                    await attendance_service.ingest_punch(
                        db, principal,
                        attendance_schemas.PunchEventRequest(
                            device_serial=device.device_serial, user_id=user_id, punched_at=punched_at
                        ),
                    )
                    punches += 1
                except (ConflictException, ValidationException, NotFoundException):
                    continue
    log(f"biometric punches ingested: {punches}")

    # Subject-wise attendance, driven off the real timetable.
    slots_by_day: dict[Weekday, list] = {}
    for row in slots:
        slots_by_day.setdefault(row[0].day_of_week, []).append(row)

    roster_cache: dict[uuid.UUID, list[uuid.UUID]] = {}
    class_rows: list[dict] = []
    total_days = 0
    for block_start, block_end in CLASS_ATTENDANCE_BLOCKS:
        for day in school_days_between(block_start, block_end):
            weekday = list(Weekday)[day.weekday()]
            day_slots = slots_by_day.get(weekday, [])
            if not day_slots:
                continue
            total_days += 1
            for slot, section, class_entity, _subject, teacher, _teacher_user, _room in day_slots:
                if section.id not in roster_cache:
                    students = await results_repository.list_students_in_class(
                        db, academic_year_id=year.id, class_id=class_entity.id
                    )
                    roster_cache[section.id] = [
                        student.id for student, _u, _e, enrolled in students if enrolled.id == section.id
                    ]
                marked_at = datetime(day.year, day.month, day.day, slot.start_time.hour, slot.start_time.minute, tzinfo=timezone.utc)
                for student_id in roster_cache[section.id]:
                    roll = random.random()
                    status = (
                        AttendanceStatus.absent if roll < 0.06
                        else AttendanceStatus.late if roll < 0.11
                        else AttendanceStatus.present
                    )
                    class_rows.append(
                        {
                            "student_id": student_id,
                            "routine_slot_id": slot.id,
                            "attendance_date": day,
                            "status": status,
                            "marked_by": teacher.id,
                            "marked_at": marked_at,
                            "created_at": marked_at,
                            "updated_at": marked_at,
                        }
                    )
    written = await bulk_insert(
        db, ClassAttendance, class_rows, index_elements=["student_id", "routine_slot_id", "attendance_date"]
    )
    log(f"class attendance: {written} rows written across {total_days} timetabled days")


# ---------------------------------------------------------------------------
# 7. Exams -> results, driven end to end
# ---------------------------------------------------------------------------


def _questions_for(full_marks: int, subject_name: str) -> list[exams_schemas.QuestionItem]:
    """10 MCQs worth 1 each + short/long questions making up the rest."""
    mcq = [
        exams_schemas.QuestionItem(
            question_text=f"{subject_name}: which option correctly completes statement {i + 1}?",
            marks=1, type="mcq", options=["Option Ka", "Option Kha", "Option Ga", "Option Gha"],
        )
        for i in range(10)
    ]
    remaining = full_marks - 10
    long_count = 3
    per_long = remaining // long_count
    marks = [per_long] * long_count
    marks[-1] += remaining - per_long * long_count
    written = [
        exams_schemas.QuestionItem(
            question_text=f"{subject_name}: explain concept {i + 1} with examples.",
            marks=m, type="long", options=None,
        )
        for i, m in enumerate(marks)
    ]
    return mcq + written


async def run_exam_pipeline(db, principal: CurrentUser, year, classes, *, name, term, start_date, end_date, publish: bool):
    """Configure -> submit questions -> approve -> enter marks -> compile ->
    approve -> publish. Deadlines are set in the near future because the
    service layer refuses to accept submissions past them; `backdate_history`
    rewrites them to match `start_date` once the workflow has run."""
    exam = await _one(db, Exam, name=name, academic_year_id=year.id)
    if exam is None:
        exam = await exams_service.create_exam(
            db, principal,
            exams_schemas.CreateExamRequest(
                academic_year_id=year.id, name=name, term=term,
                start_date=start_date, end_date=end_date,
                class_ids=[c.id for c in classes.values()],
            ),
        )
        log(f"created exam '{name}' ({start_date} -> {end_date})")

    pub = await results_repository.get_publication(db, exam.id)
    if pub is not None and pub.status.value in ("approved", "published"):
        log(f"exam '{name}' already finalised (status={pub.status.value}), skip")
        return exam

    now = datetime.now(timezone.utc)
    class_subject_rows = (
        await db.execute(select(ClassSubject).where(ClassSubject.academic_year_id == year.id))
    ).scalars().all()
    exam_class_ids = {c.id for c in await exams_repository.list_exam_classes(db, exam.id)}

    items = [
        exams_schemas.ExamSubjectConfigItem(
            class_id=cs.class_id, subject_id=cs.subject_id, full_marks=cs.full_marks, pass_marks=33,
            question_window_opens_at=now - timedelta(days=1),
            question_deadline=now + timedelta(hours=6),
            marks_window_opens_at=now - timedelta(days=1),
            marks_deadline=now + timedelta(hours=12),
            sections=[
                exams_schemas.ExamSubjectSectionInput(name="MCQ", full_marks=10, pass_marks=4),
                exams_schemas.ExamSubjectSectionInput(name="CQ", full_marks=cs.full_marks - 10, pass_marks=29),
            ],
        )
        for cs in class_subject_rows
        if cs.class_id in exam_class_ids and cs.teacher_id is not None
    ]
    if not items:
        log(f"exam '{name}': no configurable class-subjects, skip")
        return exam

    try:
        await exams_service.configure_exam_subjects(
            db, principal, exam.id, exams_schemas.ConfigureExamSubjectsRequest(items=items)
        )
    except (ConflictException, ValidationException) as exc:
        log(f"exam '{name}' configuration skipped: {exc}")

    exam_subjects = await exams_repository.list_exam_subjects_for_exam(db, exam.id)
    log(f"exam '{name}': {len(exam_subjects)} subjects configured")

    for exam_subject, _exam, _class_entity, subject, _teacher, teacher_user in exam_subjects:
        teacher_actor = actor_for_user(teacher_user, "teacher")
        if exam_subject.question_submitted_at is None:
            try:
                questions = _questions_for(exam_subject.full_marks, subject.name)
                # Tag questions so they line up with the MCQ/CQ mark scheme.
                for item in questions:
                    item.section = "MCQ" if item.type == "mcq" else "CQ"
                await exams_service.submit_questions(
                    db, teacher_actor, exam_subject.id,
                    exams_schemas.SubmitQuestionsRequest(questions=questions),
                )
            except (ConflictException, ValidationException) as exc:
                log(f"  submit_questions skipped for {subject.name}: {exc}")
        try:
            await exams_service.approve_questions(db, principal, exam_subject.id)
        except (ConflictException, ValidationException):
            pass

    if not publish:
        log(f"exam '{name}' left at status '{(await exams_repository.get_exam(db, exam.id)).status.value}' (in progress)")
        return exam

    entered = 0
    for exam_subject, _exam, class_entity, subject, _teacher, teacher_user in exam_subjects:
        if exam_subject.marks_submitted_at is not None:
            continue
        roster = await results_repository.list_students_in_class(
            db, academic_year_id=year.id, class_id=class_entity.id
        )
        if not roster:
            continue
        mark_items = []
        for position, (student, _user, _enrollment, _section) in enumerate(roster):
            if position % 37 == 0:
                mark_items.append(results_schemas.MarkEntryItem(student_id=student.id, is_absent=True))
                continue
            # Roughly normal spread, with a genuine failing tail.
            pct = min(max(random.gauss(0.66, 0.16), 0.10), 0.99)
            mark_items.append(
                results_schemas.MarkEntryItem(
                    student_id=student.id, marks_obtained=round(exam_subject.full_marks * pct, 2)
                )
            )
        teacher_actor = actor_for_user(teacher_user, "teacher")
        try:
            await results_service.save_marks(
                db, teacher_actor, exam_subject.id, results_schemas.SaveMarksRequest(items=mark_items)
            )
            await results_service.submit_marks(db, teacher_actor, exam_subject.id)
            entered += len(mark_items)
        except (ConflictException, ValidationException) as exc:
            log(f"  marks entry skipped for {class_entity.name}/{subject.name}: {exc}")
    log(f"exam '{name}': {entered} marks entered")

    try:
        await results_service.compile_and_submit(db, principal, exam.id)
        await results_service.approve_results(db, principal, exam.id)
        await results_service.publish_results(db, principal, exam.id)
        log(f"exam '{name}' compiled, approved, and published")
    except (ConflictException, ValidationException) as exc:
        log(f"exam '{name}' publication stopped: {exc}")
    return exam


async def seed_exams(db, principal: CurrentUser, year, classes) -> list[tuple[Exam, date]]:
    plan = [
        ("First Term Examination 2026", "First Term", date(2026, 3, 9), date(2026, 3, 19), True),
        ("Half Yearly Examination 2026", "Half Yearly", date(2026, 4, 20), date(2026, 4, 30), True),
        ("Model Test 2026", "Model Test", date(2026, 6, 15), date(2026, 6, 24), True),
        ("Pre-Test Examination 2026", "Pre-Test", date(2026, 8, 24), date(2026, 9, 2), False),
    ]
    results = []
    for name, term, start_date, end_date, publish in plan:
        exam = await run_exam_pipeline(
            db, principal, year, classes,
            name=name, term=term, start_date=start_date, end_date=end_date, publish=publish,
        )
        results.append((exam, start_date if publish else None))
    return results


async def seed_omr_answer_keys(db, principal: CurrentUser, exams: list) -> None:
    """Answer keys are pure configuration and safe to seed; OMR batches/sheets
    are deliberately left alone because every sheet row requires a real scanned
    image in storage, which a seed script cannot fabricate honestly."""
    created = 0
    for exam, _exam_date in exams:
        subjects = await exams_repository.list_exam_subjects_for_exam(db, exam.id)
        for exam_subject, _exam, _class_entity, _subject, _teacher, _teacher_user in subjects[:6]:
            for set_code in ("Ka", "Kha"):
                existing = await omr_repository.get_answer_key_for_set(
                    db, exam_subject_id=exam_subject.id, set_code=set_code
                )
                if existing is not None:
                    continue
                answers = {
                    str(number): random.choice(["Ka", "Kha", "Ga", "Gha"]) for number in range(1, 11)
                }
                await omr_repository.create_answer_key(
                    db,
                    exam_subject_id=exam_subject.id, set_code=set_code, total_questions=10,
                    answers=answers, marks_per_correct=1.0, negative_marks=0.25, created_by=principal.id,
                )
                created += 1
        await db.commit()
    log(f"OMR answer keys created: {created}")


# ---------------------------------------------------------------------------
# 8. Billing: fee structures, monthly invoices, payments, discounts
# ---------------------------------------------------------------------------


async def seed_billing(db, principal: CurrentUser, accountant: CurrentUser, year, classes) -> None:
    fee_type_defs = [("Admission Fee", False), ("Session Fee", False), ("Monthly Tuition", True),
                     ("Sports Fee", False), ("Exam Fee", False), ("Library Fee", False)]
    fee_types: dict[str, FeeType] = {ft.name: ft for ft in (await db.execute(select(FeeType))).scalars()}
    for name, is_recurring in fee_type_defs:
        if name in fee_types:
            continue
        fee_types[name] = await billing_service.create_fee_type(
            db, principal, billing_schemas.CreateFeeTypeRequest(name=name, is_recurring=is_recurring)
        )
        log(f"created fee type {name}")

    ordered_classes = sorted(classes.values(), key=lambda c: c.numeric_order)
    for class_entity in ordered_classes:
        level = class_entity.numeric_order
        amounts = {
            "Admission Fee": 1000 + level * 100,
            "Session Fee": 800 + level * 50,
            "Monthly Tuition": 500 + level * 60,
            "Sports Fee": 200 + level * 10,
            "Exam Fee": 300 + level * 25,
            "Library Fee": 150,
        }
        await billing_service.set_fee_structure(
            db, principal,
            billing_schemas.SetFeeStructureRequest(
                academic_year_id=year.id, class_id=class_entity.id,
                items=[
                    billing_schemas.FeeStructureItemInput(fee_type_id=fee_types[name].id, amount=amount)
                    for name, amount in amounts.items()
                ],
            ),
        )
    log(f"fee structures set for {len(ordered_classes)} classes")

    monthly_ids = [fee_types["Monthly Tuition"].id, fee_types["Library Fee"].id]
    generated: list[tuple[uuid.UUID, date]] = []
    for month_start in month_starts(HISTORY_START, TODAY):
        due_date = date(month_start.year, month_start.month, 10)
        # Exam months carry the exam fee too, so invoice totals are not uniform.
        fee_type_ids = monthly_ids + ([fee_types["Exam Fee"].id] if month_start.month in (3, 4, 6) else [])
        for class_entity in ordered_classes:
            try:
                result = await billing_service.generate_invoices_for_class(
                    db, principal, class_entity.id,
                    billing_schemas.GenerateInvoiceRequest(
                        fee_type_ids=fee_type_ids, due_date=due_date, academic_year_id=year.id
                    ),
                )
            except (ValidationException, NotFoundException) as exc:
                log(f"invoice batch {month_start:%Y-%m} class {class_entity.name} skipped: {exc}")
                continue
            generated.extend((uuid.UUID(detail["id"]), due_date) for detail in result["created"])
        log(f"  invoices for {month_start:%B %Y}: {len(generated)} cumulative")
    log(f"invoices generated: {len(generated)}")

    discounts = 0
    payments = 0
    for position, (invoice_id, due_date) in enumerate(generated):
        invoice = await billing_repository.get_invoice(db, invoice_id)
        if invoice is None:
            continue
        if position % 23 == 0:
            try:
                await billing_service.add_discount(
                    db, principal, invoice_id,
                    billing_schemas.AddDiscountRequest(
                        discount_type=DiscountType.percentage if position % 2 else DiscountType.flat,
                        value=10 if position % 2 else 200,
                        reason=random.choice(["Sibling discount", "Merit scholarship", "Hardship waiver"]),
                    ),
                )
                discounts += 1
                invoice = await billing_repository.get_invoice(db, invoice_id)
            except (ConflictException, ValidationException):
                pass

        due_amount = float(invoice.due_amount)
        if due_amount <= 0:
            continue
        # Older invoices are mostly settled; the newest month still has real dues.
        months_old = (TODAY.year - due_date.year) * 12 + (TODAY.month - due_date.month)
        roll = random.random()
        if months_old >= 2:
            share = 1.0 if roll < 0.88 else (0.5 if roll < 0.96 else 0.0)
        elif months_old == 1:
            share = 1.0 if roll < 0.70 else (0.5 if roll < 0.85 else 0.0)
        else:
            share = 1.0 if roll < 0.35 else (0.5 if roll < 0.55 else 0.0)
        if share <= 0:
            continue

        amount = round(due_amount * share, 2)
        try:
            await billing_service.record_payment(
                db, accountant, invoice_id,
                billing_schemas.RecordPaymentRequest(
                    amount=amount,
                    method=random.choice(list(PaymentMethod)),
                    transaction_reference=f"TXN{random.randint(10**8, 10**9 - 1)}",
                ),
            )
            payments += 1
        except (ConflictException, ValidationException):
            continue
        if payments and payments % 250 == 0:
            log(f"  ... {payments} payments recorded")
    log(f"billing: {discounts} discounts, {payments} payments recorded")


# ---------------------------------------------------------------------------
# 9. Payroll: salary structures + a run per historical month
# ---------------------------------------------------------------------------


async def backfill_payslips(db, run_id: uuid.UUID, month_start: date) -> int:
    """Add payslips to an existing run for every active employee that is
    missing one, mirroring `generate_payroll_run`'s own gross/net arithmetic."""
    period_end = date(
        month_start.year, month_start.month, calendar.monthrange(month_start.year, month_start.month)[1]
    )
    existing = await payroll_repository.list_payslips_for_run(db, run_id)
    covered_teachers = {p.teacher_id for p in existing if p.teacher_id is not None}
    covered_staff = {p.staff_id for p in existing if p.staff_id is not None}

    employees: list[tuple[uuid.UUID | None, uuid.UUID | None]] = [
        (teacher.id, None) for teacher, _user in await payroll_repository.list_active_teachers(db)
        if teacher.id not in covered_teachers
    ] + [
        (None, member.id) for member, _user, _role in await payroll_repository.list_active_staff(db)
        if member.id not in covered_staff
    ]

    added = 0
    for teacher_id, staff_id in employees:
        structure = await payroll_repository.get_current_salary_structure(
            db, teacher_id=teacher_id, staff_id=staff_id, as_of=period_end
        )
        if structure is None:
            continue
        gross = round(float(structure.basic_salary) + float(structure.allowances), 2)
        deductions = round(float(structure.deductions), 2)
        await payroll_repository.create_payslip(
            db, payroll_run_id=run_id, teacher_id=teacher_id, staff_id=staff_id,
            gross_amount=gross, deductions=deductions, net_amount=round(gross - deductions, 2),
        )
        added += 1
    if added:
        await db.commit()
    return added


async def seed_payroll(db, principal: CurrentUser) -> None:
    teachers = await payroll_repository.list_active_teachers(db)
    staff = await payroll_repository.list_active_staff(db)
    effective_from = date(2026, 1, 1)

    created = 0
    for teacher, _user in teachers:
        if await payroll_repository.get_current_salary_structure(
            db, teacher_id=teacher.id, staff_id=None, as_of=effective_from
        ) is not None:
            continue
        await payroll_service.create_salary_structure(
            db, principal,
            payroll_schemas.SetSalaryStructureRequest(
                teacher_id=teacher.id,
                basic_salary=float(random.randrange(28000, 52000, 1000)),
                allowances=float(random.randrange(3000, 9000, 500)),
                deductions=float(random.randrange(500, 2500, 250)),
                effective_from=effective_from,
            ),
        )
        created += 1
    for member, _user, _role_name in staff:
        if await payroll_repository.get_current_salary_structure(
            db, teacher_id=None, staff_id=member.id, as_of=effective_from
        ) is not None:
            continue
        await payroll_service.create_salary_structure(
            db, principal,
            payroll_schemas.SetSalaryStructureRequest(
                staff_id=member.id,
                basic_salary=float(random.randrange(18000, 34000, 1000)),
                allowances=float(random.randrange(1500, 5000, 500)),
                deductions=float(random.randrange(300, 1500, 100)),
                effective_from=effective_from,
            ),
        )
        created += 1
    log(f"salary structures created: {created}")

    for month_start in month_starts(HISTORY_START, TODAY):
        existing = await payroll_repository.get_payroll_run_by_period(db, month_start.month, month_start.year)
        if existing is not None:
            run_id = existing.id
            # A run left over from earlier manual testing covers only the
            # handful of employees who existed then. `generate_payroll_run`
            # refuses to touch an existing period, so top it up directly --
            # otherwise the month shows 2 payslips against 39 employees.
            added = await backfill_payslips(db, run_id, month_start)
            if added:
                log(f"topped up payroll run {month_start:%B %Y} with {added} missing payslips")
        else:
            try:
                result = await payroll_service.generate_payroll_run(
                    db, principal,
                    payroll_schemas.GeneratePayrollRunRequest(
                        period_month=month_start.month, period_year=month_start.year
                    ),
                )
            except (ConflictException, ValidationException) as exc:
                log(f"payroll run {month_start:%Y-%m} skipped: {exc}")
                continue
            run_id = uuid.UUID(result["id"])
            log(f"generated payroll run {month_start:%B %Y} with {result['payslip_count']} payslips")

        # The current month is still being processed; earlier months are paid.
        if month_start.month == TODAY.month and month_start.year == TODAY.year:
            continue
        for payslip in await payroll_repository.list_payslips_for_run(db, run_id):
            if payslip.status.value == "paid":
                continue
            try:
                await payroll_service.mark_payslip_paid(db, principal, payslip.id)
            except (ConflictException, ValidationException):
                continue


# ---------------------------------------------------------------------------
# 10. Expenses
# ---------------------------------------------------------------------------


async def seed_expenses(db, principal: CurrentUser, accountant: CurrentUser) -> None:
    category_defs = ["Utilities", "Maintenance", "Office Supplies", "Transport", "Events", "IT & Software"]
    categories: dict[str, uuid.UUID] = {c.name: c.id for c in (await db.execute(select(ExpenseCategory))).scalars()}
    for name in category_defs:
        if name in categories:
            continue
        entity = await expenses_service.create_expense_category(
            db, principal, expenses_schemas.CreateExpenseCategoryRequest(name=name)
        )
        categories[name] = uuid.UUID(entity["id"])
        log(f"created expense category {name}")

    templates = {
        "Utilities": [("Monthly electricity bill", 8000, 22000), ("Water and sewerage bill", 2000, 5000),
                      ("Internet and broadband", 3500, 6000)],
        "Maintenance": [("Classroom furniture repair", 2500, 12000), ("Generator servicing", 5000, 15000),
                        ("Building paint touch-up", 8000, 30000)],
        "Office Supplies": [("Stationery restock", 1500, 6000), ("Printer toner and paper", 3000, 9000)],
        "Transport": [("School bus fuel", 12000, 28000), ("Bus maintenance", 5000, 20000)],
        "Events": [("Annual sports day arrangements", 15000, 45000), ("Science fair materials", 6000, 18000)],
        "IT & Software": [("Computer lab licences", 10000, 30000), ("CCTV maintenance contract", 7000, 16000)],
    }

    existing_rows, _total = await expenses_repository.list_expenses(
        db, status=None, category_id=None, requested_by=None, offset=0, limit=1000
    )
    existing_keys = {(e.description, e.expense_date) for e, *_rest in existing_rows}

    created = 0
    for month_start in month_starts(HISTORY_START, TODAY):
        for category_name, entries in templates.items():
            label, low, high = random.choice(entries)
            expense_date = date(
                month_start.year, month_start.month,
                min(random.randint(2, 26), 28 if TODAY.month != month_start.month else max(TODAY.day - 1, 2)),
            )
            description = f"{label} — {month_start:%B %Y}"
            if (description, expense_date) in existing_keys:
                continue
            result = await expenses_service.create_expense(
                db, accountant,
                expenses_schemas.CreateExpenseRequest(
                    category_id=categories[category_name],
                    amount=float(random.randrange(low, high, 100)),
                    description=description,
                    expense_date=expense_date,
                ),
            )
            created += 1
            expense_id = uuid.UUID(result["id"])
            roll = random.random()
            is_current_month = month_start.month == TODAY.month and month_start.year == TODAY.year
            try:
                if is_current_month and roll < 0.5:
                    continue  # still pending
                if roll < 0.85:
                    await expenses_service.approve_expense(db, principal, expense_id)
                elif roll < 0.95:
                    await expenses_service.reject_expense(db, principal, expense_id)
            except (ConflictException, ValidationException):
                continue
    log(f"expenses created: {created}")


# ---------------------------------------------------------------------------
# 11. Assets
# ---------------------------------------------------------------------------


async def seed_assets(db, principal: CurrentUser, rooms) -> None:
    room_pool = sorted(rooms.values(), key=lambda r: r.name)
    category_defs = ["Furniture", "Electronics", "Sports Equipment", "Laboratory", "Library"]
    categories: dict[str, uuid.UUID] = {c.name: c.id for c in (await db.execute(select(AssetCategory))).scalars()}
    for name in category_defs:
        if name in categories:
            continue
        entity = await assets_service.create_asset_category(
            db, principal, assets_schemas.CreateAssetCategoryRequest(name=name)
        )
        categories[name] = uuid.UUID(entity["id"])
        log(f"created asset category {name}")

    asset_defs = [
        ("Student Bench", "Furniture", 120, 900.0), ("Teacher Desk", "Furniture", 24, 4500.0),
        ("Whiteboard", "Furniture", 18, 3200.0), ("Almirah", "Furniture", 12, 8500.0),
        ("Projector", "Electronics", 6, 42000.0), ("Desktop Computer", "Electronics", 30, 38000.0),
        ("Ceiling Fan", "Electronics", 60, 3500.0), ("Sound System", "Electronics", 2, 25000.0),
        ("Football", "Sports Equipment", 20, 1200.0), ("Cricket Kit", "Sports Equipment", 6, 9500.0),
        ("Carrom Board", "Sports Equipment", 8, 3000.0),
        ("Microscope", "Laboratory", 15, 12000.0), ("Bunsen Burner", "Laboratory", 20, 1800.0),
        ("Chemistry Glassware Set", "Laboratory", 25, 2500.0),
        ("Bookshelf", "Library", 14, 6500.0), ("Reference Book Set", "Library", 200, 450.0),
    ]
    existing_assets: dict[str, Asset] = {a.name: a for a in (await db.execute(select(Asset))).scalars()}

    created = 0
    for position, (name, category_name, quantity, value) in enumerate(asset_defs):
        if name in existing_assets:
            continue
        result = await assets_service.create_asset(
            db, principal,
            assets_schemas.CreateAssetRequest(
                category_id=categories[category_name], name=name,
                room_id=room_pool[position % len(room_pool)].id,
                quantity=quantity,
                condition=random.choice([AssetCondition.new, AssetCondition.good, AssetCondition.good, AssetCondition.fair]),
                purchase_date=date(2026, 1, 1) - timedelta(days=random.randint(30, 900)),
                purchase_value=value,
            ),
        )
        created += 1
        # Half get a follow-up change so asset_logs reflects real movement.
        if position % 2 == 0:
            asset_id = uuid.UUID(result["id"])
            await assets_service.update_asset(
                db, principal, asset_id,
                assets_schemas.UpdateAssetRequest(
                    quantity=max(quantity - random.randint(1, 4), 0),
                    condition=random.choice([AssetCondition.fair, AssetCondition.damaged]),
                    room_id=room_pool[(position + 3) % len(room_pool)].id,
                ),
            )
    log(f"assets created: {created}")


# ---------------------------------------------------------------------------
# 12. Communication
# ---------------------------------------------------------------------------


async def seed_communication(db, principal: CurrentUser, sections) -> list[tuple[uuid.UUID, date]]:
    defs = [
        (date(2026, 3, 2), "New term begins", "Classes for the new term resume today. Please check the updated routine on the portal.", AudienceType.all, None, False, None),
        (date(2026, 3, 5), "First Term Examination routine published", "The First Term Examination runs 9-19 March. Admit cards are available from the office.", AudienceType.students, None, True, "First Term exams: 9-19 March. Collect admit cards."),
        (date(2026, 3, 20), "Question paper submission deadline", "All subject teachers must submit question papers 5 working days before each exam.", AudienceType.teachers, None, False, None),
        (date(2026, 4, 1), "April tuition due 10 April", "Please clear the April tuition invoice by 10 April to avoid a late mark on the account.", AudienceType.guardians, None, True, "April tuition due 10 April."),
        (date(2026, 4, 18), "Half Yearly Examination schedule", "The Half Yearly Examination runs 20-30 April across all classes.", AudienceType.all, None, False, None),
        (date(2026, 5, 6), "First Term results published", "First Term results are now available on each student's result card.", AudienceType.all, None, True, "First Term results published."),
        (date(2026, 5, 20), "Staff meeting Thursday 3pm", "All teaching staff please attend the monthly review meeting in the staff room.", AudienceType.teachers, None, False, None),
        (date(2026, 6, 10), "Model Test starts 15 June", "The Model Test begins 15 June. Revision classes run in the last period all week.", AudienceType.students, None, False, None),
        (date(2026, 6, 28), "Support staff duty roster updated", "The revised duty roster for July is posted on the notice board.", AudienceType.staff, None, False, None),
        (date(2026, 7, 8), "Parent-teacher conference 18 July", "Guardians are invited to meet subject teachers on 18 July between 10am and 2pm.", AudienceType.guardians, None, True, "Parent-teacher conference 18 July, 10am-2pm."),
        (date(2026, 7, 22), "Library books return notice", "All borrowed library books must be returned before the end of the month.", AudienceType.students, None, False, None),
        (date(2026, 8, 3), "Pre-Test Examination from 24 August", "The Pre-Test Examination begins 24 August. The detailed routine follows next week.", AudienceType.all, None, False, None),
    ]
    if sections:
        defs.append(
            (date(2026, 4, 9), f"Section {sections[0].name} field trip permission slip",
             "Please return the signed permission slip for the museum field trip by Thursday.",
             AudienceType.specific_class, sections[0].id, False, None)
        )

    existing_titles = {row[0] for row in (await db.execute(text("SELECT title FROM announcements"))).all()}
    created: list[tuple[uuid.UUID, date]] = []
    for published_on, title, body, audience, section_id, send_sms, sms_message in defs:
        if title in existing_titles:
            continue
        response = await communication_service.create_announcement(
            db, principal,
            communication_schemas.CreateAnnouncementRequest(
                title=title, body=body, audience_type=audience, section_id=section_id,
                send_sms=send_sms, sms_message=sms_message,
            ),
        )
        created.append((uuid.UUID(response["id"]), published_on))
        log(f"created announcement: {title}")

    # A realistic partial read-through: about half the audience opens each notice.
    read_marks = 0
    for announcement_id, _published_on in created[:3]:
        recipients = (
            await db.execute(
                text(
                    "SELECT ar.user_id, r.name FROM announcement_recipients ar "
                    "JOIN users u ON u.id = ar.user_id JOIN roles r ON r.id = u.role_id "
                    "WHERE ar.announcement_id = :aid AND ar.read_at IS NULL "
                    "ORDER BY random() LIMIT 120"
                ),
                {"aid": str(announcement_id)},
            )
        ).all()
        for user_id, role_name in recipients:
            user = await _one(db, User, id=user_id)
            if user is None:
                continue
            try:
                await communication_service.mark_announcement_read(db, actor_for_user(user, role_name), announcement_id)
                read_marks += 1
            except (ConflictException, NotFoundException, PermissionDeniedException):
                continue
    log(f"announcement read receipts: {read_marks}")
    return created


# ---------------------------------------------------------------------------
# 13. Backdating pass
# ---------------------------------------------------------------------------

BACKDATE_STATEMENTS = [
    # Invoices are raised ~3 weeks before their due date.
    (
        "invoices",
        "UPDATE invoices SET created_at = (due_date - INTERVAL '21 days')::timestamptz + TIME '10:15', "
        "updated_at = (due_date - INTERVAL '21 days')::timestamptz + TIME '10:15' "
        "WHERE created_at::date > due_date",
    ),
    (
        "invoice payments",
        "UPDATE payments p SET "
        "  paid_at    = LEAST(i.created_at + (random() * INTERVAL '25 days') + INTERVAL '2 days', now()), "
        "  created_at = LEAST(i.created_at + (random() * INTERVAL '25 days') + INTERVAL '2 days', now()) "
        "FROM invoices i WHERE i.id = p.invoice_id AND p.paid_at > now() - INTERVAL '1 day'",
    ),
    (
        "invoice discounts",
        "UPDATE discounts d SET created_at = i.created_at + INTERVAL '1 day' "
        "FROM invoices i WHERE i.id = d.invoice_id AND d.created_at > now() - INTERVAL '1 day'",
    ),
    # Exam workflow: deadlines and submission stamps land inside the exam window.
    (
        "exam subjects",
        "UPDATE exam_subjects es SET "
        "  question_window_opens_at = (e.start_date - INTERVAL '30 days')::timestamptz + TIME '09:00', "
        "  question_deadline       = (e.start_date - INTERVAL '10 days')::timestamptz + TIME '17:00', "
        # Deadlines and window openings may legitimately sit in the future for an
        # upcoming exam; a *submitted*/*reviewed* stamp records something that has
        # already happened, so those are clamped to now.
        "  question_submitted_at   = CASE WHEN es.question_submitted_at IS NULL THEN NULL "
        "                                 ELSE LEAST((e.start_date - INTERVAL '14 days')::timestamptz + TIME '12:30', now()) END, "
        "  question_reviewed_at    = CASE WHEN es.question_reviewed_at IS NULL THEN NULL "
        "                                 ELSE LEAST((e.start_date - INTERVAL '12 days')::timestamptz + TIME '11:00', now()) END, "
        "  marks_window_opens_at   = e.end_date::timestamptz + TIME '09:00', "
        "  marks_deadline          = (e.end_date + INTERVAL '10 days')::timestamptz + TIME '17:00', "
        "  marks_submitted_at      = CASE WHEN es.marks_submitted_at IS NULL THEN NULL "
        "                                 ELSE LEAST((e.end_date + INTERVAL '6 days')::timestamptz + TIME '15:45', now()) END, "
        "  created_at              = (e.start_date - INTERVAL '32 days')::timestamptz + TIME '09:00', "
        "  updated_at              = (e.end_date + INTERVAL '6 days')::timestamptz + TIME '15:45' "
        "FROM exams e WHERE e.id = es.exam_id AND es.created_at > now() - INTERVAL '1 day'",
    ),
    (
        "exams",
        "UPDATE exams SET created_at = (start_date - INTERVAL '35 days')::timestamptz + TIME '09:00', "
        "updated_at = (end_date + INTERVAL '12 days')::timestamptz + TIME '10:00' "
        "WHERE created_at > now() - INTERVAL '1 day'",
    ),
    (
        "exam results",
        "UPDATE exam_results er SET "
        "  entered_at = LEAST((e.end_date + INTERVAL '5 days')::timestamptz + TIME '14:20', now()), "
        "  created_at = LEAST((e.end_date + INTERVAL '5 days')::timestamptz + TIME '14:20', now()), "
        "  updated_at = LEAST((e.end_date + INTERVAL '12 days')::timestamptz + TIME '10:00', now()) "
        "FROM exam_subjects es JOIN exams e ON e.id = es.exam_id "
        "WHERE es.id = er.exam_subject_id AND er.created_at > now() - INTERVAL '1 day'",
    ),
    (
        "result publications",
        "UPDATE result_publications rp SET "
        "  created_at = LEAST((e.end_date + INTERVAL '9 days')::timestamptz + TIME '09:30', now()), "
        "  approved_at = CASE WHEN rp.approved_at IS NULL THEN NULL "
        "                     ELSE LEAST((e.end_date + INTERVAL '11 days')::timestamptz + TIME '11:15', now()) END, "
        "  published_at = CASE WHEN rp.published_at IS NULL THEN NULL "
        "                      ELSE LEAST((e.end_date + INTERVAL '12 days')::timestamptz + TIME '10:00', now()) END, "
        "  updated_at = LEAST((e.end_date + INTERVAL '12 days')::timestamptz + TIME '10:00', now()) "
        "FROM exams e WHERE e.id = rp.exam_id AND rp.created_at > now() - INTERVAL '1 day'",
    ),
    (
        "omr answer keys",
        # An upcoming exam's key is written before the exam, not 8 days before a
        # date that has not arrived yet -- clamp so the stamp never lands in the
        # future (which would also make this statement rewrite the same rows on
        # every re-run).
        "UPDATE omr_answer_keys k SET "
        "  created_at = LEAST((e.start_date - INTERVAL '8 days')::timestamptz + TIME '16:00', now()), "
        "  updated_at = LEAST((e.start_date - INTERVAL '8 days')::timestamptz + TIME '16:00', now()) "
        "FROM exam_subjects es JOIN exams e ON e.id = es.exam_id "
        "WHERE es.id = k.exam_subject_id AND k.created_at > now() - INTERVAL '1 day'",
    ),
    # Payroll is generated at month end and paid in the first week after.
    (
        "payroll runs",
        "UPDATE payroll_runs SET "
        "created_at = make_timestamptz(period_year, period_month, 28, 17, 0, 0), "
        "updated_at = make_timestamptz(period_year, period_month, 28, 17, 0, 0) "
        "WHERE created_at > now() - INTERVAL '1 day'",
    ),
    (
        "payslips",
        "UPDATE payslips p SET created_at = r.created_at, updated_at = r.created_at + INTERVAL '4 days', "
        "paid_at = CASE WHEN p.paid_at IS NULL THEN NULL ELSE r.created_at + INTERVAL '4 days' END "
        "FROM payroll_runs r WHERE r.id = p.payroll_run_id AND p.created_at > now() - INTERVAL '1 day'",
    ),
    (
        "expenses",
        "UPDATE expenses SET created_at = expense_date::timestamptz + TIME '11:00', "
        "updated_at = (expense_date + INTERVAL '2 days')::timestamptz + TIME '15:00', "
        "approved_at = CASE WHEN approved_at IS NULL THEN NULL "
        "                   ELSE (expense_date + INTERVAL '2 days')::timestamptz + TIME '15:00' END "
        "WHERE created_at > now() - INTERVAL '1 day'",
    ),
    (
        "assets",
        "UPDATE assets SET created_at = COALESCE(purchase_date::timestamptz + TIME '10:00', created_at), "
        "updated_at = COALESCE(purchase_date::timestamptz + TIME '10:00', updated_at) "
        "WHERE created_at > now() - INTERVAL '1 day' AND purchase_date IS NOT NULL",
    ),
    (
        "asset logs",
        "UPDATE asset_logs l SET created_at = a.created_at + INTERVAL '60 days' "
        "FROM assets a WHERE a.id = l.asset_id AND l.created_at > now() - INTERVAL '1 day'",
    ),
]


async def backdate_history(db, announcements: list[tuple[uuid.UUID, date]]) -> None:
    """The service layer intentionally stamps "now" on everything it writes.
    That is correct for the app and wrong for a history seed, so the rows this
    run created are rewritten here to the dates the workflow represents.
    Each statement is scoped to rows written in the last day so re-runs never
    shift previously seeded history."""
    for label, statement in BACKDATE_STATEMENTS:
        result = await db.execute(text(statement))
        await db.commit()
        log(f"backdated {label}: {result.rowcount} rows")

    for announcement_id, published_on in announcements:
        stamp = datetime(published_on.year, published_on.month, published_on.day, 9, 30, tzinfo=timezone.utc)
        await db.execute(
            text(
                "UPDATE announcements SET published_at = :stamp, created_at = :stamp, updated_at = :stamp "
                "WHERE id = :aid"
            ),
            {"stamp": stamp, "aid": str(announcement_id)},
        )
        await db.execute(
            text(
                "UPDATE announcement_recipients SET read_at = :stamp + (random() * INTERVAL '3 days') "
                "WHERE announcement_id = :aid AND read_at IS NOT NULL"
            ),
            {"stamp": stamp, "aid": str(announcement_id)},
        )
        await db.execute(
            text("UPDATE sms_logs SET created_at = :stamp WHERE related_entity_id = :aid"),
            {"stamp": stamp, "aid": str(announcement_id)},
        )
    await db.commit()
    if announcements:
        log(f"backdated {len(announcements)} announcements and their recipients/SMS logs")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

TABLES = [
    "roles", "permissions", "role_permissions", "users",
    "academic_years", "classes", "rooms", "subjects", "sections", "class_subjects", "student_enrollments",
    "students", "student_guardians", "guardians", "teachers", "teacher_qualifications", "staff", "staff_qualifications",
    "routine_slots", "biometric_devices", "attendance_punches", "daily_attendance", "class_attendance",
    "exams", "exam_classes", "exam_subjects", "exam_subject_sections", "exam_results", "result_publications",
    "omr_answer_keys", "omr_batches", "omr_sheets",
    "fee_types", "class_fee_structures", "invoices", "invoice_items", "discounts", "payments",
    "salary_structures", "payroll_runs", "payslips", "expense_categories", "expenses",
    "asset_categories", "assets", "asset_logs", "announcements", "announcement_recipients", "sms_logs",
    "audit_logs",
]


async def print_summary(db) -> None:
    log("=" * 62)
    log("Row counts after seeding:")
    for table in TABLES:
        result = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
        log(f"  {table:28s} {result.scalar_one()}")
    log("=" * 62)
    log(f"Login with any seeded account and the password: {SEED_PASSWORD}")
    log("  e.g. student1@gmail.com / teacher1@gmail.com / admin1@gmail.com")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

# Every stage is independently re-runnable and skips what already exists, so a
# stage can be run on its own (`python scripts/seed_bulk_data.py billing`) and
# an interrupted run is resumed simply by running it again. Stages that need
# structure the earlier ones build re-derive it from the database rather than
# from in-memory state, which is what makes that possible.
STAGES = ["people", "routine", "attendance", "exams", "finance", "operations", "backdate", "summary"]


async def run_stages(db, stages: list[str]) -> None:
    principal = await actor_from_email(db, "principal@codexedumine.test", "principal")

    year = await academic_repository.get_active_academic_year(db)
    assert year is not None, "No active academic year — activate one before seeding"
    log(f"active academic year: {year.name} ({year.start_date} -> {year.end_date})")

    rooms, subjects, classes = await seed_reference_data(db, principal)

    if "people" in stages:
        teachers = await seed_teachers(db, principal)
        await seed_staff_accounts(db, principal)
        _sections, intake_sections = await seed_sections(db, principal, year, classes, rooms, teachers)
        await seed_class_subjects(db, principal, year, classes, subjects, teachers)
        await seed_students(db, principal, intake_sections)
        await seed_guardians(db, principal)
        await apply_seed_password(db)

    # Re-derived every run so each stage stands alone.
    teachers = list(
        (
            await db.execute(
                select(Teacher, User)
                .join(User, User.id == Teacher.user_id)
                .where(Teacher.deleted_at.is_(None), User.is_active.is_(True))
                .order_by(Teacher.employee_code.asc())
            )
        ).all()
    )
    sections, _intake = await seed_sections(db, principal, year, classes, rooms, teachers)
    class_subjects = await seed_class_subjects(db, principal, year, classes, subjects, teachers)

    if "routine" in stages:
        await seed_routine(db, principal, year, sections, class_subjects, rooms)

    if "attendance" in stages:
        slots = await routine_repository.list_slots(
            db, academic_year_id=year.id, section_id=None, teacher_id=None, day_of_week=None
        )
        await seed_attendance(db, principal, year, slots)

    if "exams" in stages:
        exams = await seed_exams(db, principal, year, classes)
        await seed_omr_answer_keys(db, principal, exams)

    if "finance" in stages:
        accountant = await actor_from_email(db, "accountant1@gmail.com", "accountant")
        await seed_billing(db, principal, accountant, year, classes)
        await seed_payroll(db, principal)

    announcements: list[tuple[uuid.UUID, date]] = []
    if "operations" in stages:
        accountant = await actor_from_email(db, "accountant1@gmail.com", "accountant")
        await seed_expenses(db, principal, accountant)
        await seed_assets(db, principal, rooms)
        announcements = await seed_communication(db, principal, sections)

    if "backdate" in stages:
        await backdate_history(db, announcements)

    if "summary" in stages:
        await print_summary(db)


async def main(stages: list[str]) -> None:
    started = datetime.now()
    log(f"running stages: {', '.join(stages)}")
    async for db in get_db():
        await run_stages(db, stages)
        break
    log(f"Done in {(datetime.now() - started).total_seconds() / 60:.1f} minutes.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    requested = [arg for arg in sys.argv[1:] if not arg.startswith("-")] or STAGES
    unknown = [stage for stage in requested if stage not in STAGES]
    if unknown:
        raise SystemExit(f"Unknown stage(s): {', '.join(unknown)}. Valid stages: {', '.join(STAGES)}")
    asyncio.run(main(requested))
