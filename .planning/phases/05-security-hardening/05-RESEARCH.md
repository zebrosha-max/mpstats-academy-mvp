# Phase 5: Security Hardening - Research

**Researched:** 2026-02-25
**Domain:** Web application security (auth, rate limiting, XSS prevention, error handling)
**Confidence:** HIGH

## Summary

Phase 5 hardens the existing MAAL production application for safe public traffic. The codebase currently has three unprotected AI endpoints (`getLessonSummary`, `chat`, `searchChunks`) using `publicProcedure` instead of `protectedProcedure`, a hand-rolled `formatContent` function that pipes AI-generated markdown through regex into `dangerouslySetInnerHTML` (XSS vector), no error boundaries anywhere in the app, and no service_role key leak prevention in CI.

The work splits cleanly into two plans: (1) Switch AI endpoints to `protectedProcedure` and add tRPC-level rate limiting middleware; (2) Replace `dangerouslySetInnerHTML` with `react-markdown` + `rehype-sanitize`, add error boundaries, and add a CI check for service_role key leaks.

**Primary recommendation:** Use existing tRPC middleware pattern for auth/rate limiting (no new libraries needed), add `react-markdown` + `rehype-sanitize` for safe rendering, and use Next.js App Router's built-in `error.tsx` convention for error boundaries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Все tRPC endpoints переводятся на `protectedProcedure` (без исключений)
- Публичные страницы (landing) не используют tRPC, конфликта нет
- Неавторизованный доступ к защищённой странице — тихий редирект на `/login` с `returnTo` параметром для возврата после логина
- CI скрипт сканирует `.next/` build output на наличие `service_role` key — build падает если найден
- Rate limiting реализация на уровне tRPC middleware (не Nginx)
- Лимиты по группам: AI/LLM endpoints: 50 req/hour per user; Chat messages: 20 msg/hour per user; API general: 100 req/min per user
- Хранение счётчиков: in-memory Map (достаточно для MVP с одним контейнером, сбрасывается при рестарте)
- UX при 429: toast-уведомление "Слишком много запросов. Повторите через X минут" + disable кнопок на время ожидания
- Библиотека: `react-markdown` с `rehype-sanitize` (без dangerouslySetInnerHTML)
- Разрешённые элементы: заголовки, списки, bold/italic, code blocks, таблицы
- Запрещённые: ссылки, изображения, raw HTML
- Таймкоды в AI ответах — кликабельные, по клику перематывают видео через postMessage API к Kinescope iframe
- Глобальная страница ошибки: `app/error.tsx` и `app/not-found.tsx` (кнопки "На главную" и "Повторить")
- Логирование: console.error (Sentry — потенциально позже)

### Claude's Discretion
- Гранулярность error boundaries (per-component vs per-page) — решить по анализу кода
- UX ошибки компонента (inline vs fullscreen) — решить при реализации
- Server-side валидация AI output (strip HTML или нет) — решить по анализу кода
- Конкретная библиотека для in-memory rate limiting (custom Map vs upstash/ratelimit)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | AI router endpoints используют protectedProcedure (не publicProcedure) | Direct swap: 3 endpoints in `packages/api/src/routers/ai.ts` lines 45, 93, 124 already have TODO comments to switch back |
| SEC-02 | Rate limiting на LLM endpoints (50 req/hour per user) | tRPC middleware pattern (see Architecture Patterns); existing rate limiter in `diagnostic.ts:45-53` can be extracted and reused |
| SEC-03 | Санитизация AI output — замена dangerouslySetInnerHTML на безопасный рендеринг | `react-markdown` + `rehype-sanitize` replaces `formatContent` + `dangerouslySetInnerHTML` in `learn/[id]/page.tsx` (2 usages at lines 389, 464) |
| SEC-04 | Supabase service_role key доступен только server-side (не утекает в клиент) | CI script greps `.next/static/` after build; `server-only` package import guard on `packages/ai/src/retrieval.ts` |
| SEC-05 | Error boundaries в React компонентах (diagnostic, learning, chat) | Next.js App Router `error.tsx` convention at `app/error.tsx` (global) + `app/(main)/error.tsx` (section-level) + `app/not-found.tsx` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^9.0 | Safe markdown rendering | Standard React markdown renderer; uses AST, not innerHTML; supports rehype plugins |
| rehype-sanitize | ^6.0 | HTML sanitization for markdown output | Official rehype ecosystem sanitizer; uses `hast-util-sanitize` with configurable schemas |
| server-only | ^0.0.1 | Prevent server code from leaking to client bundle | Next.js official pattern; importing this in a module causes build error if bundled client-side |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| remark-gfm | ^4.0 | GitHub Flavored Markdown (tables, strikethrough) | Needed for table rendering in AI summaries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | DOMPurify + dangerouslySetInnerHTML | DOMPurify sanitizes after HTML generation; react-markdown never generates unsafe HTML at all — safer by design |
| Custom in-memory Map | @upstash/ratelimit | Upstash adds Redis dependency; in-memory Map is sufficient for single-container MVP |

