from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    from app.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await migrate_db()


async def migrate_db():
    from sqlalchemy import inspect as sa_inspect, text

    columns_to_add = [
        ("chapters", "detailed_outline", "TEXT"),
        ("knowledge_graphs", "last_updated_chapter_id", "VARCHAR(36)"),
    ]
    async with engine.begin() as conn:
        for table, column, col_type in columns_to_add:
            existing = await conn.run_sync(
                lambda sync_conn, t=table: [c["name"] for c in sa_inspect(sync_conn).get_columns(t)]
            )
            if column not in existing:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))


async def get_db():
    async with async_session() as session:
        yield session
