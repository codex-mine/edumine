from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

STORAGE_PROVIDERS = frozenset({"local", "cloudinary"})

ASYNC_DB_SCHEME = "postgresql+asyncpg"

# Schemes we accept in DATABASE_URL and rewrite to ASYNC_DB_SCHEME. Managed
# Postgres providers (Neon, Supabase, Vercel Postgres, Render, Railway) hand out
# `postgres://` or `postgresql://` strings meant for libpq; SQLAlchemy dropped
# the `postgres` dialect alias in 1.4, and even `postgresql` alone resolves to
# the *sync* psycopg driver, which create_async_engine cannot use. Normalising
# here means a copy-pasted provider URL boots instead of dying at import time.
DB_SCHEMES_TO_NORMALIZE = frozenset(
    {"postgres", "postgresql", "postgresql+asyncpg", "postgresql+psycopg", "postgresql+psycopg2"}
)

# Query parameters libpq understands but asyncpg's connect() rejects outright.
# `sslmode` is translated into asyncpg's `ssl` argument (see below); the rest
# are proxy/provider hints that carry no meaning for a direct asyncpg connection.
LIBPQ_ONLY_QUERY_KEYS = frozenset({"sslmode", "channel_binding", "pgbouncer", "options", "supa"})

# libpq sslmode -> the value asyncpg's `ssl` argument expects. asyncpg has no
# distinct "allow" mode; libpq's practical behaviour against a TLS-capable
# server is the same as "prefer", so it degrades to that.
SSLMODE_TO_ASYNCPG_SSL = {
    "disable": None,
    "allow": "prefer",
    "prefer": "prefer",
    "require": "require",
    "verify-ca": "verify-ca",
    "verify-full": "verify-full",
}


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

    # Accepts any of the schemes in DB_SCHEMES_TO_NORMALIZE — a provider's raw
    # `postgres://...?sslmode=require` string is rewritten into the asyncpg form
    # by `_normalize_database_url`, with the libpq-only query parameters lifted
    # out into `database_connect_args`.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/codex_edumine"

    # Passed to asyncpg as its `ssl` argument. Left unset it is derived from the
    # `sslmode` query parameter of DATABASE_URL, which is how every managed
    # provider expresses the same requirement.
    database_ssl: str | None = None

    # asyncpg caches server-side prepared statements per connection. Behind a
    # transaction-pooling proxy (pgbouncer, the Supabase/Neon poolers) each
    # transaction can land on a different backend, so those cached statements
    # refer to names that backend never prepared — surfacing as
    # DuplicatePreparedStatementError / InvalidSQLStatementNameError under load.
    # Left unset it is disabled automatically when a pooler is detected in the
    # URL; set it explicitly to override that guess in either direction.
    database_statement_cache: bool | None = None

    # Serverless platforms (Vercel) freeze the container between invocations, so
    # a connection parked in SQLAlchemy's pool is usually dead by the time the
    # next request thaws it, and every warm instance holds its own idle
    # connections against the provider's cap. NullPool connects per checkout and
    # leaves pooling to the provider's proxy. Keep false for a long-running server.
    database_null_pool: bool = False

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
    # Sheet upload is by far the most expensive route in the application: each
    # request decodes, aligns, and reads up to `omr_max_sheets_per_request`
    # high-resolution images, plus two Cloudinary round-trips per sheet.
    omr_upload_rate_limit: str = "20/minute"

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        """Rewrite a provider-issued Postgres URL into the form asyncpg accepts.

        Managed providers hand out libpq connection strings. Feeding one straight
        to `create_async_engine` fails at import time with
        `NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:postgres`, and
        fixing only the scheme then fails on the next line with
        `connect() got an unexpected keyword argument 'sslmode'`. Both are
        deployment faults with a single obvious correction, so we apply it rather
        than making every environment hand-edit the URL.
        """
        parts = urlsplit(self.database_url.strip())

        if parts.scheme not in DB_SCHEMES_TO_NORMALIZE:
            raise ConfigurationError(
                f"DATABASE_URL has unsupported scheme {parts.scheme!r}. Expected one of "
                f"{sorted(DB_SCHEMES_TO_NORMALIZE)} — this application talks to PostgreSQL "
                "over asyncpg."
            )

        kept_query: list[tuple[str, str]] = []
        sslmode: str | None = None
        behind_pooler = False
        for key, value in parse_qsl(parts.query, keep_blank_values=True):
            lowered = key.lower()
            if lowered == "sslmode":
                sslmode = value.strip().lower()
            elif lowered == "pgbouncer":
                behind_pooler = behind_pooler or value.strip().lower() in {"true", "1", "yes"}
            elif lowered not in LIBPQ_ONLY_QUERY_KEYS:
                kept_query.append((key, value))

        self.database_url = urlunsplit(
            parts._replace(scheme=ASYNC_DB_SCHEME, query=urlencode(kept_query))
        )

        if sslmode is not None:
            if sslmode not in SSLMODE_TO_ASYNCPG_SSL:
                raise ConfigurationError(
                    f"DATABASE_URL has unsupported sslmode={sslmode!r}. Expected one of "
                    f"{sorted(SSLMODE_TO_ASYNCPG_SSL)}."
                )
            if self.database_ssl is None:
                self.database_ssl = SSLMODE_TO_ASYNCPG_SSL[sslmode]

        if self.database_statement_cache is None:
            # Provider pooler endpoints are conventionally named: Supabase uses
            # `aws-0-<region>.pooler.supabase.com`, Neon appends `-pooler` to the
            # endpoint id. Guessing wrong only costs a little per-connection
            # planning time, whereas guessing the other way corrupts requests.
            host = (parts.hostname or "").lower()
            self.database_statement_cache = not (behind_pooler or "pooler" in host)

        return self

    @property
    def database_connect_args(self) -> dict[str, object]:
        """Driver-level arguments for `create_async_engine`, derived from DATABASE_URL."""
        args: dict[str, object] = {}
        if self.database_ssl:
            args["ssl"] = self.database_ssl
        if not self.database_statement_cache:
            # Two caches, two layers: `statement_cache_size` is asyncpg's own,
            # `prepared_statement_cache_size` is SQLAlchemy's asyncpg dialect.
            # Both must be off to be safe behind a transaction pooler.
            args["statement_cache_size"] = 0
            args["prepared_statement_cache_size"] = 0
        return args

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
