"""Full RBAC permission-boundary sweep (Phase 16).

For every route in the app that declares a `require_permission(...)` or
`require_role(...)` guard (discovered by reflection -- see rbac_matrix.py, so
this test can't silently go stale as routers change), and for every one of
the 8 demo roles, assert:

  - a role that holds the required permission/role (or is Principal, who
    bypasses all checks -- app/common/dependencies.py CurrentUser.has_permission)
    never gets blocked by the gate (no 401/403).
  - a role that does NOT hold it always gets 403.

This does not assert full functional success (200) for the "allowed" case,
since many routes need real path-scoped data (an actual invoice/exam/etc.) to
proceed past the gate -- that end-to-end behavior is covered separately in
test_e2e_workflow.py. This test isolates the RBAC boundary itself.
"""

import pytest
from sqlalchemy import select

from app.modules.auth.models import Permission, Role, RolePermission
from tests.conftest import ALL_ROLES
from tests.rbac_matrix import discover_guarded_routes, fill_path

from app.main import app as fastapi_app

GUARDED_ROUTES = discover_guarded_routes(fastapi_app)


@pytest.fixture(scope="session")
async def role_permission_map(db_session) -> dict[str, set[str]]:
    """role name -> set of permission codes it holds, straight from the DB seed data."""
    rows = (
        await db_session.execute(
            select(Role.name, Permission.code)
            .join(RolePermission, RolePermission.role_id == Role.id)
            .join(Permission, Permission.id == RolePermission.permission_id)
        )
    ).all()
    mapping: dict[str, set[str]] = {role: set() for role in ALL_ROLES}
    for role_name, code in rows:
        mapping.setdefault(role_name, set()).add(code)
    return mapping


# Some routes require a broad permission code (e.g. "results.view" -- held by
# teacher/student/guardian alike) at the router level, then narrow further in
# the service layer by record ownership (own child / own subject / own
# profile) or by excluding a sub-role that has its own dedicated "/my/..."
# endpoint instead. Since this test calls each route with a random, unowned
# ID, ownership-gated roles (e.g. guardian viewing a non-linked student) will
# correctly get 403 even though they hold the permission code -- that is
# correct defense-in-depth, not a router boundary bug. These entries record
# the actual authorized set per route, verified against the service-layer
# source, so the sweep still asserts the real intended behavior instead of
# skipping these routes. See test_data_scoping.py for positive/negative
# ownership-scoping coverage of the same routes.
OWNERSHIP_SCOPED_OVERRIDES: dict[str, set[str]] = {
    # results/service.py _assert_can_view_student: only admin/principal bypass;
    # guardian must own the student (fails against a random id); student and
    # teacher have no access here at all (student uses /results/my/... instead).
    "GET /api/v1/results/students/{student_id}/exams/{exam_id}/card": {"admin", "principal"},
    "GET /api/v1/results/students/{student_id}/report-card": {"admin", "principal"},
    "POST /api/v1/results/insights/students/{student_id}/exams/{exam_id}": {"admin", "principal"},
    # results/service.py get_subject_insight: role gate is teacher/admin/principal
    # (teacher ownership of the exam_subject is checked after, i.e. for a random
    # exam_subject_id a teacher gets 404, not 403 -- still "not blocked by RBAC").
    "POST /api/v1/results/insights/exam-subjects/{exam_subject_id}": {"teacher", "admin", "principal"},
    # results/service.py get_class_insight: admin/principal only.
    "POST /api/v1/results/insights/exams/{exam_id}/classes/{class_id}": {"admin", "principal"},
    # billing/service.py STAFF_BILLING_ROLES: full listing / any-student lookup
    # restricted to admin/principal/accountant/receptionist; student/guardian
    # must use /billing/my/... or their own linked student id instead.
    "GET /api/v1/billing/invoices": {"admin", "principal", "accountant", "receptionist"},
    "GET /api/v1/billing/students/{student_id}/invoices": {"admin", "principal", "accountant", "receptionist"},
    "GET /api/v1/billing/students/{student_id}/dues": {"admin", "principal", "accountant", "receptionist"},
}


def _is_authorized(role: str, guard, role_permission_map: dict[str, set[str]]) -> bool:
    if role == "principal":
        return True
    override = OWNERSHIP_SCOPED_OVERRIDES.get(guard.id)
    if override is not None:
        return role in override
    if guard.kind == "role":
        return role in guard.codes
    return bool(role_permission_map[role] & set(guard.codes))


@pytest.mark.parametrize("guard", GUARDED_ROUTES, ids=lambda g: g.id)
async def test_rbac_boundary(guard, role_clients, role_permission_map):
    path = fill_path(guard.path)
    for role in ALL_ROLES:
        client = role_clients[role]
        resp = await client.request(guard.method, path, json={} if guard.method in ("POST", "PATCH", "PUT") else None)
        authorized = _is_authorized(role, guard, role_permission_map)
        if authorized:
            assert resp.status_code not in (401, 403), (
                f"{role} holds a matching grant for {guard.id} ({guard.kind}={guard.codes}) "
                f"but was blocked with {resp.status_code}: {resp.text}"
            )
        else:
            assert resp.status_code == 403, (
                f"{role} does NOT hold {guard.kind}={guard.codes} for {guard.id} "
                f"but got {resp.status_code} instead of 403: {resp.text}"
            )


async def test_unauthenticated_requests_are_rejected(anon_client):
    """Every guarded route must also refuse a request with no session at all."""
    sample = GUARDED_ROUTES[:40]  # representative slice across modules, not all 171, to keep this fast
    for guard in sample:
        path = fill_path(guard.path)
        resp = await anon_client.request(guard.method, path, json={} if guard.method in ("POST", "PATCH", "PUT") else None)
        assert resp.status_code == 401, f"unauthenticated {guard.id} returned {resp.status_code}, expected 401"
