# Services Conventions

## Function Signatures
- All service functions are `async def`
- Receive `db: AsyncSession` as parameter; never create sessions internally
- Return ORM model instances (not Pydantic schemas)

## AI Integration
- Get AI provider via `registry.get_provider(provider_name, model, api_key)`
- Use `provider.generate()` for full responses, `provider.stream_generate()` for SSE
- Prompt construction and parsing logic lives in services

## Business Logic
- Services contain domain logic: validation rules, generation workflows, data transforms
- Keep data access (queries, inserts) separate from business decisions
- One service file per domain area (project, generation, knowledge, settings, steps)

## Error Handling
- Raise `HTTPException` for client errors (not found, bad input)
- Let unexpected exceptions propagate to FastAPI's default error handler
- Log important operations and failures

## Transactions
- The caller (route handler) manages the session lifecycle
- Services call `db.flush()` when needed but avoid `db.commit()` directly
