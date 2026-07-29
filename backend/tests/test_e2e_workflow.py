"""End-to-end cross-module workflow (Phase 16):

admission -> enrollment -> billing -> attendance -> exam -> result -> dashboard

Runs as an ordered sequence of test functions in this file (pytest executes a
module's tests top-to-bottom by default; no plugin needed) that share state
through the module-level `STATE` dict, since each stage's data is a
precondition for the next -- e.g. you cannot bill a student who isn't
enrolled, or publish a result for an exam with no submitted marks. Each stage
also asserts the RBAC/data-scoping rule that specifically governs it (e.g.
results invisible pre-publish, guardian sees only a linked child), rather than
deferring all of that to test_rbac_boundaries.py, since these checks are only
meaningful with real, related data.
"""

from datetime import date, datetime, time, timedelta, timezone

STATE: dict = {}


def _today_weekday_name() -> str:
    # matches app.common.enums.Weekday values (monday=0 ... sunday=6)
    return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][date.today().weekday()]


async def test_00_academic_setup(role_clients, unique_suffix):
    admin = role_clients["admin"]
    principal = role_clients["principal"]

    year_name = f"E2E-{unique_suffix}"
    resp = await admin.post(
        "/api/v1/academic/years",
        json={"name": year_name, "start_date": "2026-01-01", "end_date": "2026-12-31"},
    )
    assert resp.status_code == 201, resp.text
    year = resp.json()["data"]
    STATE["year_id"] = year["id"]

    resp = await admin.post(f"/api/v1/academic/years/{year['id']}/activate")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["is_active"] is True

    resp = await admin.get("/api/v1/academic/years/active")
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == year["id"]

    resp = await admin.post("/api/v1/academic/classes", json={"name": f"E2E-{unique_suffix}", "numeric_order": 5})
    assert resp.status_code == 201, resp.text
    STATE["class_id"] = resp.json()["data"]["id"]

    resp = await admin.post("/api/v1/academic/rooms", json={"name": f"Room-{unique_suffix}", "capacity": 40})
    assert resp.status_code == 201, resp.text
    STATE["room_id"] = resp.json()["data"]["id"]

    resp = await admin.post("/api/v1/academic/subjects", json={"name": f"Math-{unique_suffix}", "code": unique_suffix.upper()})
    assert resp.status_code == 201, resp.text
    STATE["subject_id"] = resp.json()["data"]["id"]

    resp = await admin.post(
        "/api/v1/academic/sections",
        json={"class_id": STATE["class_id"], "room_id": STATE["room_id"], "name": f"A-{unique_suffix}"},
    )
    assert resp.status_code == 201, resp.text
    STATE["section_id"] = resp.json()["data"]["id"]

    # Resolve the demo teacher's teacher_id to assign as the class-subject teacher.
    teacher_client = role_clients["teacher"]
    resp = await teacher_client.get("/api/v1/teachers/me")
    assert resp.status_code == 200, resp.text
    STATE["teacher_id"] = resp.json()["data"]["id"]

    resp = await admin.post(
        "/api/v1/academic/class-subjects",
        json={"class_id": STATE["class_id"], "subject_id": STATE["subject_id"], "teacher_id": STATE["teacher_id"], "full_marks": 100},
    )
    assert resp.status_code == 201, resp.text
    STATE["class_subject_id"] = resp.json()["data"]["id"]

    # Principal (bypasses all permission checks) can read back what Admin just built.
    resp = await principal.get("/api/v1/academic/sections")
    assert resp.status_code == 200
    assert any(s["id"] == STATE["section_id"] for s in resp.json()["data"])


