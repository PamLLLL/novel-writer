<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend Conventions

## Framework
- Next.js 16 with App Router (file-based routing in `src/app/`)
- React 19 with Server Components by default; add `"use client"` only when needed

## TypeScript
- Strict mode enabled; avoid `any` types
- Define interfaces/types for all props, API responses, and state

## UI Components
- shadcn/ui as component library (installed in `src/components/ui/`)
- Compose from shadcn primitives; avoid raw HTML for common patterns
- Icons via `lucide-react`

## Styling
- TailwindCSS 4 for all styling; no CSS modules or styled-components
- Dark mode via `next-themes` provider; use CSS variables for theme colors
- Responsive design with Tailwind breakpoints

## State Management
- Zustand stores in `src/stores/` for global client state
- React state (`useState`/`useReducer`) for component-local state
- No Redux or Context API for state management