**Installation:**
```bash
pnpm add react-markdown rehype-sanitize remark-gfm server-only --filter @mpstats/web
```

## Architecture Patterns

### Pattern 1: tRPC Rate Limiting Middleware
**What:** Reusable middleware that checks in-memory sliding window counters before executing procedures
**When to use:** On all AI/LLM and chat endpoints (SEC-02)
**Source:** tRPC official docs (middleware pattern) + existing `diagnostic.ts:45-53` implementation

```typescript
// packages/api/src/middleware/rate-limit.ts
import { TRPCError } from '@trpc/server';

// Sliding window rate limiter stored in globalThis for HMR persistence
const rateLimitStore =
  ((globalThis as any).__rateLimitStore as Map<string, number[]>) ||
  new Map<string, number[]>();
(globalThis as any).__rateLimitStore = rateLimitStore;

export function createRateLimitMiddleware(
  maxRequests: number,
  windowMs: number,
  namespace: string,
) {
  return async function rateLimitMiddleware(opts: any) {
    const userId = opts.ctx.user.id;
    const key = `${namespace}:${userId}`;
    const now = Date.now();
    const timestamps = rateLimitStore.get(key) || [];
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= maxRequests) {
      const oldestInWindow = recent[0];
      const retryAfterMs = windowMs - (now - oldestInWindow);
      const retryAfterMin = Math.ceil(retryAfterMs / 60000);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: JSON.stringify({ retryAfterMs, retryAfterMin }),
      });
    }

    recent.push(now);
    rateLimitStore.set(key, recent);
    return opts.next();
  };
}
```

Then create procedure variants:
```typescript
// packages/api/src/trpc.ts
export const aiProcedure = protectedProcedure.use(
  createRateLimitMiddleware(50, 3600000, 'ai') // 50/hour
);

export const chatProcedure = protectedProcedure.use(
  createRateLimitMiddleware(20, 3600000, 'chat') // 20/hour
);
```

### Pattern 2: Safe Markdown Rendering with react-markdown
**What:** Replace `dangerouslySetInnerHTML` + regex `formatContent` with react-markdown component
**When to use:** Everywhere AI-generated content is rendered (SEC-03)
**Source:** react-markdown official docs (Context7)

```tsx
// apps/web/src/components/shared/SafeMarkdown.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br',
    'strong', 'em', 'del',
    'ul', 'ol', 'li',
    'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'sup',
  ],
  // No <a>, <img>, no raw HTML attributes
  attributes: {
    ...defaultSchema.attributes,
    code: ['className'], // for syntax highlighting class
  },
};

interface SafeMarkdownProps {
  content: string;
  className?: string;
  onTimecodeClick?: (seconds: number) => void;
}

export function SafeMarkdown({ content, className, onTimecodeClick }: SafeMarkdownProps) {
  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      allowedElements={sanitizeSchema.tagNames}
      components={{
        // Custom timecode rendering — parse [MM:SS] patterns
        // Implementation detail for planner
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

### Pattern 3: Next.js Error Boundaries (App Router)
**What:** File-convention error boundaries at route segment level
**When to use:** Global (`app/error.tsx`), section-level (`app/(main)/error.tsx`), and `app/not-found.tsx`
**Source:** Next.js official docs (Context7)

```tsx
// app/error.tsx — catches errors in ALL route segments
'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div>
      <h2>Что-то пошло не так</h2>
      <button onClick={reset}>Повторить</button>
      <a href="/">На главную</a>
    </div>
  );
}
```

**Granularity recommendation (Claude's Discretion):** Per-page error boundaries via `error.tsx` at two levels:
1. `app/error.tsx` — global fallback (catches root layout errors except root layout itself)
2. `app/(main)/error.tsx` — main section fallback (diagnostic, learning, dashboard, profile)
3. `app/global-error.tsx` — catches root layout errors (must include `<html>` and `<body>`)

Individual component-level error boundaries are NOT needed for this phase because:
- All interactive components (chat, diagnostic session) already have try/catch and error states in their UI
- Next.js `error.tsx` catches uncaught exceptions at the route level, which is sufficient
- Adding per-component React ErrorBoundary wrappers would be over-engineering for MVP

### Pattern 4: CI Service Key Leak Detection
**What:** Post-build grep in CI to detect service_role key in client bundles
**Source:** Next.js security best practices

```yaml
# Addition to .github/workflows/ci.yml build job
- name: Check for service_role key leak
  run: |
    if grep -r "SUPABASE_SERVICE_ROLE" apps/web/.next/static/ 2>/dev/null; then
      echo "ERROR: service_role key found in client bundle!"
      exit 1
    fi
    echo "OK: No service_role key in client bundle"
