"""Reflects the FastAPI route table to recover each route's RBAC guard.

`require_permission(*codes)` and `require_role(*roles)` (app/common/dependencies.py)
both return an inner function literally named `_check`, so the only way to
tell them apart is by closure free-variables: `_check` from `require_permission`
closes over `codes`, `_check` from `require_role` closes over `roles`. This
walks every route's dependant tree looking for either shape, so the RBAC
boundary test in test_rbac_boundaries.py exercises every route that declares
a guard -- without hand-maintaining a parallel list that would drift from the
routers as they change.
"""

import uuid
from dataclasses import dataclass
from typing import Literal

from fastapi.routing import APIRoute


@dataclass(frozen=True)
class RouteGuard:
    route: APIRoute
    method: str
    path: str
    kind: Literal["permission", "role"]
    codes: tuple[str, ...]

    @property
    def id(self) -> str:
        return f"{self.method} {self.path}"


def _find_guard(dependant) -> tuple[str, tuple[str, ...]] | None:
    for dep in dependant.dependencies:
        call = dep.call
        code = getattr(call, "__code__", None)
        if code is None or call.__name__ != "_check":
            continue
        freevars = code.co_freevars
        if "codes" in freevars:
            idx = freevars.index("codes")
            return "permission", call.__closure__[idx].cell_contents
        if "roles" in freevars:
            idx = freevars.index("roles")
            return "role", call.__closure__[idx].cell_contents
        # Recurse into nested sub-dependencies, in case a guard is buried deeper.
        nested = _find_guard(dep)
        if nested is not None:
            return nested
    return None


def discover_guarded_routes(app) -> list[RouteGuard]:
    guards: list[RouteGuard] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        found = _find_guard(route.dependant)
        if found is None:
            continue
        kind, codes = found
        methods = sorted((route.methods or set()) - {"HEAD", "OPTIONS"})
        for method in methods:
            guards.append(RouteGuard(route=route, method=method, path=route.path, kind=kind, codes=tuple(codes)))
    return guards


def discover_routes_under(app, prefix: str) -> list[tuple[str, str]]:
    """Every (method, path) under `prefix`, guarded or not.

    `discover_guarded_routes` can only report routes that declare a guard, so a
    route added with no guard at all would be silently skipped by the boundary
    sweep rather than failing it. Pairing the two lets a test assert that a
    whole module's surface is actually gated.
    """
    routes: list[tuple[str, str]] = []
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith(prefix):
            continue
        for method in sorted((route.methods or set()) - {"HEAD", "OPTIONS"}):
            routes.append((method, route.path))
    return routes


def fill_path(path: str) -> str:
    """Substitute every `{param}` in a route path with a fresh random UUID string.

    Path params are plain strings at the Starlette routing layer (FastAPI validates
    the UUID type afterwards, as a regular request param) so any non-slash token
    routes correctly; a real UUID additionally gives authorized callers a clean
    404 instead of a 422 on made-up IDs.
    """
    import re

    return re.sub(r"\{[^}]+\}", lambda _m: str(uuid.uuid4()), path)
