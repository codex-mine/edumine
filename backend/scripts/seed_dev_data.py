"""Comprehensive dev-data seed script for Codex Edumine.

Populates every module's tables with realistic, interconnected data by calling
the app's own service-layer functions (not raw SQL), so every computed field,
invariant, and audit-log entry stays correct -- the same pattern already
proven for one-off fixes like `billing_service.record_payment`.

Idempotent: safe to re-run. Every section checks for existing rows (by name,
email, or a domain uniqueness rule the service layer already enforces) before
creating, and skips with a log line rather than erroring on duplicates.

Run from the backend/ directory:
    ./.venv/Scripts/python.exe scripts/seed_dev_data.py
"""

import asyncio
import random
import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select, text

from app.common.dependencies import CurrentUser
from app.common.enums import (
    ApprovalStatus,
    AssetCondition,
    AttendanceStatus,
    AudienceType,
    DiscountType,
    PaymentMethod,
    Weekday,
)
from app.core.exceptions import ConflictException, NotFoundException, PermissionDeniedException, ValidationException
from app.db.session import get_db

from app.modules.academic import repository as academic_repository
from app.modules.academic import schemas as academic_schemas
from app.modules.academic import service as academic_service
from app.modules.academic.models import Class, ClassSubject, Room, Section, Subject

from app.modules.auth import repository as auth_repository
from app.modules.auth.models import Role, User

from app.modules.students import repository as students_repository
from app.modules.students import schemas as students_schemas
from app.modules.students import service as students_service
from app.modules.students.models import Student, StudentGuardian

from app.modules.teachers import repository as teachers_repository
from app.modules.teachers import schemas as teachers_schemas
from app.modules.teachers import service as teachers_service
from app.modules.teachers.models import Teacher

from app.modules.guardians import repository as guardians_repository
from app.modules.guardians import schemas as guardians_schemas
from app.modules.guardians import service as guardians_service

from app.modules.users import repository as users_repository
from app.modules.users import schemas as users_schemas
from app.modules.users import service as users_service
from app.modules.users.models import Staff

from app.modules.routine import repository as routine_repository
from app.modules.routine import schemas as routine_schemas
from app.modules.routine import service as routine_service

from app.modules.attendance import repository as attendance_repository
from app.modules.attendance import schemas as attendance_schemas
from app.modules.attendance import service as attendance_service

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
from app.modules.billing.models import FeeType, Invoice

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

from app.modules.communication import repository as communication_repository
from app.modules.communication import schemas as communication_schemas
from app.modules.communication import service as communication_service

random.seed(42)


def log(msg: str) -> None:
    print(f"[seed] {msg}")


async def _one(db, model, **filters):
    conditions = [getattr(model, key) == value for key, value in filters.items()]
    result = await db.execute(select(model).where(*conditions))
    return result.scalar_one_or_none()


async def actor_from_email(db, email: str, role_name: str) -> CurrentUser:
    user = await auth_repository.get_user_by_email(db, email)
    assert user is not None, f"expected seed user with email {email} to already exist"
    return CurrentUser(id=user.id, full_name=user.full_name, phone=user.phone, email=user.email, role=role_name, permissions=frozenset())


# ---------------------------------------------------------------------------
# 1. Academic structure: extra class_subjects so every class has multiple
#    examinable subjects, and every teacher is assigned somewhere.
# ---------------------------------------------------------------------------


async def seed_academic(db, principal: CurrentUser):
    year = await academic_repository.get_active_academic_year(db)
    assert year is not None, "No active academic year -- run Phase 5 setup first"

    classes = {c.name: c for c in (await db.execute(select(Class))).scalars()}
    subjects = {s.name: s for s in (await db.execute(select(Subject).where(Subject.deleted_at.is_(None)))).scalars()}
    teachers_by_email = {
        u.email: (t, u)
        for t, u in (await db.execute(select(Teacher, User).join(User, User.id == Teacher.user_id))).all()
    }

    # "Mathematics"/"Science" already exist in this DB but are soft-deleted leftovers
    # from earlier manual testing -- create fresh, active subjects instead of reusing them.
    for name, code in (("Bangla", "BAN"), ("Physical Education", "PE")):
        if name in subjects:
            continue
        entity = await academic_service.create_subject(db, principal, academic_schemas.CreateSubjectRequest(name=name, code=code))
        subjects[name] = entity
        log(f"created subject {name}")

    # "Second Teacher" (second.teacher@codexedumine.test) is also a soft-deleted
    # leftover -- onboard a fresh third teacher instead of reusing that account.
    nasrin_email = "nasrin.akter@codexedumine.test"
    if nasrin_email not in teachers_by_email:
        teacher, user, _password = await teachers_service.create_teacher(
            db, principal,
            teachers_schemas.CreateTeacherRequest(
                full_name="Nasrin Akter", email=nasrin_email, phone="01711000020", date_of_birth=date(1990, 3, 12),
                joining_date=date.today() - timedelta(days=180), designation="Assistant Teacher",
            ),
        )
        teachers_by_email[nasrin_email] = (teacher, user)
        log("created teacher Nasrin Akter")

    class3, class8 = classes["3"], classes["8"]
    bangla, phys_ed = subjects["Bangla"], subjects["Physical Education"]
    second_teacher = teachers_by_email[nasrin_email][0]
    sulthana = teachers_by_email["mahmudulmk121212@gmail.com"][0]

    assignments = [
        (class3, bangla, second_teacher),
        (class3, phys_ed, sulthana),
        (class8, phys_ed, second_teacher),
    ]
    for class_entity, subject, teacher in assignments:
        existing = await _one(db, ClassSubject, academic_year_id=year.id, class_id=class_entity.id, subject_id=subject.id)
        if existing is not None:
            log(f"class_subject {class_entity.name}/{subject.name} already exists, skip")
            continue
        try:
            await academic_service.create_class_subject(
                db, principal,
                academic_schemas.CreateClassSubjectRequest(
                    academic_year_id=year.id, class_id=class_entity.id, subject_id=subject.id,
                    teacher_id=teacher.id, full_marks=100,
                ),
            )
            log(f"created class_subject {class_entity.name}/{subject.name}")
        except (ConflictException, ValidationException) as exc:
            log(f"class_subject {class_entity.name}/{subject.name} skipped: {exc}")

    return year, classes, subjects, teachers_by_email