```

Plus, add `import 'server-only'` to `packages/ai/src/retrieval.ts` to get a build-time error if the module is ever bundled client-side.

### Anti-Patterns to Avoid
- **Regex-based HTML sanitization:** The current `formatContent` uses regex to generate HTML — this is inherently unsafe because regex cannot fully parse HTML/markdown. Use AST-based rendering (react-markdown) instead.
- **Rate limiting in Nginx only:** Nginx rate limiting is by IP, not by user. Behind proxies, all users share one IP. tRPC middleware has access to user identity.
- **Overly granular error boundaries:** Wrapping every component in ErrorBoundary creates maintenance burden without proportional safety gain. Route-level is sufficient for MVP.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown → safe HTML | Regex-based `formatContent()` | `react-markdown` + `rehype-sanitize` | Regex cannot handle all markdown edge cases; AST approach is inherently safe |
| Server-only enforcement | Manual checks | `server-only` npm package | Build-time guarantee vs runtime hope |
| Error boundary UI | Custom React class component ErrorBoundary | Next.js `error.tsx` convention | Framework handles reset, props, and integration with App Router |

**Key insight:** The current XSS risk exists because `formatContent` generates HTML strings via regex and injects them with `dangerouslySetInnerHTML`. The fix is architectural: switch to an AST-based renderer that never produces unsafe HTML in the first place.

## Common Pitfalls

### Pitfall 1: Timecode Links After Switching to react-markdown
**What goes wrong:** Current `formatContent` can embed arbitrary HTML for timecodes. After switching to react-markdown, you can't use HTML tags — need to use a custom component or remark plugin to parse timecode patterns (e.g., `[12:34 - 15:00]`) into clickable elements.
**Why it happens:** react-markdown renders markdown AST, not HTML strings. Custom interactive elements need custom components.
**How to avoid:** Use react-markdown's `components` prop to override rendering of specific patterns. Parse timecodes with a regex in the component (not in the markdown AST) — e.g., wrap content post-render, or use a remark plugin to detect timecode patterns.
**Warning signs:** Timecodes render as plain text after migration.

### Pitfall 2: Rate Limit 429 Error Not Reaching Client Properly
**What goes wrong:** tRPC `TOO_MANY_REQUESTS` error code may not map to HTTP 429 by default in all tRPC adapters. The client may see a generic error instead of a 429 with retry-after info.
**Why it happens:** tRPC uses its own error codes that map to HTTP status codes. `TOO_MANY_REQUESTS` maps to 429 in tRPC v11, but the error message JSON needs proper parsing on the client.
**How to avoid:** Structure the error message as JSON with `retryAfterMs` / `retryAfterMin` fields. On the client, catch tRPC errors, check `error.data?.code === 'TOO_MANY_REQUESTS'`, parse the message, and show the toast with the specific wait time.
**Warning signs:** Client shows generic "Something went wrong" instead of rate limit toast.

### Pitfall 3: server-only Import Location
**What goes wrong:** Adding `import 'server-only'` to the wrong file causes build failures in components that should work client-side.
**Why it happens:** The import poisons the entire module tree. If a shared utility imports a server-only module, all consumers become server-only.
**How to avoid:** Only add `import 'server-only'` to files that are exclusively server-side: `packages/ai/src/retrieval.ts` (uses `SUPABASE_SERVICE_ROLE_KEY`), `packages/ai/src/openrouter.ts` (uses `OPENROUTER_API_KEY`). Do NOT add it to barrel exports (`packages/ai/src/index.ts`) unless all exports are server-only.
**Warning signs:** Build error: "You're importing a component that needs server-only" in a page/component that should work.

### Pitfall 4: Missing globalThis Persistence for Rate Limiter
**What goes wrong:** Rate limit counters reset on every request in development because Next.js HMR creates new module scope.
**Why it happens:** Module-level variables are re-initialized on hot reload.
**How to avoid:** Store the Map in `globalThis` (same pattern already used in `diagnostic.ts` for `__generationRateLimits`). Already addressed in Pattern 1 above.
**Warning signs:** Rate limits never trigger in dev mode.

### Pitfall 5: react-markdown + rehype-sanitize Version Compatibility
**What goes wrong:** rehype-sanitize v6 requires rehype ecosystem v4+ and react-markdown v9+. Older versions are incompatible.
**Why it happens:** The rehype ecosystem migrated to ESM-only and unified types.
**How to avoid:** Install `react-markdown@^9.0.0`, `rehype-sanitize@^6.0.0`, `remark-gfm@^4.0.0` together. These are all ESM-only — Next.js 14 handles this fine with `transpilePackages`.
**Warning signs:** "Cannot find module" or "ERR_REQUIRE_ESM" errors.

## Code Examples

### Switching AI Endpoints to protectedProcedure
```typescript
// packages/api/src/routers/ai.ts — change 3 endpoints
// BEFORE:
getLessonSummary: publicProcedure.input(...)
chat: publicProcedure.input(...)
searchChunks: publicProcedure.input(...)

