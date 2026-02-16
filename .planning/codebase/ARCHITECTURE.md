# Architecture

**Analysis Date:** 2026-02-16

## Pattern Overview

**Overall:** Vertical Slice Architecture with RAG-Enhanced Features

**Key Characteristics:**
- Monorepo with domain-separated packages (Turborepo orchestration)
- tRPC bridges frontend/backend with type-safe API contracts
- RAG (Retrieval Augmented Generation) integration for AI-powered educational content
- Session-based authentication with Supabase Auth
- Middleware-enforced route protection

## Layers

**Presentation Layer (Next.js App Router):**
- Purpose: Server-side rendering, route management, client interactions
- Location: `apps/web/src/app/`
- Contains: Pages, layouts, API routes, middleware
- Depends on: tRPC client (`apps/web/src/lib/trpc/client.ts`), Supabase client, UI components
- Used by: End users via browser

**Component Layer:**
- Purpose: Reusable UI components with design system
- Location: `apps/web/src/components/`
- Contains: shadcn/ui base components (`ui/`), domain components (`diagnostic/`, `learning/`, `charts/`), shared layout (`shared/`)
- Depends on: Tailwind CSS utilities, tRPC hooks
- Used by: All pages in presentation layer

**API Layer (tRPC):**
- Purpose: Type-safe backend procedures with authentication middleware
- Location: `packages/api/src/`
- Contains: Router definitions (`routers/`), context builder (`trpc.ts`), mock data (`mocks/`)
- Depends on: Prisma client, Supabase user context, AI package
- Used by: tRPC client in web app

**AI/RAG Layer:**
- Purpose: Vector search, embedding generation, LLM generation
- Location: `packages/ai/src/`
- Contains: OpenRouter client (`openrouter.ts`), embeddings service (`embeddings.ts`), retrieval service (`retrieval.ts`), generation service (`generation.ts`)
- Depends on: Supabase pgvector, OpenAI embeddings API, OpenRouter LLM API
- Used by: AI router (`packages/api/src/routers/ai.ts`)

**Data Layer (Prisma + Supabase):**
- Purpose: Database schema, query builder, migrations
- Location: `packages/db/`
- Contains: Prisma schema (`prisma/schema.prisma`), generated client (`src/client.ts`)
- Depends on: Supabase PostgreSQL with pgvector extension
- Used by: API layer via context injection

**Shared Layer:**
- Purpose: Cross-package types and utilities
- Location: `packages/shared/`
- Contains: TypeScript types, enums, constants
- Depends on: Nothing (pure types)
- Used by: All packages for type consistency

## Data Flow

**Authentication Flow:**

1. User submits credentials → `apps/web/src/lib/auth/actions.ts` (signIn/signUp)
2. Server action calls Supabase Auth API → session cookie set
3. Middleware (`apps/web/src/middleware.ts`) intercepts all requests
4. Middleware validates session → redirects to /login if unauthorized
5. Protected pages access user via `createClient()` from `apps/web/src/lib/supabase/server.ts`

**tRPC Request Flow:**

1. Client component calls `trpc.profile.getDashboard.useQuery()`
2. Request routed to `apps/web/src/app/api/trpc/[trpc]/route.ts`
3. Route handler creates tRPC context with user from Supabase session
4. tRPC router dispatches to appropriate procedure (e.g., `packages/api/src/routers/profile.ts`)
5. Procedure checks `protectedProcedure` middleware → throws UNAUTHORIZED if no user
6. Business logic executes with `ctx.prisma` and `ctx.user`
7. Response serialized via SuperJSON → returned to client hook

**RAG Generation Flow:**

1. User opens lesson page → `trpc.ai.getLessonSummary.useQuery({ lessonId })`
2. AI router checks in-memory cache → if miss, proceeds to generation
3. `generateLessonSummary(lessonId)` in `packages/ai/src/generation.ts` called
4. Retrieval service fetches all chunks for lesson via `getChunksForLesson()` from `packages/ai/src/retrieval.ts`
5. Supabase client queries `content_chunk` table → returns chunks ordered by timecode
6. Context built from chunks with timecode citations
7. OpenRouter LLM (gemini-2.5-flash) generates structured summary
8. Response cached in-memory (24h TTL) → returned with source citations

**Vector Search Flow (Chat):**

