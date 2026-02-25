---
phase: 05-security-hardening
verified: 2026-02-25T14:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 05: Security Hardening Verification Report

**Phase Goal:** Все endpoints защищены, AI output безопасен, приложение готово к production трафику
**Verified:** 2026-02-25T14:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Неаутентифицированный запрос к AI endpoints возвращает 401 (не выполняет LLM запрос) | VERIFIED | `protectedProcedure` проверяет `!ctx.user` → `TRPCError({ code: 'UNAUTHORIZED' })` в `trpc.ts:30-31`. `aiProcedure` и `chatProcedure` наследуют от `protectedProcedure`. Все 4 endpoint в `ai.ts` используют защищённые процедуры — `publicProcedure` отсутствует |
| 2 | LLM endpoints ограничены по rate (50 req/hour per user), при превышении — 429 | VERIFIED | `aiProcedure = protectedProcedure.use(createRateLimitMiddleware(50, 3600000, 'ai'))`, `chatProcedure` — 20/hour. Rate limiter бросает `TRPCError({ code: 'TOO_MANY_REQUESTS' })` с `retryAfterMin` в message (`rate-limit.ts:57-60`) |
| 3 | AI-генерированный markdown рендерится безопасно (нет XSS через dangerouslySetInnerHTML) | VERIFIED | `SafeMarkdown.tsx` использует `ReactMarkdown` + `rehypeSanitize` + `remarkGfm`. `allowlist`-схема блокирует `a`, `img`, script-теги. `dangerouslySetInnerHTML` отсутствует во всём `apps/web/src/` (`grep` вернул 0 результатов). Lesson page импортирует и использует `SafeMarkdown` на строках 375 и 450 |
| 4 | service_role key не присутствует в client-side bundle после build | VERIFIED | `import 'server-only'` — первая строка в `retrieval.ts` и `openrouter.ts`. CI workflow имеет шаг `Check for service_role key leak` после `pnpm build`, который `grep -r "SUPABASE_SERVICE_ROLE" apps/web/.next/static/` и завершается `exit 1` при нахождении |
| 5 | Ошибка в diagnostic/learning/chat компоненте показывает Error Boundary, а не белый экран | VERIFIED | Четыре файла error boundaries существуют и реализованы: `app/error.tsx` (глобальный), `app/global-error.tsx` (root layout с `<html><body>`), `app/(main)/error.tsx` (секция с sidebar), `app/not-found.tsx` (404). Все содержат кнопки "Повторить" (вызов `reset()`) и навигацию |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/middleware/rate-limit.ts` | Sliding window rate limiter | VERIFIED | 71 строка, экспортирует `createRateLimitMiddleware`, использует `globalThis.__rateLimitStore`, бросает `TOO_MANY_REQUESTS` с `retryAfterMin` |
| `packages/api/src/trpc.ts` | `aiProcedure` и `chatProcedure` с rate limiting | VERIFIED | Импортирует `createRateLimitMiddleware`, экспортирует `aiProcedure` (50/hour) и `chatProcedure` (20/hour) |
| `packages/api/src/routers/ai.ts` | Все endpoints на защищённых процедурах | VERIFIED | `getLessonSummary: aiProcedure`, `chat: chatProcedure`, `searchChunks: protectedProcedure`, `clearSummaryCache: protectedProcedure`. `publicProcedure` отсутствует |
| `packages/ai/src/retrieval.ts` | server-only guard | VERIFIED | `import 'server-only'` — строка 1 |
| `packages/ai/src/openrouter.ts` | server-only guard | VERIFIED | `import 'server-only'` — строка 1 |
| `apps/web/src/components/shared/SafeMarkdown.tsx` | Безопасный markdown рендерер | VERIFIED | `ReactMarkdown` + `rehypeSanitize` + `remarkGfm`, allowlist схема без `a`/`img` тегов, Tailwind-стилизованные компоненты |
| `apps/web/src/app/error.tsx` | Глобальный Error Boundary | VERIFIED | `'use client'`, "Что-то пошло не так", кнопки "Повторить" + "На главную" |
| `apps/web/src/app/global-error.tsx` | Root layout Error Boundary | VERIFIED | `'use client'`, `<html lang="ru"><body>`, inline styles, кнопки "Повторить" + "На главную" |
| `apps/web/src/app/not-found.tsx` | Кастомная 404 страница | VERIFIED | Server component, "Страница не найдена", "Запрашиваемая страница не существует", кнопка "На главную" |
| `apps/web/src/app/(main)/error.tsx` | Main section Error Boundary | VERIFIED | `'use client'`, "Ошибка загрузки", кнопки "Повторить" + "Дашборд" |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/ai.ts` | `packages/api/src/trpc.ts` | import aiProcedure, chatProcedure | WIRED | `import { router, protectedProcedure, aiProcedure, chatProcedure } from '../trpc'` — строка 10 |
| `packages/api/src/trpc.ts` | `packages/api/src/middleware/rate-limit.ts` | import createRateLimitMiddleware | WIRED | `import { createRateLimitMiddleware } from './middleware/rate-limit'` — строка 5 |
| `.github/workflows/ci.yml` | `apps/web/.next/static/` | grep SUPABASE_SERVICE_ROLE | WIRED | Шаг "Check for service_role key leak" на строке 93, после `pnpm build` |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` | `apps/web/src/components/shared/SafeMarkdown.tsx` | import SafeMarkdown | WIRED | `import { SafeMarkdown } from '@/components/shared/SafeMarkdown'` — строка 13; используется на строках 375 и 450 |
| `apps/web/src/components/shared/SafeMarkdown.tsx` | react-markdown | import ReactMarkdown | WIRED | `import ReactMarkdown from 'react-markdown'` — строка 3 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEC-01 | 05-01-PLAN.md | AI router endpoints используют protectedProcedure (не publicProcedure) | SATISFIED | `ai.ts`: `getLessonSummary: aiProcedure`, `chat: chatProcedure`, `searchChunks: protectedProcedure`, `clearSummaryCache: protectedProcedure` — `publicProcedure` отсутствует |
| SEC-02 | 05-01-PLAN.md | Rate limiting на LLM endpoints (50 req/hour per user) | SATISFIED | `aiProcedure` = 50 req/3600000ms, `chatProcedure` = 20 req/3600000ms, бросает `TOO_MANY_REQUESTS` с `retryAfterMin` |
| SEC-03 | 05-02-PLAN.md | Санитизация AI output — замена dangerouslySetInnerHTML на безопасный рендеринг | SATISFIED | `SafeMarkdown.tsx` + `rehype-sanitize` allowlist, `dangerouslySetInnerHTML` отсутствует во всём `apps/web/src/` |
| SEC-04 | 05-01-PLAN.md | Supabase service_role key доступен только server-side (не утекает в клиент) | SATISFIED | `import 'server-only'` в `retrieval.ts:1` и `openrouter.ts:1`; CI проверка после build |
| SEC-05 | 05-02-PLAN.md | Error boundaries в React компонентах (diagnostic, learning, chat) | SATISFIED | 4 error boundary файла: `app/error.tsx`, `app/global-error.tsx`, `app/(main)/error.tsx`, `app/not-found.tsx` |

Все 5 requirements из REQUIREMENTS.md для Phase 5 покрыты. Orphaned requirements отсутствуют.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/ai/src/openrouter.ts` | 19 | `'build-placeholder'` в `apiKey` fallback | Info | Не влияет на функциональность — fallback используется только во время `next build` когда env vars недоступны. Lazy initialization предотвращает реальное использование этого значения в runtime |