# ---------------------------------------------------------------------------
# 2. Enroll every active (non-pending) student who currently has no
#    enrollment for the active year, rotating across the existing sections.
# ---------------------------------------------------------------------------


async def seed_enrollments(db, principal: CurrentUser, year, classes):
    sections = {
        s.name: s
        for s in (
            await db.execute(select(Section).where(Section.academic_year_id == year.id, Section.deleted_at.is_(None)))
        ).scalars()
    }
    # "Meghna" (class 3) is a soft-deleted leftover from earlier manual testing --
    # give class 3 a second active section back so both classes have >=2 sections.
    if "Surma" not in sections:
        room = await _one(db, Room, name="Room 202")
        section = await academic_service.create_section(
            db, principal,
            academic_schemas.CreateSectionRequest(academic_year_id=year.id, class_id=classes["3"].id, room_id=room.id if room else None, name="Surma"),
        )
        sections["Surma"] = section
        log("created section Surma (class 3)")

    rotation = list(sections.keys())

    result = await db.execute(
        select(Student, User)
        .join(User, User.id == Student.user_id)
        .where(Student.deleted_at.is_(None), User.is_active.is_(True))
        .order_by(Student.admission_number.asc())
    )
    idx = 0
    for student, user in result.all():
        existing = await academic_repository.get_enrollment_for_student_year(db, student_id=student.id, academic_year_id=year.id)
        if existing is not None:
            continue
        section = sections[rotation[idx % len(rotation)]]
        idx += 1
        try:
            await academic_service.enroll_student(
                db, principal,
                academic_schemas.EnrollStudentRequest(
                    student_id=student.id, academic_year_id=year.id, section_id=section.id, roll_number=None
                ),
            )
            log(f"enrolled {user.full_name} into section {section.name}")
        except (ConflictException, ValidationException) as exc:
            log(f"enroll {user.full_name} skipped: {exc}")

    return sections


# ---------------------------------------------------------------------------
# 3. Guardians: add two more guardian accounts and link them to whichever
#    active students currently have no guardian at all.
# ---------------------------------------------------------------------------


async def seed_guardians(db, principal: CurrentUser):
    guardian_defs = [
        ("Rashida Begum", "rashida.begum@codexedumine.test", "01711000010", "Mother"),
        ("Kamal Hossain", "kamal.hossain@codexedumine.test", "01711000011", "Father"),
    ]
    guardians = []
    for full_name, email, phone, _relation in guardian_defs:
        user = await auth_repository.get_user_by_email(db, email)
        if user is not None:
            record = await guardians_repository.get_guardian_by_user_id(db, user.id)
            guardians.append(record[0])
            log(f"guardian {full_name} already exists, skip")
            continue
        guardian, _user = await guardians_service.create_guardian(
            db, principal,
            guardians_schemas.CreateGuardianRequest(
                full_name=full_name, email=email, phone=phone, password="SeedPass123!",
                occupation="Business", address="Dhaka, Bangladesh",
            ),
        )
        guardians.append(guardian)
        log(f"created guardian {full_name}")

    linked_student_ids = {row[0] for row in (await db.execute(select(StudentGuardian.student_id))).all()}
    result = await db.execute(
        select(Student, User)
        .join(User, User.id == Student.user_id)
        .where(Student.deleted_at.is_(None), User.is_active.is_(True))
        .order_by(Student.admission_number.asc())
    )
    unlinked = [(s, u) for s, u in result.all() if s.id not in linked_student_ids]

    plan = [(guardians[0], unlinked[0:1], "Mother"), (guardians[1], unlinked[1:3], "Father")] if len(unlinked) >= 3 else []
    for guardian, pairs, relation in plan:
        for student, user in pairs:
            try:
                await students_service.link_guardian(db, principal, student.id, guardian.id, relation, True)
                log(f"linked {user.full_name} -> guardian {guardian.id}")
            except (ConflictException, NotFoundException) as exc:
                log(f"link skipped: {exc}")


