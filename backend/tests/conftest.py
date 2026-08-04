"""Shared pytest fixtures for the Phase 16 integration/RBAC/data-integrity suite.

Runs against a dedicated `codex_edumine_test` Postgres database (never the
`codex_edumine` dev database used for manual/demo testing) so tests can freely
create, mutate, and delete data. The DATABASE_URL override below must happen
before any `app.*` module is imported, since `app.core.config.get_settings`
is `lru_cache`d on first call.
"""

import os

os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5433/codex_edumine_test"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["DEBUG"] = "false"
# This suite logs in far more than 10 times/minute (one demo account per role,
# per test module, plus freshly-created student/teacher/guardian accounts) --
# all of which share one slowapi bucket keyed by remote address, since every
# request here comes through the same ASGITransport "client". Raised for the
# test environment only; production's real LOGIN_RATE_LIMIT is untouched.
os.environ["LOGIN_RATE_LIMIT"] = "1000/minute"
# Likewise for OMR sheet upload: the OMR workflow suite posts sheets far more
# often than a real user would, and every request shares one slowapi bucket
# keyed by remote address. Production's real OMR_UPLOAD_RATE_LIMIT is untouched.
os.environ["OMR_UPLOAD_RATE_LIMIT"] = "1000/minute"

import subprocess
import sys
import uuid
from collections.abc import AsyncGenerator
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.main import app

settings = get_settings()
assert settings.database_url.endswith("codex_edumine_test"), (
    "Refusing to run tests against a non-test database: " + settings.database_url
)

BACKEND_DIR = Path(__file__).resolve().parent.parent


def pytest_configure(config: pytest.Config) -> None:
    """Reset the test database to a clean, freshly-migrated state before every
    full test run. Several tests create module-scoped data (routine slots,
    academic years, etc.) that would otherwise conflict with leftovers from a
    previous run against the same persistent Postgres database -- e.g. a
    routine slot's (teacher, day, period) uniqueness rule is global, not
    scoped to a single test run's section, so a stale slot from a prior run
    causes a false "already scheduled" conflict on the next run."""
    import asyncio

    async def _reset() -> None:
        admin_conn = await asyncpg.connect(
            "postgresql://postgres:postgres@localhost:5433/postgres"
        )
        try:
            await admin_conn.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = 'codex_edumine_test' AND pid <> pg_backend_pid()"
            )
            await admin_conn.execute("DROP DATABASE IF EXISTS codex_edumine_test")
            await admin_conn.execute("CREATE DATABASE codex_edumine_test")
        finally:
            await admin_conn.close()

    asyncio.run(_reset())

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        check=True,
        capture_output=True,
    )

DEMO_PASSWORD = "Passw0rd!123"

ROLE_EMAILS = {
    "principal": "principal@codexedumine.test",
    "admin": "admin@codexedumine.test",
    "teacher": "teacher@codexedumine.test",
    "accountant": "accountant@codexedumine.test",
    "receptionist": "receptionist@codexedumine.test",
    "staff": "staff@codexedumine.test",
    "student": "student@codexedumine.test",
    "guardian": "guardian@codexedumine.test",
}

ALL_ROLES = list(ROLE_EMAILS.keys())


@pytest_asyncio.fixture(scope="session")
async def db_session() -> AsyncGenerator:
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def anon_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


async def _login(role: str) -> AsyncClient:
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": ROLE_EMAILS[role], "password": DEMO_PASSWORD},
    )
    assert resp.status_code == 200, f"login failed for {role}: {resp.status_code} {resp.text}"
    client.headers["X-Test-Role"] = role
    return client


@pytest_asyncio.fixture(scope="session")
async def role_clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    """One authenticated AsyncClient per demo role, logged in once for the whole session."""
    clients = {role: await _login(role) for role in ALL_ROLES}
    yield clients
    for client in clients.values():
        await client.aclose()


@pytest.fixture
def unique_suffix() -> str:
    return uuid.uuid4().hex[:10]