Блокирующих anti-pattern не обнаружено.

---

### Human Verification Required

#### 1. Rate Limit фактически блокирует 51-й запрос

**Test:** Отправить 51 последовательный запрос к `/api/trpc/ai.getLessonSummary` с аутентифицированным токеном
**Expected:** Первые 50 запросов — успешный ответ, 51-й — TRPC ошибка с кодом `TOO_MANY_REQUESTS` и `retryAfterMin` в payload
**Why human:** Нельзя проверить поведение in-memory sliding window без запуска сервера

#### 2. SafeMarkdown действительно блокирует XSS

**Test:** В чате задать вопрос, который заставит LLM ответить текстом `<a href="javascript:alert(1)">click</a>`. Проверить отрендеренный HTML в браузере
**Expected:** Тег `<a>` не рендерится в DOM — виден только текстовый контент
**Why human:** React-markdown + rehype-sanitize работают в браузерном runtime, DOM-результат нельзя проверить без запуска

#### 3. Error Boundary активируется при ошибке компонента

**Test:** Временно добавить `throw new Error("test")` в lesson page, открыть в браузере
**Expected:** Вместо белого экрана показывается "Ошибка загрузки" с кнопками "Повторить" и "Дашборд"
**Why human:** Next.js error boundary behaviour нельзя проверить статическим анализом кода

---

### Gaps Summary

Gaps отсутствуют. Все 5 observable truths полностью верифицированы на уровне кода.

---

## Commit Verification

Все коммиты из SUMMARY существуют в git:

| Коммит | Описание | Файлы |
|--------|----------|-------|
| `3ae5a0b` | Rate limit middleware + protected AI procedures | `rate-limit.ts`, `ai.ts`, `trpc.ts` |
| `ed8b9c2` | server-only guards + CI leak detection | `retrieval.ts`, `openrouter.ts`, `ci.yml` |
| `dd33a0e` | SafeMarkdown + lesson page migration | `SafeMarkdown.tsx`, `learn/[id]/page.tsx` |
| `e23418e` | Error boundaries + 404 page | `error.tsx`, `global-error.tsx`, `not-found.tsx`, `(main)/error.tsx` |

---

_Verified: 2026-02-25T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
