from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide configuration, sourced from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Codex Edumine API"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/codex_edumine"

    frontend_origins: list[str] = ["http://localhost:3000"]

    rate_limit_default: str = "100/minute"
    login_rate_limit: str = "10/minute"

    log_level: str = "INFO"

    jwt_secret_key: str = "843effaceabdeec0aeedc585479bbd2ec33cee8239f0bdf7c7ed269e74d0152f"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    access_token_cookie_name: str = "access_token"
    refresh_token_cookie_name: str = "refresh_token"
    session_cookie_name: str = "session_role"

    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_from_email: str | None = None
    smtp_from_name: str = "Codex Edumine"

    frontend_url: str = "http://localhost:3000"
    password_reset_token_expire_minutes: int = 30
    register_rate_limit: str = "5/minute"
    password_reset_rate_limit: str = "5/minute"

    anthropic_api_key: str | None = None

    # Generic HTTP SMS gateway (Phase 14). Leave sms_gateway_url unset to run
    # without a real provider — sends are then logged as "failed" in sms_logs
    # rather than falsely reported as delivered.
    sms_gateway_url: str | None = None
    sms_gateway_api_key: str | None = None
    sms_sender_id: str = "CodexEdumine"

    upload_dir: str = "uploads"
    upload_base_url: str = "/uploads"
    max_upload_size_mb: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
