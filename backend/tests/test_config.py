import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # The form a deployment dashboard invites you to type. Previously this
        # crashed the process at import with a JSONDecodeError from
        # pydantic-settings' complex-field decoding.
        ("https://a.example.com,https://b.example.com", ["https://a.example.com", "https://b.example.com"]),
        (" https://a.example.com , https://b.example.com ", ["https://a.example.com", "https://b.example.com"]),
        ("https://a.example.com", ["https://a.example.com"]),
        ('["https://a.example.com"]', ["https://a.example.com"]),
        ("", []),
    ],
)
def test_frontend_origins_accepts_csv_and_json(monkeypatch, raw, expected):
    monkeypatch.setenv("FRONTEND_ORIGINS", raw)
    assert Settings().frontend_origins == expected


def test_frontend_origins_defaults_without_env(monkeypatch):
    monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)
    # _env_file=None so a developer's local .env cannot decide the result.
    assert Settings(_env_file=None).frontend_origins == ["http://localhost:3000"]
