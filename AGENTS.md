# MoYun (墨韵) - Global Conventions

## Project Overview
MoYun is an AI-powered novel writing assistant that helps authors with worldbuilding, character creation, outlining, and chapter generation.

## Tech Stack
- **Backend:** FastAPI (Python 3.12+), SQLAlchemy 2.0 async, aiosqlite
- **Frontend:** Next.js 16, React 19, TypeScript strict, TailwindCSS 4

## Code Style
- Python: type hints on all function signatures, `async def` preferred
- TypeScript: strict mode enabled, no `any` unless unavoidable
- Imports: stdlib first, third-party second, local third (isort order)

## Git Workflow
- Commit prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- One logical change per commit, keep commits small and focused

## Error Handling
- Backend: raise `HTTPException` with meaningful status codes and detail messages
- Frontend: catch errors at component boundaries, show user-friendly messages
- Never swallow exceptions silently; always log or propagate