1. User sends chat message → `trpc.ai.chat.mutate({ lessonId, message, history })`
2. `generateChatResponse()` embeds user query via `embedQuery()` in `packages/ai/src/embeddings.ts`
3. OpenAI text-embedding-3-small API returns 1536-dim vector
4. `searchChunks()` executes Supabase RPC `match_chunks` with query vector
5. pgvector HNSW index performs cosine similarity search → returns top 5 chunks (threshold 0.3)
6. Context built from relevant chunks → LLM generates response with citations
7. Response returned with sources including timecode_start/timecode_end

**State Management:**
- Server state: tRPC queries/mutations with TanStack Query caching (stale-while-revalidate)
- Local UI state: React useState/useRef (chat messages, active tabs)
- Session state: Supabase Auth cookies (http-only, server-validated)
- Diagnostic sessions: In-memory Map (`globalThis.mockStorage`) keyed by userId (Sprint 2 MVP pattern, replaced by DB in Sprint 3+)

## Key Abstractions

**tRPC Context:**
- Purpose: Dependency injection for authenticated requests
- Examples: `packages/api/src/trpc.ts`
- Pattern: Context factory receives Supabase user → injects Prisma client + user into all procedures

**Protected Procedure:**
- Purpose: Authorization middleware for tRPC
- Examples: Used in `packages/api/src/routers/{profile,diagnostic,learning,ai}.ts`
- Pattern: Wraps procedure with user existence check → throws UNAUTHORIZED if null

**Supabase SSR Client:**
- Purpose: Server-side session validation with cookie management
- Examples: `apps/web/src/lib/supabase/server.ts`, `apps/web/src/middleware.ts`
- Pattern: Creates server client with cookie adapter → reads/writes auth cookies via Next.js cookies API

**RAG Service Composition:**
- Purpose: Separate concerns for embedding → retrieval → generation
- Examples: `packages/ai/src/{embeddings,retrieval,generation}.ts`
- Pattern: Pipeline architecture where each service has single responsibility, composed in generation layer

**Route Groups:**
- Purpose: Layout isolation without affecting URL structure
- Examples: `apps/web/src/app/(auth)/`, `apps/web/src/app/(main)/`
- Pattern: Next.js App Router feature for shared layouts per section (auth pages vs protected pages)

## Entry Points

**Web Application:**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: HTTP request to any route
- Responsibilities: Root HTML shell, global CSS, tRPC provider, font loading

**Middleware:**
- Location: `apps/web/src/middleware.ts`
- Triggers: Every HTTP request matching `/(?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*`
- Responsibilities: Session validation, auth redirects, cookie refresh

**tRPC API Handler:**
- Location: `apps/web/src/app/api/trpc/[trpc]/route.ts`
- Triggers: POST/GET to `/api/trpc/*`
- Responsibilities: tRPC request handling, context creation with user, error formatting

**Landing Page:**
- Location: `apps/web/src/app/page.tsx`
- Triggers: GET request to `/`
- Responsibilities: Public marketing page, hero, features, CTA

**Prisma Client:**
- Location: `packages/db/src/client.ts`
- Triggers: Imported by API routers via `@mpstats/db`
- Responsibilities: Singleton Prisma client with connection pooling

## Error Handling

**Strategy:** Layered error handling with user-friendly messages

**Patterns:**
- tRPC errors: `throw new TRPCError({ code: 'UNAUTHORIZED', message: '...' })` → mapped to HTTP status codes
- API route errors: Caught in `onError` callback (dev mode only) → logged with path context
- Client errors: tRPC hooks expose `error` object → displayed in UI with fallback states
- Supabase auth errors: Returned as `{ error: string }` from server actions → shown in forms
- RAG errors: Caught in generation service → fallback to empty state or error message
- Vector search errors: Logged to console → throws descriptive error up stack

## Cross-Cutting Concerns

**Logging:**
- Development: `console.log`/`console.error` with prefixes (`[AI Router]`, `[tRPC Error]`)
- Production: Same pattern (planned migration to structured logging service)
- Vector search debug: Similarity scores logged with relevance percentage

**Validation:**
- Input validation: Zod schemas in tRPC input definitions (`.input(z.object({ ... }))`)
- Auth validation: `protectedProcedure` middleware checks `ctx.user` existence
- Form validation: HTML5 attributes (required, type="email") + server-side Supabase validation
- Vector search: Threshold filtering (0.3-0.5) to ensure relevance

**Authentication:**
- Provider: Supabase Auth (email/password + Google OAuth)
- Session: JWT in http-only cookies (managed by Supabase SDK)
- Validation: Middleware → tRPC context → protectedProcedure chain
- Token refresh: Automatic via `supabase.auth.getUser()` in middleware

---

*Architecture analysis: 2026-02-16*