# ---------------------------------------------------------------------------
# 4. Teacher / staff qualifications.
# ---------------------------------------------------------------------------


async def seed_qualifications(db, principal: CurrentUser, teachers_by_email):
    teacher_quals = {
        "teacher@codexedumine.test": [
            teachers_schemas.QualificationInput(education_title="B.Ed", institute="University of Dhaka", grade="A", passing_year=2015)
        ],
        "mahmudulmk121212@gmail.com": [
            teachers_schemas.QualificationInput(education_title="M.A. in English", institute="Jahangirnagar University", grade="A+", passing_year=2012)
        ],
        "nasrin.akter@codexedumine.test": [
            teachers_schemas.QualificationInput(education_title="B.Sc. in Mathematics", institute="BUET", grade="A", passing_year=2018)
        ],
    }
    for email, quals in teacher_quals.items():
        teacher, user = teachers_by_email[email]
        existing = await teachers_repository.list_qualifications(db, teacher.id)
        if existing:
            log(f"{user.full_name} already has qualifications, skip")
            continue
        await teachers_service.update_teacher(db, principal, teacher.id, teachers_schemas.UpdateTeacherRequest(qualifications=quals))
        log(f"added qualifications for {user.full_name}")

    staff_rows = (
        await db.execute(select(Staff, User).join(User, User.id == Staff.user_id))
    ).all()
    staff_quals = {
        "accountant@codexedumine.test": [
            users_schemas.QualificationInput(education_title="B.Com in Accounting", institute="National University", grade="A", passing_year=2016)
        ],
        "receptionist@codexedumine.test": [
            users_schemas.QualificationInput(education_title="HSC", institute="Dhaka College", grade="A", passing_year=2019)
        ],
        "staff@codexedumine.test": [
            users_schemas.QualificationInput(education_title="SSC", institute="Dhaka Govt. School", grade="A-", passing_year=2017)
        ],
    }
    for staff, user in staff_rows:
        quals = staff_quals.get(user.email)
        if quals is None:
            continue
        existing = await users_repository.list_qualifications(db, staff.id)
        if existing:
            log(f"{user.full_name} already has qualifications, skip")
            continue
        await users_service.update_user_account(db, principal, user.id, users_schemas.UpdateUserAccountRequest(qualifications=quals))
        log(f"added qualifications for {user.full_name}")


# ---------------------------------------------------------------------------
# 5. Routine: fill out the weekly timetable using the newly assigned
#    class_subjects, avoiding conflicts with whatever slots already exist.
# ---------------------------------------------------------------------------


async def seed_routine(db, principal: CurrentUser, year, classes, subjects, teachers_by_email, sections):
    rooms = {r.name: r for r in (await db.execute(select(Room))).scalars()}
    second_teacher = teachers_by_email["nasrin.akter@codexedumine.test"][0]
    sulthana = teachers_by_email["mahmudulmk121212@gmail.com"][0]

    new_slots = [
        # section, subject, teacher, room, day, period, start, end
        (sections["Surma"], subjects["Bangla"], second_teacher, rooms.get("Room 101"), Weekday.tuesday, 1, time(9, 0), time(9, 40)),
        (sections["Surma"], subjects["Physical Education"], sulthana, rooms.get("Room 101"), Weekday.tuesday, 2, time(9, 40), time(10, 20)),
        (sections["Padma"], subjects["Bangla"], second_teacher, rooms.get("Room 202"), Weekday.wednesday, 1, time(9, 0), time(9, 40)),
        (sections["Jamuna"], subjects["English"], sulthana, rooms.get("Room 101"), Weekday.tuesday, 1, time(10, 0), time(10, 40)),
        (sections["Jamuna"], subjects["Physical Education"], second_teacher, rooms.get("Room 202"), Weekday.wednesday, 2, time(10, 40), time(11, 20)),
    ]
    for section, subject, teacher, room, day, period, start, end in new_slots:
        try:
            await routine_service.create_slot(
                db, principal,
                routine_schemas.CreateRoutineSlotRequest(
                    academic_year_id=year.id, section_id=section.id, subject_id=subject.id, teacher_id=teacher.id,
                    room_id=room.id if room else None, day_of_week=day, period_number=period,
                    start_time=start, end_time=end,
                ),
            )
            log(f"created routine slot {section.name}/{subject.name}/{day.value} P{period}")
        except (ConflictException, ValidationException) as exc:
            log(f"routine slot {section.name}/{subject.name} skipped: {exc}")


# ---------------------------------------------------------------------------
# 6. Attendance: a couple of real biometric punches (exercising the full
#    device -> punch -> daily_attendance pipeline) plus a two-week backfill
#    of daily & subject-wise attendance with realistic variety (some late,
#    one at-risk student with a run of absences) via direct repository
#    upserts -- `mark_class_attendance`/punch ingestion can't backdate.
# ---------------------------------------------------------------------------


