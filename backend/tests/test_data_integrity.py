"""Data integrity verification (Phase 16): referential integrity, soft-delete
behavior, and approval gates (expense approval, result publish gate).

Each test builds its own disposable fixtures rather than reusing
test_e2e_workflow.py's shared STATE, so a destructive assertion here (soft- or
hard-deleting a student, rejecting an expense) can never invalidate data an
earlier-run module still depends on.
"""

import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.modules.auth.models import User
from app.modules.students.models import Student


async def _make_year_class_section(admin, suffix: str) -> dict:
    resp = await admin.post("/api/v1/academic/years", json={"name": f"DI-{suffix}", "start_date": "2027-01-01", "end_date": "2027-12-31"})
    assert resp.status_code == 201, resp.text
    year = resp.json()["data"]
    resp = await admin.post(f"/api/v1/academic/years/{year['id']}/activate")
    assert resp.status_code == 200, resp.text

    resp = await admin.post("/api/v1/academic/classes", json={"name": f"DI-{suffix}", "numeric_order": 9})
    assert resp.status_code == 201, resp.text
    class_id = resp.json()["data"]["id"]

    resp = await admin.post("/api/v1/academic/sections", json={"class_id": class_id, "name": f"S-{suffix}"})
    assert resp.status_code == 201, resp.text
    section_id = resp.json()["data"]["id"]

    return {"year_id": year["id"], "class_id": class_id, "section_id": section_id}


