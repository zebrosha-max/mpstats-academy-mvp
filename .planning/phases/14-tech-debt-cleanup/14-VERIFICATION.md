---
phase: 14-tech-debt-cleanup
verified: 2026-02-27T15:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 14: Tech Debt Cleanup — Verification Report

**Phase Goal:** Устранить технический долг — мигрировать in-memory данные в DB, добавить кеширование AI вопросов и улучшить UX загрузки
**Verified:** 2026-02-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Перезапуск сервера не теряет activeSessionQuestions — данные хранятся в Supabase | VERIFIED | `DiagnosticSession.questions Json?` field in schema.prisma:64. Router reads `session.questions` from DB in `getSessionState` (line 349), `submitAnswer` (line 421), `getCurrentSession` (line 226). No `globalThis` activeSessionQuestions Map anywhere in `packages/api/src/` |
| 2 | Повторный запуск диагностики по той же категории использует ранее сгенерированные вопросы из кеша | VERIFIED | `QuestionBank` model in schema.prisma:209 with `@@unique([skillCategory])`. `getQuestionsFromBank` in `packages/api/src/utils/question-bank.ts` reads from `prisma.questionBank.findUnique` and falls back to mock. `startSession` calls `getQuestionsFromBank` (diagnostic.ts:281) instead of direct LLM call |
| 3 | При генерации AI вопросов пользователь видит progressive loading (этапы генерации, а не просто спиннер) | VERIFIED | `loadingStage` state (diagnostic/page.tsx:72). `handleStart` sets escalating messages: "Подготовка вопросов..." immediately, "Подбираем вопросы..." at 2s, "AI формирует персональный набор..." at 5s, "Почти готово, ещё немного..." at 10s (lines 95–101). Stage text shown in button (line 202) and below button (line 210) |
| 4 | Prisma version в Dockerfile определяется из package.json, а не захардкожена | VERIFIED | No `5.22.0` strings remain in Dockerfile. Dynamic collection via `find /app/node_modules/.pnpm -path '*/.prisma/client/*.so.node'` in builder stage (lines 49–51). Version-independent COPY in runner stage (lines 69–70) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema.prisma` | DiagnosticSession.questions Json field + QuestionBank model | VERIFIED | `questions Json?` on DiagnosticSession (line 64); `model QuestionBank` with TTL fields and `@@unique([skillCategory])` (lines 209–217) |
| `packages/api/src/routers/diagnostic.ts` | DB-backed session questions instead of globalThis Map | VERIFIED | Imports `getQuestionsFromBank` (line 7); `startSession` stores questions in DB (line 294); reads `session.questions` in three procedures (lines 226, 349, 421); no `activeSessionQuestions` anywhere |
| `packages/api/src/utils/question-bank.ts` | getQuestionsFromBank + refreshBankForCategory utilities | VERIFIED | New file. Exports `getQuestionsFromBank` (line 82) and `refreshBankForCategory` (line 46). TTL check, fallback to mock, non-blocking background refresh — all implemented |
| `packages/api/src/routers/admin.ts` | refreshQuestionBank admin mutation | VERIFIED | `refreshQuestionBank: adminProcedure.mutation` (line 667). Iterates all 5 categories, calls `refreshBankForCategory`, returns per-category results |
| `apps/web/src/app/(main)/diagnostic/page.tsx` | Progressive loading UI with generation stages | VERIFIED | `loadingStage` useState (line 72), escalating timeout chain (lines 98–101), stage text rendered in button and below button (lines 202, 210) |
| `Dockerfile` | Dynamic Prisma version detection via find in builder | VERIFIED | `prisma-collected` directory populated via `find` (lines 49–51); runner COPY uses `/app/prisma-collected/` (lines 69–70); no hardcoded version string |
| `packages/ai/src/question-generator.ts` | GenerateOptions interface for single-category generation | VERIFIED | `GenerateOptions` interface exported (line 48), optional `categories` and `questionsPerCategory` params (lines 49–50, 67, 76) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/diagnostic.ts` | `packages/db/prisma/schema.prisma` (DiagnosticSession.questions) | `ctx.prisma.diagnosticSession` with `questions` field | WIRED | `session.questions` read in getCurrentSession, getSessionState, submitAnswer; written in startSession via `questions: questions as any` |
| `packages/api/src/routers/diagnostic.ts` | `packages/api/src/utils/question-bank.ts` | `getQuestionsFromBank(ctx.prisma, QUESTIONS_PER_SESSION)` | WIRED | Import on line 7, called in startSession on line 281 |
| `packages/api/src/routers/admin.ts` | `packages/api/src/utils/question-bank.ts` | `refreshBankForCategory` | WIRED | Import on line 12, called inside `refreshQuestionBank` mutation loop (line 679) |
| `apps/web/src/app/(main)/diagnostic/page.tsx` | `diagnostic.startSession` tRPC mutation | `trpc.diagnostic.startSession.useMutation` with loading stages | WIRED | `startSession` mutation on line 80, called in `handleStart` on line 103 with stage timers set before call |
| `apps/web/src/app/(admin)/admin/content/page.tsx` | `admin.refreshQuestionBank` tRPC mutation | `trpc.admin.refreshQuestionBank.useMutation` | WIRED | `refreshBank` mutation on line 31, `refreshBank.mutate()` on button click (line 73); results rendered in grid (line 99–121) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEBT-01 | 14-01-PLAN.md | activeSessionQuestions из globalThis Map → Supabase | SATISFIED | `DiagnosticSession.questions Json?` field; `activeSessionQuestions` entirely removed from diagnostic.ts |
| DEBT-02 | 14-02-PLAN.md | Кеширование AI-сгенерированных вопросов в БД | SATISFIED | `QuestionBank` model with TTL; `getQuestionsFromBank` reads from DB before calling LLM |
| DEBT-03 | 14-02-PLAN.md | UX spinner timing при генерации AI вопросов | SATISFIED | Progressive loading with 4 stages and escalating timeouts (0s, 2s, 5s, 10s) |
| DEBT-04 | 14-01-PLAN.md | Hardcoded Prisma version → динамическое определение | SATISFIED | Dockerfile uses `find` to collect `.so.node` files; no `5.22.0` string remains |