async def seed_attendance(db, principal: CurrentUser):
    devices = await attendance_repository.list_devices(db)
    if devices:
        device = devices[0]
    else:
        device = await attendance_repository.create_device(db, device_serial="SEED-DEVICE-01", location="Main Gate")
        await db.commit()
        log("created biometric device SEED-DEVICE-01")

    # Real punch-event pipeline for today, for the Demo Teacher and Demo Student.
    today = date.today()
    for email in ("teacher@codexedumine.test", "student@codexedumine.test"):
        user = await auth_repository.get_user_by_email(db, email)
        if user is None:
            continue
        existing = await attendance_repository.get_daily_attendance(db, user_id=user.id, attendance_date=today)
        if existing is not None:
            continue
        morning = datetime(today.year, today.month, today.day, 8, 15, tzinfo=timezone.utc)
        evening = datetime(today.year, today.month, today.day, 16, 5, tzinfo=timezone.utc)
        for punched_at in (morning, evening):
            await attendance_service.ingest_punch(
                db, principal,
                attendance_schemas.PunchEventRequest(device_serial=device.device_serial, user_id=user.id, punched_at=punched_at),
            )
        log(f"ingested punches for {user.full_name}")

    # Historical backfill (direct repository upserts -- see module docstring).
    result = await db.execute(
        select(User, Role.name)
        .join(Role, Role.id == User.role_id)
        .where(Role.name.in_(["teacher", "staff", "accountant", "receptionist", "student"]), User.deleted_at.is_(None), User.is_active.is_(True))
    )
    users_for_attendance = result.all()

    # Pick one enrolled student to model a genuine at-risk attendance pattern.
    at_risk_email = "student@codexedumine.test"

    day_cursor = today - timedelta(days=13)
    while day_cursor <= today:
        if day_cursor.weekday() < 5:  # Mon-Fri only ("school days")
            for user, _role_name in users_for_attendance:
                existing = await attendance_repository.get_daily_attendance(db, user_id=user.id, attendance_date=day_cursor)
                if existing is not None:
                    continue
                if user.email == at_risk_email and day_cursor >= today - timedelta(days=9):
                    status = AttendanceStatus.absent
                    entry_time = None
                    exit_time = None
                else:
                    roll = random.random()
                    status = AttendanceStatus.late if roll < 0.12 else AttendanceStatus.present
                    entry_time = datetime(day_cursor.year, day_cursor.month, day_cursor.day, 8, 30 if status == AttendanceStatus.late else 8, tzinfo=timezone.utc)
                    exit_time = entry_time + timedelta(hours=7)
                await attendance_repository.upsert_daily_attendance(
                    db, user_id=user.id, attendance_date=day_cursor, entry_time=entry_time, exit_time=exit_time, status=status
                )
        day_cursor += timedelta(days=1)
    await db.commit()
    log("backfilled two weeks of daily attendance")

    # Subject-wise class attendance for every routine slot, on matching weekdays.
    slots = await routine_repository.list_slots(db, academic_year_id=None, section_id=None, teacher_id=None, day_of_week=None)
    day_cursor = today - timedelta(days=13)
    while day_cursor <= today:
        weekday = list(Weekday)[day_cursor.weekday()]
        for slot, section, class_entity, subject, teacher, teacher_user, room in slots:
            if slot.day_of_week != weekday:
                continue
            rows = await results_repository.list_students_in_class(db, academic_year_id=slot.academic_year_id, class_id=class_entity.id)
            for student, student_user, enrollment, enrolled_section in rows:
                if enrolled_section.id != section.id:
                    continue
                existing = await attendance_repository.get_class_attendance(
                    db, student_id=student.id, routine_slot_id=slot.id, attendance_date=day_cursor
                )
                if existing is not None:
                    continue
                status = AttendanceStatus.absent if random.random() < 0.08 else AttendanceStatus.present
                await attendance_repository.upsert_class_attendance(
                    db, student_id=student.id, routine_slot_id=slot.id, attendance_date=day_cursor, status=status, marked_by=teacher.id
                )
        day_cursor += timedelta(days=1)
    await db.commit()
    log("backfilled subject-wise class attendance for all routine slots")


# ---------------------------------------------------------------------------
# 7. Exams -> Results: drive the "Mid term" exam all the way through
#    configure -> submit questions -> enter marks -> compile -> approve ->
#    publish, so published results actually exist for the dashboards.
# ---------------------------------------------------------------------------


def _questions_for(full_marks: int) -> list[exams_schemas.QuestionItem]:
    per_question = full_marks // 4
    remainder = full_marks - per_question * 4
    marks = [per_question] * 4
    marks[-1] += remainder
    return [
        exams_schemas.QuestionItem(question_text=f"Question {i + 1} (seed data)", marks=m, type="short", options=None)
        for i, m in enumerate(marks)
    ]


