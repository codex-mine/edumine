from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

STORAGE_PROVIDERS = frozenset({"local", "cloudinary"})


class ConfigurationError(RuntimeError):
    """Raised during startup when configuration is missing or self-inconsistent.

    Deliberately not an `AppException` — this is a deployment/config fault raised
    while `Settings` is being constructed, long before any request exists to map
    it onto an HTTP error envelope. Surfacing it at startup is the point: the
    process must refuse to boot rather than fail on the first upload.
    """


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

    # File storage backend. "local" writes under `upload_dir` and serves the files
    # back through the StaticFiles mount in app.main; "cloudinary" pushes them to
    # Cloudinary and returns its secure URLs. The Cloudinary credentials below are
    # required only when that provider is selected — see `_validate_storage`.
    storage_provider: str = "local"
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None
    cloudinary_folder: str = "codex-edumine"

    upload_dir: str = "uploads"
    upload_base_url: str = "/uploads"
    max_upload_size_mb: int = 10

    # OMR sheet scanning. `omr_template_name` selects a calibrated bubble template
    # from app/modules/omr/templates/; batches snapshot it so a second school's
    # sheet layout can be added without a migration. Sheets are processed
    # synchronously (~1s each), so the per-request cap bounds how long an upload
    # can hold a request open.
    omr_template_name: str = "plus_coaching_template"
    omr_max_sheets_per_request: int = 20
    omr_save_annotated_images: bool = True

    @model_validator(mode="after")
    def _validate_storage(self) -> "Settings":
        provider = self.storage_provider.strip().lower()
        if provider not in STORAGE_PROVIDERS:
            raise ConfigurationError(
                f"STORAGE_PROVIDER must be one of {sorted(STORAGE_PROVIDERS)}, "
                f"got {self.storage_provider!r}."
            )
        self.storage_provider = provider

        if provider == "cloudinary":
            missing = [
                name
                for name, value in (
                    ("CLOUDINARY_CLOUD_NAME", self.cloudinary_cloud_name),
                    ("CLOUDINARY_API_KEY", self.cloudinary_api_key),
                    ("CLOUDINARY_API_SECRET", self.cloudinary_api_secret),
                )
                if not (value or "").strip()
            ]
            if missing:
                raise ConfigurationError(
                    "STORAGE_PROVIDER is set to 'cloudinary' but "
                    f"{', '.join(missing)} {'is' if len(missing) == 1 else 'are'} not set. "
                    "Add the missing value(s) to the environment/.env, or set "
                    "STORAGE_PROVIDER=local to store uploads on the local disk instead."
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