All 4 requirements marked `[x]` in `REQUIREMENTS.md` Traceability table (Phase 14).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/routers/admin.ts` | 269 | `TODO: Add isActive support when field is used in access control.` | Info | Pre-existing debt, unrelated to Phase 14 scope |

No blockers or stubs found in Phase 14 modified files.

### Human Verification Required

#### 1. Question Bank population on first diagnostic start

**Test:** Start a fresh diagnostic session (or clear `QuestionBank` table in Supabase). Click "Начать диагностику".
**Expected:** Progressive loading stages appear ("Подготовка вопросов...", then "Подбираем вопросы...", etc.). Session starts with mock questions immediately; background refresh generates AI bank for future runs.
**Why human:** Background async refresh cannot be verified statically; need to observe actual console output and DB state change.

#### 2. Question bank cache hit on repeat diagnostic

**Test:** Complete a diagnostic. Check Supabase for QuestionBank rows. Start a second diagnostic immediately.
**Expected:** Second start is instant (no LLM call, questions served from DB cache). `expiresAt` is 7 days from first generation.
**Why human:** Cache hit/miss logic requires runtime DB state inspection.

#### 3. Admin force-refresh of question bank

**Test:** Log in as admin, navigate to `/admin/content`. Click "Обновить вопросы" button.
**Expected:** Button shows spinner + "Генерация...", then a 5-column result grid appears showing question counts per category (e.g., "30 вопросов" per category, green background).
**Why human:** LLM call required; needs real OpenRouter API key to generate questions.

### Gaps Summary

No gaps found. All 4 success criteria are fully implemented:

1. **DEBT-01** — `globalThis` Map for `activeSessionQuestions` is completely removed. Questions are persisted in `DiagnosticSession.questions` as a `Json?` field and read back from DB in all three procedures that need them (getCurrentSession, getSessionState, submitAnswer). Legacy sessions without the field are marked ABANDONED.

2. **DEBT-02** — `QuestionBank` model stores up to 30 AI-generated questions per skill category with a 7-day TTL. `startSession` reads from this cache via `getQuestionsFromBank`. Stale or missing bank triggers a non-blocking background refresh; mock questions supplement when the bank is empty.

3. **DEBT-03** — Diagnostic start page shows progressive loading text with 4 escalating stage labels (at 0s, 2s, 5s, 10s). Stage text appears both inside the button and as a subtitle below it. Timers are properly cleared on mutation settle (onSuccess + onError).

4. **DEBT-04** — Dockerfile no longer contains any hardcoded `5.22.0` Prisma version string. Engine binaries are collected dynamically in the builder stage and copied to a version-neutral path in the runner stage.

---
_Verified: 2026-02-27_
_Verifier: Claude (gsd-verifier)_
