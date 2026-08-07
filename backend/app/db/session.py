from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

_engine_options: dict[str, object] = {
    "echo": settings.debug,
    "connect_args": settings.database_connect_args,
}
if settings.database_null_pool:
    # NullPool holds nothing between checkouts, so pre-ping would only add a
    # round-trip to a connection that was just opened.
    _engine_options["poolclass"] = NullPool
else:
    _engine_options["pool_pre_ping"] = True

engine = create_async_engine(settings.database_url, **_engine_options)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
