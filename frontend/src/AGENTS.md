# Frontend Source Structure

## Directory Layout
- `app/` - Next.js page routes and layouts (App Router)
- `components/` - reusable UI components; `components/ui/` for shadcn primitives
- `hooks/` - custom React hooks
- `lib/` - utilities, API client, type definitions
- `providers/` - React context providers (theme, etc.)
- `stores/` - Zustand state stores

## API Client
- Centralized in `lib/api-client.ts`; all backend calls go through this module
- Base URL configured for FastAPI backend
- Returns typed responses matching backend schemas

## Types
- Shared type definitions in `lib/types.ts`
- Keep types in sync with backend Pydantic schemas

## SSE / Streaming
- `hooks/use-sse.ts` provides a reusable hook for consuming SSE streams
- Used for real-time AI generation progress and content streaming

## Stores
- One Zustand store per domain (e.g., project store, UI store)
- Export typed hooks: `useProjectStore`, `useUIStore`, etc.
