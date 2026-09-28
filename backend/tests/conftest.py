import pytest
from fakeredis import FakeAsyncRedis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.rate_limit import RateLimiter
from app.main import app
from app.models import Base
from app.services.cache import CacheLayer

TEST_DB_URL = "postgresql+asyncpg://trakplus:trakplus@localhost:5433/trakplus_test"
ADMIN_URL = "postgresql://trakplus:trakplus@localhost:5433/postgres"


@pytest.fixture
async def fake_redis():
    client = FakeAsyncRedis(decode_responses=True)
    yield client
    await client.aclose()


@pytest.fixture
async def cache(fake_redis):
    return CacheLayer(fake_redis)


@pytest.fixture
async def db_engine():
    """Integration-test database (trakplus_test on the compose Postgres).

    Uses create_all/drop_all (not Alembic) for speed; the migration chain
    itself is verified against the dev DB separately.
    """
    import asyncpg

    admin = await asyncpg.connect(ADMIN_URL)
    try:
        exists = await admin.fetchval("SELECT 1 FROM pg_database WHERE datname = 'trakplus_test'")
        if not exists:
            await admin.execute("CREATE DATABASE trakplus_test")
    finally:
        await admin.close()

    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        # SQLAlchemy create_all emits CREATE TYPE unconditionally for native enums;
        # clear leftovers from previous runs first.
        for enum_name in ("media_type", "library_status", "offer_type"):
            await conn.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine) -> AsyncSession:
    maker = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        yield session


@pytest.fixture
async def api_client(db_session, fake_redis):
    """HTTPX client hitting the FastAPI app with get_db overridden to the test DB.

    The auth rate limiter is rebound to a fresh FakeAsyncRedis with the limit
    disabled so suite tests are never throttled; rate-limit tests re-enable it.
    """
    from app.core.rate_limit import get_limiter

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_limiter] = lambda: RateLimiter(fake_redis, limit_per_minute=0)
    from httpx import ASGITransport, AsyncClient

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


_PASSWORD = "supersecret123"


async def _register_and_login(api_client, email: str) -> dict[str, str]:
    resp = await api_client.post("/auth/register", json={"email": email, "password": _PASSWORD})
    assert resp.status_code == 201, resp.text
    resp = await api_client.post("/auth/login", data={"username": email, "password": _PASSWORD})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def user_a_headers(api_client) -> dict[str, str]:
    import uuid

    return await _register_and_login(api_client, f"user-a-{uuid.uuid4().hex[:8]}@test.dev")


@pytest.fixture
async def user_b_headers(api_client) -> dict[str, str]:
    import uuid

    return await _register_and_login(api_client, f"user-b-{uuid.uuid4().hex[:8]}@test.dev")