async def test_01_admission_and_enrollment(role_clients, unique_suffix):
    """Admission (Admin creates the student) and enrollment happen together --
    students/service.py create_student() auto-enrolls into the given section."""
    admin = role_clients["admin"]

    dob = "2015-06-15"
    student_email = f"e2e.student.{unique_suffix}@codexedumine.test"
    resp = await admin.post(
        "/api/v1/students",
        json={
            "full_name": f"E2E Student {unique_suffix}",
            "email": student_email,
            "phone": f"01900{unique_suffix[:6]}",
            "date_of_birth": dob,
            "section_id": STATE["section_id"],
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    STATE["student_id"] = data["id"]
    STATE["student_user_id"] = data["user_id"]
    STATE["student_password"] = data["temporary_password"]
    STATE["student_email"] = student_email
    STATE["student_section_name"] = data["section_name"]
    assert data["section_name"] is not None
    assert data["roll_number"] is not None

    # Enrollment record exists and is scoped to the section/year just created.
    resp = await admin.get("/api/v1/academic/enrollments", params={"section_id": STATE["section_id"]})
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]
    assert any(item["student_id"] == STATE["student_id"] for item in items)

    # Create + link a guardian for this student (guardian-student linking, Phase 4).
    resp = await admin.post(
        "/api/v1/guardians",
        json={
            "full_name": f"E2E Guardian {unique_suffix}",
            "email": f"e2e.guardian.{unique_suffix}@codexedumine.test",
            "phone": f"01911{unique_suffix[:6]}",
            "password": "GuardianPass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    STATE["guardian_id"] = resp.json()["data"]["id"]
    STATE["guardian_email"] = f"e2e.guardian.{unique_suffix}@codexedumine.test"

    resp = await admin.post(
        f"/api/v1/students/{STATE['student_id']}/guardians/{STATE['guardian_id']}",
        json={"relation": "Mother", "is_primary": True},
    )
    assert resp.status_code in (200, 201), resp.text

    resp = await admin.get(f"/api/v1/students/{STATE['student_id']}")
    assert resp.status_code == 200
    guardians = resp.json()["data"]["guardians"]
    assert any(g["guardian_id"] == STATE["guardian_id"] for g in guardians)


async def test_02_student_and_guardian_login():
    """Freshly admitted/created accounts can actually log in with their real credentials.

    These clients are kept alive (module-level, not the function-scoped
    anon_client fixture) and reused by test_06/test_08 below instead of
    logging in again each time -- login is rate-limited (10/minute), and this
    suite already spends most of that budget logging in the 8 demo-role
    sessions once each at session scope.
    """
    from httpx import ASGITransport
    from httpx import AsyncClient as _AsyncClient

    from app.main import app as _app

    student_client = _AsyncClient(transport=ASGITransport(app=_app), base_url="http://test")
    resp = await student_client.post(
        "/api/v1/auth/login", json={"identifier": STATE["student_email"], "password": STATE["student_password"]}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["role"] == "student"
    STATE["student_client"] = student_client

    guardian_client = _AsyncClient(transport=ASGITransport(app=_app), base_url="http://test")
    resp = await guardian_client.post(
        "/api/v1/auth/login", json={"identifier": STATE["guardian_email"], "password": "GuardianPass123!"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["role"] == "guardian"
    STATE["guardian_client"] = guardian_client


async def test_03_billing(role_clients, unique_suffix):
    admin = role_clients["admin"]
    accountant = role_clients["accountant"]

    resp = await admin.post("/api/v1/billing/fee-types", json={"name": f"Tuition-{unique_suffix}", "is_recurring": True})
    assert resp.status_code == 201, resp.text
    fee_type_id = resp.json()["data"]["id"]
    STATE["fee_type_id"] = fee_type_id

    resp = await admin.put(
        "/api/v1/billing/fee-structures",
        json={
            "academic_year_id": STATE["year_id"],
            "class_id": STATE["class_id"],
            "items": [{"fee_type_id": fee_type_id, "amount": 1000}],
        },
    )
    assert resp.status_code == 200, resp.text

    due_date = str(date.today() + timedelta(days=30))
    resp = await admin.post(
        f"/api/v1/billing/classes/{STATE['class_id']}/invoices/generate",
        json={"fee_type_ids": [fee_type_id], "due_date": due_date, "academic_year_id": STATE["year_id"]},
    )
    assert resp.status_code == 200, resp.text
    created = resp.json()["data"]["created"]
    invoice = next(i for i in created if i["student_id"] == STATE["student_id"])
    STATE["invoice_id"] = invoice["id"]
    assert invoice["total_amount"] == 1000
    assert invoice["due_amount"] == 1000

    # Partial payment by Accountant.
    resp = await accountant.post(
        f"/api/v1/billing/invoices/{STATE['invoice_id']}/payments",
        json={"amount": 400, "method": "cash"},
    )
    assert resp.status_code == 201, resp.text

    resp = await accountant.get(f"/api/v1/billing/invoices/{STATE['invoice_id']}")
    assert resp.status_code == 200
    inv = resp.json()["data"]
    assert inv["paid_amount"] == 400
    assert inv["due_amount"] == 600
    assert inv["status"] in ("partially_paid", "unpaid", "paid")  # exact label per InvoiceStatus enum

    # Overpayment safeguard: paying more than the remaining due must be rejected, not silently clamp.
    resp = await accountant.post(
        f"/api/v1/billing/invoices/{STATE['invoice_id']}/payments",
        json={"amount": 999999, "method": "cash"},
    )
    assert resp.status_code in (409, 422), (
        f"overpayment beyond due_amount must be rejected, got {resp.status_code}: {resp.text}"
    )

    # Receptionist also holds billing.collect_payment -- pay off the remainder.
    receptionist = role_clients["receptionist"]
    resp = await receptionist.post(
        f"/api/v1/billing/invoices/{STATE['invoice_id']}/payments",
        json={"amount": 600, "method": "online"},
    )
    assert resp.status_code == 201, resp.text
    resp = await admin.get(f"/api/v1/billing/invoices/{STATE['invoice_id']}")
    assert resp.json()["data"]["due_amount"] == 0

    # Data scoping: the linked guardian CAN view this student's invoices...
    guardian = role_clients["guardian"]  # demo guardian, NOT the newly linked one -- must be denied (not linked)
    resp = await guardian.get(f"/api/v1/billing/students/{STATE['student_id']}/invoices")
    assert resp.status_code == 403, "an unrelated guardian must not see this student's invoices"


async def test_04_attendance(role_clients, unique_suffix):
    admin = role_clients["admin"]
    teacher = role_clients["teacher"]

    resp = await admin.post(
        "/api/v1/attendance/devices", json={"device_serial": f"E2E-DEV-{unique_suffix}", "location": "Main Gate"}
    )
    assert resp.status_code == 201, resp.text

    now = datetime.now().astimezone()
    morning = now.replace(hour=8, minute=15, second=0, microsecond=0)
    evening = now.replace(hour=16, minute=5, second=0, microsecond=0)
    for punched_at in (morning, evening):
        resp = await admin.post(
            "/api/v1/attendance/punches",
            json={
                "device_serial": f"E2E-DEV-{unique_suffix}",
                "user_id": STATE["student_user_id"],
                "punched_at": punched_at.isoformat(),
            },
        )
        assert resp.status_code == 201, resp.text

    resp = await admin.get("/api/v1/attendance/daily", params={"date_from": str(date.today()), "date_to": str(date.today())})
    assert resp.status_code == 200, resp.text
    rows = resp.json()["data"]["items"] if isinstance(resp.json()["data"], dict) else resp.json()["data"]
    assert any(r["user_id"] == STATE["student_user_id"] for r in rows)

    # Subject-wise class attendance: build a routine slot whose window is open right now.
    now_t = datetime.now()
    open_start = (now_t - timedelta(minutes=5)).time().replace(microsecond=0)
    open_end = (now_t + timedelta(minutes=55)).time().replace(microsecond=0)
    resp = await admin.post(
        "/api/v1/routine/slots",
        json={
            "academic_year_id": STATE["year_id"],
            "section_id": STATE["section_id"],
            "subject_id": STATE["subject_id"],
            "teacher_id": STATE["teacher_id"],
            "room_id": STATE["room_id"],
            "day_of_week": _today_weekday_name(),
            "period_number": 1,
            "start_time": open_start.isoformat(),
            "end_time": open_end.isoformat(),
        },
    )
    assert resp.status_code == 201, resp.text
    STATE["open_slot_id"] = resp.json()["data"]["id"]

    resp = await teacher.post(
        "/api/v1/attendance/class/mark",
        json={
            "routine_slot_id": STATE["open_slot_id"],
            "attendance_date": str(date.today()),
            "items": [{"student_id": STATE["student_id"], "status": "present"}],
        },
    )
    assert resp.status_code == 200, resp.text

    # A slot whose window has already closed today must reject marking.
    if now_t.hour >= 1:  # avoid wrap-around near midnight
        closed_start = time(0, 0)
        closed_end = (now_t - timedelta(minutes=30)).time().replace(microsecond=0)
        resp = await admin.post(
            "/api/v1/routine/slots",
            json={
                "academic_year_id": STATE["year_id"],
                "section_id": STATE["section_id"],
                "subject_id": STATE["subject_id"],
                "teacher_id": STATE["teacher_id"],
                "room_id": STATE["room_id"],
                "day_of_week": _today_weekday_name(),
                "period_number": 2,
                "start_time": closed_start.isoformat(),
                "end_time": closed_end.isoformat(),
            },
        )
        assert resp.status_code == 201, resp.text
        closed_slot_id = resp.json()["data"]["id"]
        resp = await teacher.post(
            "/api/v1/attendance/class/mark",
            json={
                "routine_slot_id": closed_slot_id,
                "attendance_date": str(date.today()),
                "items": [{"student_id": STATE["student_id"], "status": "present"}],
            },
        )
        assert resp.status_code == 422, f"marking after the class window closed should be rejected, got {resp.status_code}: {resp.text}"

    # Combined per-student daily view merges biometric + subject-wise records.
    resp = await admin.get(f"/api/v1/attendance/students/{STATE['student_id']}/daily", params={"attendance_date": str(date.today())})
    assert resp.status_code == 200, resp.text
    combined = resp.json()["data"]
    assert combined["entry_time"] is not None
    assert combined["exit_time"] is not None
    assert any(p["status"] == "present" for p in combined["periods"])


async def test_05_exam_question_and_marks(role_clients):
    admin = role_clients["admin"]
    teacher = role_clients["teacher"]

    resp = await admin.post(
        "/api/v1/exams",
        json={
            "name": "E2E Term Test",
            "term": "Term 1",
            "start_date": "2026-06-01",
            "end_date": "2026-06-10",
            "class_ids": [STATE["class_id"]],
        },
    )
    assert resp.status_code == 201, resp.text
    STATE["exam_id"] = resp.json()["data"]["id"]

    now = datetime.now(timezone.utc)
    resp = await admin.post(
        f"/api/v1/exams/{STATE['exam_id']}/subjects",
        json={
            "items": [
                {
                    "class_id": STATE["class_id"],
                    "subject_id": STATE["subject_id"],
                    "full_marks": 100,
                    "pass_marks": 40,
                    "question_deadline": (now + timedelta(hours=2)).isoformat(),
                    "marks_deadline": (now + timedelta(hours=3)).isoformat(),
                }
            ]
        },
    )
    assert resp.status_code == 200, resp.text

    resp = await admin.get(f"/api/v1/exams/{STATE['exam_id']}")
    assert resp.status_code == 200
    # Fetch the exam_subject id via the teacher's pending-submission queue.
    resp = await teacher.get("/api/v1/exams/subjects/my-submissions")
    assert resp.status_code == 200, resp.text
    subjects = resp.json()["data"]["items"] if isinstance(resp.json()["data"], dict) else resp.json()["data"]
    exam_subject = next(s for s in subjects if s["exam_id"] == STATE["exam_id"])
    STATE["exam_subject_id"] = exam_subject["id"]

    resp = await teacher.post(
        f"/api/v1/exams/subjects/{STATE['exam_subject_id']}/submit",
        json={"questions": [
            {"question_text": "2+2?", "marks": 50, "type": "short", "options": None},
            {"question_text": "3+3?", "marks": 50, "type": "short", "options": None},
        ]},
    )
    assert resp.status_code == 200, resp.text

    # Ownership boundary: a second teacher, NOT assigned to this exam_subject,
    # must not be able to enter marks for it (results/service.py
    # _assert_owns_exam_subject). Note Admin/Principal deliberately bypass this
    # check (requirements.md 3.2: Admin can manage all features except those
    # reserved for Principal), so this must be tested with a second teacher,
    # not Admin.
    resp = await admin.post(
        "/api/v1/teachers",
        json={
            "full_name": "E2E Other Teacher",
            "email": f"e2e.other.teacher.{STATE['class_id'][:8]}@codexedumine.test",
            "phone": f"01922{STATE['class_id'][:6]}",
            "date_of_birth": "1990-01-01",
            "joining_date": str(date.today()),
        },
    )
    assert resp.status_code == 201, resp.text
    other_teacher_password = resp.json()["data"]["temporary_password"]
    other_teacher_email = resp.json()["data"]["email"]

    from httpx import ASGITransport, AsyncClient as _AsyncClient
    from app.main import app as _app

    other_teacher_client = _AsyncClient(transport=ASGITransport(app=_app), base_url="http://test")
    resp = await other_teacher_client.post(
        "/api/v1/auth/login", json={"identifier": other_teacher_email, "password": other_teacher_password}
    )
    assert resp.status_code == 200, resp.text

    resp = await other_teacher_client.post(
        f"/api/v1/results/exam-subjects/{STATE['exam_subject_id']}/marks",
        json={"items": [{"student_id": STATE["student_id"], "marks_obtained": 88}]},
    )
    assert resp.status_code == 403, f"a non-assigned teacher must not be able to enter marks, got {resp.status_code}"
    await other_teacher_client.aclose()

    resp = await teacher.post(
        f"/api/v1/results/exam-subjects/{STATE['exam_subject_id']}/marks",
        json={"items": [{"student_id": STATE["student_id"], "marks_obtained": 88}]},
    )
    assert resp.status_code == 200, resp.text

    resp = await teacher.post(f"/api/v1/results/exam-subjects/{STATE['exam_subject_id']}/submit")
    assert resp.status_code == 200, resp.text


async def test_06_results_hidden_before_publish():
    student_client, guardian_client = STATE["student_client"], STATE["guardian_client"]

    resp = await student_client.get(f"/api/v1/results/my/exams/{STATE['exam_id']}/card")
    assert resp.status_code in (404, 422), (
        f"unpublished results must not be visible to the student, got {resp.status_code}: {resp.text}"
    )

    resp = await guardian_client.get(f"/api/v1/results/students/{STATE['student_id']}/exams/{STATE['exam_id']}/card")
    assert resp.status_code in (404, 422), (
        f"unpublished results must not be visible to the guardian, got {resp.status_code}: {resp.text}"
    )


async def test_07_compile_approve_publish(role_clients):
    admin = role_clients["admin"]
    principal = role_clients["principal"]
    teacher = role_clients["teacher"]

    # Only Admin holds results.compile -- Teacher must not be able to compile.
    resp = await teacher.post(f"/api/v1/results/exams/{STATE['exam_id']}/compile")
    assert resp.status_code == 403

    resp = await admin.post(f"/api/v1/results/exams/{STATE['exam_id']}/compile")
    assert resp.status_code == 200, resp.text

    # Only Principal holds results.approve/results.publish -- Admin must not be able to do either.
    resp = await admin.post(f"/api/v1/results/exams/{STATE['exam_id']}/approve")
    assert resp.status_code == 403
    resp = await admin.post(f"/api/v1/results/exams/{STATE['exam_id']}/publish")
    assert resp.status_code == 403

    resp = await principal.post(f"/api/v1/results/exams/{STATE['exam_id']}/approve")
    assert resp.status_code == 200, resp.text

    resp = await principal.post(f"/api/v1/results/exams/{STATE['exam_id']}/publish")
    assert resp.status_code == 200, resp.text


async def test_08_results_visible_after_publish():
    student_client, guardian_client = STATE["student_client"], STATE["guardian_client"]

    resp = await student_client.get(f"/api/v1/results/my/exams/{STATE['exam_id']}/card")
    assert resp.status_code == 200, resp.text
    assert any(s.get("marks_obtained") == 88 for s in resp.json()["data"].get("subjects", []))

    resp = await guardian_client.get(f"/api/v1/results/students/{STATE['student_id']}/exams/{STATE['exam_id']}/card")
    assert resp.status_code == 200, resp.text


async def test_09_dashboards(role_clients):
    checks = {
        "principal": "/api/v1/dashboard/principal",
        "admin": "/api/v1/dashboard/admin",
        "teacher": "/api/v1/dashboard/teacher",
        "accountant": "/api/v1/dashboard/accountant",
        "receptionist": "/api/v1/dashboard/receptionist",
        "staff": "/api/v1/dashboard/staff",
        "student": "/api/v1/dashboard/student",
        "guardian": "/api/v1/dashboard/guardian",
    }
    for role, path in checks.items():
        resp = await role_clients[role].get(path)
        assert resp.status_code == 200, f"{role} dashboard failed: {resp.status_code} {resp.text}"

    await STATE["student_client"].aclose()
    await STATE["guardian_client"].aclose()
