# Backend Conventions

## Framework
- FastAPI with async-first design; all route handlers and service functions are `async def`
- ASGI server via uvicorn

## Database
- SQLAlchemy 2.0 async with `AsyncSession` and aiosqlite driver
- Session managed via `async_sessionmaker`, injected through `Depends(get_db)`
- Alembic not used; tables created on startup via `Base.metadata.create_all`

## Architecture (Layered)
1. **Routes** (`app/api/routes/`) - HTTP handling, request/response, status codes
2. **Services** (`app/services/`) - business logic, AI orchestration
3. **Models** (`app/models/`) - ORM definitions and database schema

## Validation
- Pydantic v2 models in `app/schemas/` for request/response validation
- Use `model_validate()` for ORM-to-schema conversion

## Streaming
- SSE streaming via `sse-starlette.EventSourceResponse`
- Stream AI-generated content as JSON-encoded events
