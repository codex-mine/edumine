from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application-wide configuration, sourced from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Codex Edumine API"
    environment: str = "development"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/codex_edumine"

    frontend_origins: list[str] = ["http://localhost:3000"]

    rate_limit_default: str = "100/minute"

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