// AFTER:
getLessonSummary: aiProcedure.input(...)  // protectedProcedure + 50/hr rate limit
chat: chatProcedure.input(...)            // protectedProcedure + 20/hr rate limit
searchChunks: protectedProcedure.input(...) // protected, no rate limit (debug)
```

### Client-Side Rate Limit Error Handling
```typescript
// In the chat/summary component
import { toast } from '...'; // or simple alert

try {
  const result = await trpc.ai.chat.mutate({ ... });
} catch (error) {
  if (error.data?.code === 'TOO_MANY_REQUESTS') {
    const { retryAfterMin } = JSON.parse(error.message);
    toast(`Слишком много запросов. Повторите через ${retryAfterMin} мин.`);
    // Disable send button for retryAfterMs
  }
}
```

### server-only Guard
```typescript
// packages/ai/src/retrieval.ts — add at top of file
import 'server-only';
// ... rest of file that uses SUPABASE_SERVICE_ROLE_KEY
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dangerouslySetInnerHTML + DOMPurify | react-markdown + rehype-sanitize | 2023+ | AST-based rendering eliminates entire class of XSS bugs |
| Custom React ErrorBoundary class | Next.js App Router `error.tsx` convention | Next.js 13+ (2023) | Framework-managed, supports reset, streaming |
| `server-only` package | Same — still the standard | 2023 (Next.js 13.4+) | No change, stable API |

**Deprecated/outdated:**
- `@kinescope/react-kinescope-player` — already known broken (CLAUDE.md), not relevant to this phase
- Custom React class ErrorBoundary — superseded by Next.js `error.tsx` in App Router

## Open Questions

1. **Toast notification library**
   - What we know: UX decision requires toast for rate limit (429) feedback
   - What's unclear: No toast library currently in the project. Options: simple custom toast component, `sonner`, or `react-hot-toast`
   - Recommendation: Use a minimal custom toast (div + setTimeout + state) or add `sonner` (~3KB). Decision is Claude's discretion — simplest approach preferred for MVP.

2. **Timecode parsing in react-markdown**
   - What we know: Current `formatContent` doesn't specifically handle timecodes — they're rendered as `[N]` superscripts. Timecodes are rendered separately in a `TimecodeLink` component in the sources section.
   - What's unclear: Whether AI chat responses contain inline timecodes that need to be clickable within the message text (not just in sources section)
   - Recommendation: Keep timecodes in sources section only (already working with `TimecodeLink` component). If inline timecodes are needed later, add a remark plugin.

## Sources

### Primary (HIGH confidence)
- Context7 `/remarkjs/react-markdown` — configuration options, allowed/disallowed elements, rehype-sanitize recommendation
- Context7 `/trpc/trpc` — middleware pattern, protectedProcedure, rate limiting with TRPCError
- Context7 `/vercel/next.js` — error.tsx, global-error.tsx, not-found.tsx conventions

### Secondary (MEDIUM confidence)
- Codebase analysis: `packages/api/src/routers/ai.ts` — 3 endpoints using publicProcedure (lines 45, 93, 124)
- Codebase analysis: `apps/web/src/app/(main)/learn/[id]/page.tsx` — formatContent + dangerouslySetInnerHTML (lines 122-132, 389, 464)
- Codebase analysis: `packages/api/src/routers/diagnostic.ts` — existing rate limiter pattern (lines 37-53)
- Codebase analysis: `packages/ai/src/retrieval.ts` — SUPABASE_SERVICE_ROLE_KEY usage (line 18)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-markdown, rehype-sanitize, server-only are well-established, verified via Context7
- Architecture: HIGH — tRPC middleware pattern verified via Context7; Next.js error.tsx verified via Context7; existing rate limiter pattern found in codebase
- Pitfalls: HIGH — identified from codebase analysis (real code, real issues); timecode handling and version compat verified

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable ecosystem, no fast-moving changes expected)
