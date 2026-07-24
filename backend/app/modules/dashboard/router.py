"""Per-role dashboard shells (Phase 3 scope: gating only — no widgets/data yet)."""

from fastapi import APIRouter, Depends

from app.common.dependencies import CurrentUser, require_role
from app.core.response import success_response

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# One route per role from database.md's `roles.name` enumeration. Each is gated
# so only its own role (or Principal, who has full system authority) may load it.
ROLE_SLUGS = [
    "principal",
    "admin",
    "teacher",
    "accountant",
    "receptionist",
    "staff",
    "student",
    "guardian",
]


def _make_shell_route(role_slug: str) -> None:
    @router.get(f"/{role_slug}", name=f"dashboard_{role_slug}")
    async def _shell(current_user: CurrentUser = Depends(require_role(role_slug))):
        return success_response(
            data={"role": role_slug, "widgets": []},
            message="Dashboard shell loaded",
        )


for _slug in ROLE_SLUGS:
    _make_shell_route(_slug)