async def _admit_student(admin, section_id: str, suffix: str) -> dict:
    resp = await admin.post(
        "/api/v1/students",
        json={
            "full_name": f"DI Student {suffix}",
            "email": f"di.student.{suffix}@codexedumine.test",
            "phone": f"01933{suffix[:6]}",
            "date_of_birth": "2016-01-01",
            "section_id": section_id,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]


# --- Soft delete -------------------------------------------------------------


async def test_soft_deleted_student_hidden_from_listing_but_row_preserved(role_clients, db_session, unique_suffix):
    admin = role_clients["admin"]
    world = await _make_year_class_section(admin, unique_suffix)
    student = await _admit_student(admin, world["section_id"], unique_suffix)
    student_id = student["id"]
    user_id = student["user_id"]

    resp = await admin.delete(f"/api/v1/students/{student_id}")
    assert resp.status_code == 200, resp.text

    resp = await admin.get("/api/v1/students", params={"search": student["admission_number"]})
    assert resp.status_code == 200
    listed_ids = {s["id"] for s in resp.json()["data"]}
    assert student_id not in listed_ids, "soft-deleted student must not appear in the active listing"

    # Row itself, and its user account, must still physically exist (soft delete only).
    row = (await db_session.execute(select(Student).where(Student.id == uuid.UUID(student_id)))).scalar_one_or_none()
    assert row is not None, "soft delete must not remove the row -- referential integrity for existing FKs depends on it"
    assert row.deleted_at is not None

    user_row = (await db_session.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
    assert user_row is not None
    assert user_row.deleted_at is not None
    assert user_row.is_active is False

    # A deactivated/soft-deleted account must not be able to log in anymore.
    resp = await admin.post(
        "/api/v1/auth/login",
        json={"identifier": student["email"] if student.get("email") else "", "password": student["temporary_password"]},
    )
    assert resp.status_code == 401, f"a soft-deleted account should not be able to log in, got {resp.status_code}"


async def test_non_principal_cannot_hard_delete(role_clients, unique_suffix):
    admin = role_clients["admin"]
    world = await _make_year_class_section(admin, unique_suffix)
    student = await _admit_student(admin, world["section_id"], unique_suffix)

    resp = await admin.delete(f"/api/v1/students/{student['id']}/hard")
    assert resp.status_code == 403


async def test_principal_hard_delete_of_student_with_no_dependents_succeeds(role_clients, db_session, unique_suffix):
    """A student with no billing/attendance/result history can be purged outright."""
    admin = role_clients["admin"]
    principal = role_clients["principal"]
    world = await _make_year_class_section(admin, unique_suffix)
    student = await _admit_student(admin, world["section_id"], unique_suffix)
    student_id = uuid.UUID(student["id"])

    resp = await principal.delete(f"/api/v1/students/{student['id']}/hard")
    assert resp.status_code == 200, resp.text

    row = (await db_session.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    assert row is None, "hard delete must physically remove the row"


async def test_hard_delete_of_student_with_invoices_is_a_clean_error_not_a_crash(role_clients, unique_suffix):
    """database.md 8 documents invoices.student_id as ON DELETE RESTRICT ("deletion
    should be blocked... handled at the application layer") -- a student with
    billing history must not be purge-able out from under their financial
    records, and the app must surface that as a normal 4xx error, not a raw
    unhandled database IntegrityError (500)."""
    admin = role_clients["admin"]
    principal = role_clients["principal"]
    world = await _make_year_class_section(admin, unique_suffix)
    student = await _admit_student(admin, world["section_id"], unique_suffix)

    resp = await admin.post("/api/v1/billing/fee-types", json={"name": f"DI-Fee-{unique_suffix}", "is_recurring": False})
    assert resp.status_code == 201, resp.text
    fee_type_id = resp.json()["data"]["id"]
    resp = await admin.put(
        "/api/v1/billing/fee-structures",
        json={"academic_year_id": world["year_id"], "class_id": world["class_id"], "items": [{"fee_type_id": fee_type_id, "amount": 500}]},
    )
    assert resp.status_code == 200, resp.text
    resp = await admin.post(
        f"/api/v1/billing/students/{student['id']}/invoices",
        json={"fee_type_ids": [fee_type_id], "due_date": str(date.today() + timedelta(days=30))},
    )
    assert resp.status_code == 201, resp.text

    resp = await principal.delete(f"/api/v1/students/{student['id']}/hard")
    assert resp.status_code in (400, 409, 422), (
        "hard-deleting a student with existing invoices must fail cleanly (blocked by FK), "
        f"got {resp.status_code}: {resp.text}"
    )


# --- Referential integrity: can't delete a class/section/subject still referenced ------


async def test_cannot_delete_section_with_active_enrollment(role_clients, unique_suffix):
    admin = role_clients["admin"]
    world = await _make_year_class_section(admin, unique_suffix)
    await _admit_student(admin, world["section_id"], unique_suffix)

    resp = await admin.delete(f"/api/v1/academic/sections/{world['section_id']}")
    assert resp.status_code in (400, 409, 422), (
        f"deleting a section with an active enrollment must be rejected, got {resp.status_code}: {resp.text}"
    )


async def test_cannot_delete_subject_referenced_by_class_subject(role_clients, unique_suffix):
    admin = role_clients["admin"]
    world = await _make_year_class_section(admin, unique_suffix)
    resp = await admin.post("/api/v1/academic/subjects", json={"name": f"DI-Subj-{unique_suffix}", "code": unique_suffix.upper()})
    assert resp.status_code == 201, resp.text
    subject_id = resp.json()["data"]["id"]

    resp = await admin.post(
        "/api/v1/academic/class-subjects",
        json={"class_id": world["class_id"], "subject_id": subject_id, "full_marks": 100},
    )
    assert resp.status_code == 201, resp.text

    resp = await admin.delete(f"/api/v1/academic/subjects/{subject_id}")
    assert resp.status_code in (400, 409, 422), (
        f"deleting a subject still assigned via class_subjects must be rejected, got {resp.status_code}: {resp.text}"
    )


# --- Approval gates -----------------------------------------------------------


async def test_expense_approval_gate(role_clients, unique_suffix):
    accountant = role_clients["accountant"]
    admin = role_clients["admin"]
    principal = role_clients["principal"]

    resp = await accountant.post("/api/v1/expenses/categories", json={"name": f"DI-Cat-{unique_suffix}"})
    # expenses.approve (not .create) gates category management -- accountant only holds .create/.view.
    assert resp.status_code == 403
    resp = await principal.post("/api/v1/expenses/categories", json={"name": f"DI-Cat-{unique_suffix}"})
    assert resp.status_code == 201, resp.text
    category_id = resp.json()["data"]["id"]

    resp = await accountant.post(
        "/api/v1/expenses",
        json={"category_id": category_id, "amount": 500, "description": "DI test expense", "expense_date": str(date.today())},
    )
    assert resp.status_code == 201, resp.text
    expense_id = resp.json()["data"]["id"]

    resp = await accountant.get(f"/api/v1/expenses/{expense_id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "pending"

    # The requester (Accountant) cannot self-approve -- only expenses.approve holders (Admin/Principal).
    resp = await accountant.post(f"/api/v1/expenses/{expense_id}/approve")
    assert resp.status_code == 403

    resp = await admin.post(f"/api/v1/expenses/{expense_id}/approve")
    assert resp.status_code == 200, resp.text

    resp = await accountant.get(f"/api/v1/expenses/{expense_id}")
    body = resp.json()["data"]
    assert body["status"] == "approved"
    assert body.get("approved_by") is not None

    # An already-approved expense cannot be approved again or rejected afterward (state machine integrity).
    resp = await admin.post(f"/api/v1/expenses/{expense_id}/approve")
    assert resp.status_code in (400, 409, 422), (
        f"re-approving an already-approved expense should be rejected, got {resp.status_code}: {resp.text}"
    )
    resp = await admin.post(f"/api/v1/expenses/{expense_id}/reject")
    assert resp.status_code in (400, 409, 422), (
        f"rejecting an already-approved expense should be rejected, got {resp.status_code}: {resp.text}"
    )


async def test_result_publish_gate_sequencing(role_clients, unique_suffix):
    """approve before compile, or publish before approve, must both be rejected --
    the compile -> approve -> publish sequence is a strict state machine."""
    admin = role_clients["admin"]
    principal = role_clients["principal"]
    world = await _make_year_class_section(admin, unique_suffix)

    resp = await admin.post(
        "/api/v1/exams",
        json={"name": f"DI Exam {unique_suffix}", "start_date": "2027-06-01", "end_date": "2027-06-05", "class_ids": [world["class_id"]]},
    )
    assert resp.status_code == 201, resp.text
    exam_id = resp.json()["data"]["id"]

    # No exam_subjects configured/submitted at all yet -- compile must refuse, not silently publish nothing.
    resp = await admin.post(f"/api/v1/results/exams/{exam_id}/compile")
    assert resp.status_code in (400, 409, 422), (
        f"compiling an exam with no configured subjects must be rejected, got {resp.status_code}: {resp.text}"
    )

    # approve/publish before compile must be rejected too.
    resp = await principal.post(f"/api/v1/results/exams/{exam_id}/approve")
    assert resp.status_code in (400, 404, 409, 422), (
        f"approving before compilation must be rejected, got {resp.status_code}: {resp.text}"
    )
    resp = await principal.post(f"/api/v1/results/exams/{exam_id}/publish")
    assert resp.status_code in (400, 404, 409, 422), (
        f"publishing before approval must be rejected, got {resp.status_code}: {resp.text}"
    )