async def seed_exam_pipeline(db, principal: CurrentUser, year, teachers_by_email):
    exam = (await db.execute(select(Exam))).scalars().first()
    if exam is None:
        log("no exam found to drive through the pipeline, skip")
        return
    if exam.academic_year_id != year.id:
        log("exam belongs to a different academic year than the active one, skip")
        return

    pub = await results_repository.get_publication(db, exam.id)
    if pub is not None:
        log(f"exam '{exam.name}' already has a result publication (status={pub.status.value}), skip pipeline")
        return

    exam_classes = await exams_repository.list_exam_classes(db, exam.id)
    class_subject_rows = (
        await db.execute(select(ClassSubject).where(ClassSubject.academic_year_id == year.id))
    ).scalars().all()

    now = datetime.now(timezone.utc)
    items = []
    for exam_class in exam_classes:
        for cs in class_subject_rows:
            if cs.class_id == exam_class.id and cs.teacher_id is not None:
                items.append(
                    exams_schemas.ExamSubjectConfigItem(
                        class_id=cs.class_id, subject_id=cs.subject_id, full_marks=cs.full_marks, pass_marks=40,
                        question_deadline=now + timedelta(hours=2), marks_deadline=now + timedelta(hours=3),
                    )
                )
    if not items:
        log("no configurable class_subjects found for this exam's classes, skip pipeline")
        return

    existing_subjects = await exams_repository.list_exam_subjects_for_exam(db, exam.id)
    if not existing_subjects:
        try:
            await exams_service.configure_exam_subjects(db, principal, exam.id, exams_schemas.ConfigureExamSubjectsRequest(items=items))
            log(f"configured {len(items)} exam subjects for '{exam.name}'")
        except (ConflictException, ValidationException) as exc:
            log(f"configure_exam_subjects skipped: {exc}")
            return
        existing_subjects = await exams_repository.list_exam_subjects_for_exam(db, exam.id)

    # Submit questions for every subject, as its assigned teacher.
    for exam_subject, _exam, _class_entity, _subject, teacher, teacher_user in existing_subjects:
        if exam_subject.question_submitted_at is not None:
            continue
        teacher_actor = CurrentUser(
            id=teacher_user.id, full_name=teacher_user.full_name, phone=teacher_user.phone,
            email=teacher_user.email, role="teacher", permissions=frozenset(),
        )
        try:
            await exams_service.submit_questions(
                db, teacher_actor, exam_subject.id,
                exams_schemas.SubmitQuestionsRequest(questions=_questions_for(exam_subject.full_marks)),
            )
            log(f"submitted questions for exam_subject {exam_subject.id}")
        except (ConflictException, ValidationException) as exc:
            log(f"submit_questions skipped: {exc}")

    exam_subjects = await exams_repository.list_exam_subjects_for_exam(db, exam.id)

    # Enter marks for every enrolled student in each subject's class.
    for exam_subject, _exam, class_entity, _subject, teacher, teacher_user in exam_subjects:
        if exam_subject.marks_submitted_at is not None:
            continue
        roster = await results_repository.list_students_in_class(db, academic_year_id=year.id, class_id=class_entity.id)
        if not roster:
            continue
        mark_items = []
        for i, (student, _user, _enrollment, _section) in enumerate(roster):
            if i == 0:
                mark_items.append(results_schemas.MarkEntryItem(student_id=student.id, is_absent=True))
            elif i == 1:
                # Deliberately low mark so the At-Risk widget has a real signal to surface.
                mark_items.append(results_schemas.MarkEntryItem(student_id=student.id, marks_obtained=round(exam_subject.full_marks * 0.28, 2)))
            else:
                pct = random.uniform(0.55, 0.97)
                mark_items.append(results_schemas.MarkEntryItem(student_id=student.id, marks_obtained=round(exam_subject.full_marks * pct, 2)))

        teacher_actor = CurrentUser(
            id=teacher_user.id, full_name=teacher_user.full_name, phone=teacher_user.phone,
            email=teacher_user.email, role="teacher", permissions=frozenset(),
        )
        try:
            await results_service.save_marks(db, teacher_actor, exam_subject.id, results_schemas.SaveMarksRequest(items=mark_items))
            await results_service.submit_marks(db, teacher_actor, exam_subject.id)
            log(f"entered and submitted marks for exam_subject {exam_subject.id}")
        except (ConflictException, ValidationException) as exc:
            log(f"marks entry skipped for exam_subject {exam_subject.id}: {exc}")

    try:
        await results_service.compile_and_submit(db, principal, exam.id)
        await results_service.approve_results(db, principal, exam.id)
        await results_service.publish_results(db, principal, exam.id)
        log(f"exam '{exam.name}' compiled, approved, and published")
    except (ConflictException, ValidationException) as exc:
        log(f"result publication pipeline stopped: {exc}")


# ---------------------------------------------------------------------------
# 8. Billing: more fee types, fee structures for both classes, invoices for
#    the whole enrolled roster, a discount, and a mix of paid/unpaid invoices.
# ---------------------------------------------------------------------------


