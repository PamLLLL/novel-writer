# API Layer Conventions

## Router Structure
- One `APIRouter` per module in `api/routes/` (e.g., projects, chapters, generation)
- Route prefix and tags set when including router in `main.py`
- Keep route handlers thin: validate input, call service, return response

## Dependency Injection
- Database session via `db: AsyncSession = Depends(get_db)`
- Shared dependencies defined in `api/deps.py`

## Streaming Endpoints
- AI generation endpoints return `EventSourceResponse` for SSE
- Stream events as JSON-encoded strings with event type fields

## Error Responses
- Use `HTTPException` with appropriate status codes:
  - `404` for not found, `400` for bad request, `422` for validation errors
- Include descriptive `detail` messages for debugging

## Request/Response
- Use Pydantic schemas from `app/schemas/` for typed request bodies and responses
- Path parameters for resource IDs, query parameters for filters/pagination