async def seed_billing(db, principal: CurrentUser, year, classes):
    fee_type_defs = [
        ("Admission Fee", False),
        ("Session Fee", False),
        ("Monthly Tuition", True),
        ("Sports Fee", False),
    ]
    fee_types: dict[str, FeeType] = {ft.name: ft for ft in (await db.execute(select(FeeType))).scalars()}
    for name, is_recurring in fee_type_defs:
        if name in fee_types:
            continue
        entity = await billing_service.create_fee_type(db, principal, billing_schemas.CreateFeeTypeRequest(name=name, is_recurring=is_recurring))
        fee_types[name] = entity
        log(f"created fee type {name}")

    class3, class8 = classes["3"], classes["8"]
    structure_plan = {
        class3.id: {"Admission Fee": 1000, "Session Fee": 800, "Monthly Tuition": 500, "Sports Fee": 200},
        class8.id: {"Admission Fee": 1200, "Session Fee": 900, "Monthly Tuition": 600, "Sports Fee": 250},
    }
    for class_id, amounts in structure_plan.items():
        items = [billing_schemas.FeeStructureItemInput(fee_type_id=fee_types[name].id, amount=amount) for name, amount in amounts.items()]
        await billing_service.set_fee_structure(
            db, principal, billing_schemas.SetFeeStructureRequest(academic_year_id=year.id, class_id=class_id, items=items)
        )
    log("set class fee structures for classes 3 and 8")

    due_date = date.today() + timedelta(days=14)
    invoice_fee_type_ids = [fee_types["Monthly Tuition"].id, fee_types["Sports Fee"].id]
    generated_invoices: list[dict] = []
    for class_id in (class3.id, class8.id):
        result = await billing_service.generate_invoices_for_class(
            db, principal, class_id,
            billing_schemas.GenerateInvoiceRequest(fee_type_ids=invoice_fee_type_ids, due_date=due_date, academic_year_id=year.id),
        )
        generated_invoices.extend(result["created"])
        log(f"generated {len(result['created'])} invoices for class {class_id} ({len(result['skipped_student_ids'])} already existed)")

    # Record payments for most invoices (some full, some partial) and one discount.
    for i, invoice_detail in enumerate(generated_invoices):
        invoice_id = uuid.UUID(invoice_detail["id"])
        invoice = await billing_repository.get_invoice(db, invoice_id)
        if invoice is None or float(invoice.due_amount) <= 0:
            continue
        if i == 0:
            try:
                await billing_service.add_discount(
                    db, principal, invoice_id,
                    billing_schemas.AddDiscountRequest(discount_type=DiscountType.percentage, value=10, reason="Seed data: sibling discount"),
                )
                log(f"added discount to invoice {invoice.invoice_number}")
            except (ConflictException, ValidationException) as exc:
                log(f"discount skipped: {exc}")
            invoice = await billing_repository.get_invoice(db, invoice_id)

        if i % 3 == 2:
            continue  # leave roughly a third of invoices fully unpaid for dues-outstanding data

        due_amount = float(invoice.due_amount)
        amount = due_amount if i % 3 == 0 else round(due_amount * 0.5, 2)
        if amount <= 0:
            continue
        try:
            await billing_service.record_payment(
                db, principal, invoice_id,
                billing_schemas.RecordPaymentRequest(amount=amount, method=PaymentMethod.cash if i % 2 == 0 else PaymentMethod.online),
            )
            log(f"recorded payment of {amount} for invoice {invoice.invoice_number}")
        except (ConflictException, ValidationException) as exc:
            log(f"payment skipped: {exc}")


# ---------------------------------------------------------------------------
# 9. Payroll: salary structures for every active teacher/staff, a run for
#    the current period, and a couple of payslips marked paid.
# ---------------------------------------------------------------------------


async def seed_payroll(db, principal: CurrentUser):
    teachers = await payroll_repository.list_active_teachers(db)
    staff = await payroll_repository.list_active_staff(db)
    effective_from = date(date.today().year, 1, 1)

    for teacher, user in teachers:
        current = await payroll_repository.get_current_salary_structure(db, teacher_id=teacher.id, staff_id=None, as_of=date.today())
        if current is not None:
            continue
        await payroll_service.create_salary_structure(
            db, principal,
            payroll_schemas.SetSalaryStructureRequest(teacher_id=teacher.id, basic_salary=35000, allowances=5000, deductions=1000, effective_from=effective_from),
        )
        log(f"created salary structure for {user.full_name}")

    for member, user, _role_name in staff:
        current = await payroll_repository.get_current_salary_structure(db, teacher_id=None, staff_id=member.id, as_of=date.today())
        if current is not None:
            continue
        await payroll_service.create_salary_structure(
            db, principal,
            payroll_schemas.SetSalaryStructureRequest(staff_id=member.id, basic_salary=22000, allowances=2000, deductions=500, effective_from=effective_from),
        )
        log(f"created salary structure for {user.full_name}")

    today = date.today()
    existing_run = await payroll_repository.get_payroll_run_by_period(db, today.month, today.year)
    if existing_run is None:
        try:
            result = await payroll_service.generate_payroll_run(
                db, principal, payroll_schemas.GeneratePayrollRunRequest(period_month=today.month, period_year=today.year)
            )
            log(f"generated payroll run for {today.month}/{today.year}")
            run_id = uuid.UUID(result["id"]) if isinstance(result, dict) and "id" in result else None
        except (ConflictException, ValidationException) as exc:
            log(f"payroll run generation skipped: {exc}")
            run_id = None
    else:
        run_id = existing_run.id
        log(f"payroll run for {today.month}/{today.year} already exists, skip generation")

    if run_id is not None:
        payslips = await payroll_repository.list_payslips_for_run(db, run_id)
        for payslip in payslips[: max(1, len(payslips) // 2)]:
            if payslip.status.value == "paid":
                continue
            try:
                await payroll_service.mark_payslip_paid(db, principal, payslip.id)
                log(f"marked payslip {payslip.id} paid")
            except (ConflictException, ValidationException) as exc:
                log(f"mark_payslip_paid skipped: {exc}")


# ---------------------------------------------------------------------------
# 10. Expenses: categories + a mix of pending/approved/rejected expenses.
# ---------------------------------------------------------------------------


async def seed_expenses(db, principal: CurrentUser):
    category_names = ["Utilities", "Maintenance", "Office Supplies"]
    categories: dict[str, uuid.UUID] = {c.name: c.id for c in (await db.execute(select(ExpenseCategory))).scalars()}
    for name in category_names:
        if name in categories:
            continue
        entity = await expenses_service.create_expense_category(db, principal, expenses_schemas.CreateExpenseCategoryRequest(name=name))
        categories[name] = uuid.UUID(entity["id"])
        log(f"created expense category {name}")

    today = date.today()
    expense_defs = [
        (categories.get("Utilities"), 4500, "Monthly electricity bill", today - timedelta(days=5), "approve"),
        (categories.get("Maintenance"), 3200, "Classroom furniture repair", today - timedelta(days=3), "approve"),
        (categories.get("Office Supplies"), 1500, "Stationery restock", today - timedelta(days=1), "pending"),
        (categories.get("Utilities"), 900, "Internet service", today - timedelta(days=10), "reject"),
    ]
    existing_descriptions = {e.description for e, *_ in (await expenses_repository.list_expenses(db, status=None, category_id=None, requested_by=None, offset=0, limit=200))[0]}
    for category_id, amount, description, expense_date, decision in expense_defs:
        if category_id is None or description in existing_descriptions:
            continue
        result = await expenses_service.create_expense(
            db, principal, expenses_schemas.CreateExpenseRequest(category_id=category_id, amount=amount, description=description, expense_date=expense_date)
        )
        expense_id = uuid.UUID(result["id"]) if isinstance(result, dict) and "id" in result else None
        log(f"created expense: {description}")
        if expense_id is None or decision == "pending":
            continue
        try:
            if decision == "approve":
                await expenses_service.approve_expense(db, principal, expense_id)
            else:
                await expenses_service.reject_expense(db, principal, expense_id)
            log(f"{decision}d expense: {description}")
        except (ConflictException, ValidationException) as exc:
            log(f"expense decision skipped: {exc}")


# ---------------------------------------------------------------------------
# 11. Assets: categories, assets, and at least one condition/quantity change
#     (auto-logs to asset_logs via update_asset).
# ---------------------------------------------------------------------------


async def seed_assets(db, principal: CurrentUser):
    rooms = {r.name: r for r in (await db.execute(select(Room))).scalars()}
    category_names = ["Furniture", "Electronics", "Sports Equipment"]
    categories: dict[str, uuid.UUID] = {c.name: c.id for c in (await db.execute(select(AssetCategory))).scalars()}
    for name in category_names:
        if name in categories:
            continue
        entity = await assets_service.create_asset_category(db, principal, assets_schemas.CreateAssetCategoryRequest(name=name))
        categories[name] = uuid.UUID(entity["id"])
        log(f"created asset category {name}")

    asset_defs = [
        ("Whiteboard", "Furniture", rooms.get("Room 101"), 10, AssetCondition.good, 150.0),
        ("Projector", "Electronics", rooms.get("Room 202"), 3, AssetCondition.new, 800.0),
        ("Football", "Sports Equipment", None, 15, AssetCondition.fair, 25.0),
    ]
    existing_assets: dict[str, Asset] = {a.name: a for a in (await db.execute(select(Asset))).scalars()}
    created_or_existing: dict[str, Asset] = {}
    for name, category_name, room, quantity, condition, purchase_value in asset_defs:
        if name in existing_assets:
            created_or_existing[name] = existing_assets[name]
            continue
        result = await assets_service.create_asset(
            db, principal,
            assets_schemas.CreateAssetRequest(
                category_id=categories[category_name], name=name, room_id=room.id if room else None,
                quantity=quantity, condition=condition, purchase_date=date.today() - timedelta(days=200), purchase_value=purchase_value,
            ),
        )
        asset_id = uuid.UUID(result["id"]) if isinstance(result, dict) and "id" in result else None
        if asset_id is not None:
            created_or_existing[name] = await assets_repository.get_asset(db, asset_id)
        log(f"created asset {name}")

    football = created_or_existing.get("Football")
    if football is not None and football.quantity == 15:
        await assets_service.update_asset(
            db, principal, football.id, assets_schemas.UpdateAssetRequest(quantity=12, condition=AssetCondition.fair)
        )
        log("updated Football quantity 15 -> 12 (auto-logged to asset_logs)")

    whiteboard = created_or_existing.get("Whiteboard")
    if whiteboard is not None and whiteboard.condition == AssetCondition.good:
        await assets_service.update_asset(db, principal, whiteboard.id, assets_schemas.UpdateAssetRequest(condition=AssetCondition.fair))
        log("updated Whiteboard condition good -> fair (auto-logged to asset_logs)")


# ---------------------------------------------------------------------------
# 12. Communication: announcements across every audience type, with SMS
#     dispatch and a couple of read receipts.
# ---------------------------------------------------------------------------


async def seed_communication(db, principal: CurrentUser, sections):
    existing_titles = {a.title for a in (await db.execute(text("SELECT title FROM announcements"))).all()}
    announcement_defs = [
        ("Welcome to the new academic term", "Classes resume Monday. Please ensure all fees for the term are settled.", AudienceType.all, None, True, "Welcome back! Term begins Monday."),
        ("Staff meeting this Friday", "All teaching staff please attend the 3pm staff meeting in the staff room.", AudienceType.teachers, None, False, None),
        ("Parent-teacher conference next week", "We invite all guardians to the parent-teacher conference next week. Details to follow.", AudienceType.guardians, None, True, "PTC next week - details to follow."),
    ]
    if "Jamuna" in sections:
        announcement_defs.append(
            ("Jamuna section field trip permission slip due", "Please submit the signed permission slip for the upcoming field trip by Friday.", AudienceType.specific_class, sections["Jamuna"].id, False, None)
        )

    created_ids = []
    for title, body, audience_type, section_id, send_sms, sms_message in announcement_defs:
        if title in existing_titles:
            continue
        response = await communication_service.create_announcement(
            db, principal,
            communication_schemas.CreateAnnouncementRequest(
                title=title, body=body, audience_type=audience_type, section_id=section_id, send_sms=send_sms, sms_message=sms_message
            ),
        )
        created_ids.append(response["id"])
        log(f"created announcement: {title}")

    if created_ids:
        student_actor_user = await auth_repository.get_user_by_email(db, "student@codexedumine.test")
        if student_actor_user is not None:
            student_actor = CurrentUser(
                id=student_actor_user.id, full_name=student_actor_user.full_name, phone=student_actor_user.phone,
                email=student_actor_user.email, role="student", permissions=frozenset(),
            )
            try:
                await communication_service.mark_announcement_read(db, student_actor, uuid.UUID(created_ids[0]))
                log("marked the welcome announcement read for Demo Student")
            except (ConflictException, NotFoundException, PermissionDeniedException) as exc:
                log(f"mark_announcement_read skipped: {exc}")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

TABLES = [
    "roles", "permissions", "role_permissions", "users",
    "academic_years", "classes", "rooms", "subjects", "sections", "class_subjects", "student_enrollments",
    "students", "student_guardians", "guardians", "teachers", "teacher_qualifications", "staff", "staff_qualifications",
    "routine_slots", "biometric_devices", "attendance_punches", "daily_attendance", "class_attendance",
    "exams", "exam_classes", "exam_subjects", "exam_subject_sections", "exam_results", "result_publications",
    "fee_types", "class_fee_structures", "invoices", "invoice_items", "discounts", "payments",
    "salary_structures", "payroll_runs", "payslips", "expense_categories", "expenses",
    "asset_categories", "assets", "asset_logs", "announcements", "announcement_recipients", "sms_logs",
]


async def print_summary(db):
    log("=" * 60)
    log("Row counts after seeding:")
    for table in TABLES:
        result = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
        log(f"  {table:28s} {result.scalar_one()}")


async def main():
    async for db in get_db():
        principal = await actor_from_email(db, "principal@codexedumine.test", "principal")

        year, classes, subjects, teachers_by_email = await seed_academic(db, principal)
        sections = await seed_enrollments(db, principal, year, classes)
        await seed_guardians(db, principal)
        await seed_qualifications(db, principal, teachers_by_email)
        await seed_routine(db, principal, year, classes, subjects, teachers_by_email, sections)
        await seed_attendance(db, principal)
        await seed_exam_pipeline(db, principal, year, teachers_by_email)
        await seed_billing(db, principal, year, classes)
        await seed_payroll(db, principal)
        await seed_expenses(db, principal)
        await seed_assets(db, principal)
        await seed_communication(db, principal, sections)

        await print_summary(db)
        break

    log("Done.")


if __name__ == "__main__":
    asyncio.run(main())
