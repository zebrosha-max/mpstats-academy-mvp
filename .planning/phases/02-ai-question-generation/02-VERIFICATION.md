---
phase: 02-ai-question-generation
verified: 2026-02-17T10:00:00Z
status: passed
score: 4/4 success criteria verified
gaps: []
human_verification:
  - test: "Start diagnostic session and observe that AI-generated questions differ from the fixed mock set"
    expected: "Questions are varied across runs, sourced from RAG chunks — not always the same 15 questions"
    why_human: "Cannot call live LLM in static verification; RAG data source requires runtime check"
  - test: "Trigger rate limit by calling startSession more than 50 times within one hour"
    expected: "51st call returns TRPCError with code TOO_MANY_REQUESTS and Russian error message"
    why_human: "In-memory rate limiter state cannot be inspected without running the server"
  - test: "Observe 'Готовим вопросы...' loading state timing"
    expected: "Spinner appears during the AI generation wait (up to 8-10s), not after redirect to session page"
    why_human: "UX timing gap identified — see Warnings section. Needs manual test to confirm user experience"
---

# Phase 02: AI Question Generation Verification Report

**Phase Goal:** Диагностика использует AI-генерированные вопросы из реального контента уроков, а не фиксированный набор mock
**Verified:** 2026-02-17T10:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (derived from Success Criteria in ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | При старте диагностики пользователь получает вопросы, сгенерированные из RAG chunks конкретных уроков | VERIFIED | `generateDiagnosticQuestions()` calls `supabase.from('content_chunk').or(orFilter)` per category; wired into `startSession` |
| 2 | Каждый вопрос имеет 4 варианта ответа, 1 правильный, и привязан к SkillCategory | VERIFIED | `generatedQuestionSchema`: `options: z.array(...).length(4)`, `correctIndex: 0-3`, `skillCategory` added in `toDiagnosticQuestion()` |
| 3 | Если LLM недоступен или timeout 10s, диагностика работает с fallback mock вопросами | VERIFIED | Triple fallback chain: per-category mock via `fallbackFn` callback + outer `catch` with `getBalancedQuestions()`; LLM timeout is 8s (implementation uses 8s, success criteria says 10s — see Warnings) |
| 4 | Генерация вопросов ограничена 50 req/hour | VERIFIED | `checkRateLimit(userId, 50, 3600000)` sliding window with `globalThis` persistence; TRPCError `TOO_MANY_REQUESTS` on exceed |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/ai/src/question-schema.ts` | Zod schema + JSON Schema for structured LLM output | VERIFIED | Exports `generatedQuestionSchema`, `generatedQuestionsArraySchema`, `questionJsonSchema`, `GeneratedQuestion`; all required by plan |
| `packages/ai/src/question-generator.ts` | Core generation with per-category parallel execution and model fallback | VERIFIED | 310 lines; `generateDiagnosticQuestions()`, `CATEGORY_TO_COURSES`, `MockQuestionsFn` exported; Fisher-Yates shuffle; Promise.allSettled |
| `packages/api/src/mocks/questions.ts` | 100-question fallback bank (20 per category) | VERIFIED | Exactly 100 questions confirmed (grep count); 20 per each of 5 categories; exports `getMockQuestionsForCategory`, `getBalancedQuestions`, `MOCK_QUESTIONS` |
| `scripts/seed/seed-mock-questions.ts` | Seed script for AI-regenerating mock questions | VERIFIED | File exists in `scripts/seed/` |
| `packages/api/src/routers/diagnostic.ts` | Async question generation in startSession with rate limiting and fallback | VERIFIED | `generateDiagnosticQuestions` imported from `@mpstats/ai`; rate limiter at lines 40-53; full triple fallback chain |
| `apps/web/src/app/(main)/diagnostic/session/page.tsx` | Loading state with spinner during question generation | VERIFIED | Contains "Готовим вопросы..." with spinner (lines 96-110), subtext "AI подбирает вопросы...", slow hint after 3s |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `packages/api/src/routers/diagnostic.ts` | `packages/ai/src/question-generator.ts` | `import { generateDiagnosticQuestions } from '@mpstats/ai'` | WIRED | Line 5; called in `startSession` at line 250 |
| `packages/api/src/routers/diagnostic.ts` | `packages/api/src/mocks/questions.ts` | `getMockQuestionsForCategory` passed as fallback callback | WIRED | Line 4; passed as `(category, count) => getMockQuestionsForCategory(category, count)` at line 251 |
| `packages/api/src/routers/diagnostic.ts` | Rate limiter Map | `checkRateLimit` before generation | WIRED | `generationRateLimits` stored in `globalThis.__generationRateLimits`; called at line 240 |
| `packages/ai/src/question-generator.ts` | `packages/ai/src/retrieval.ts` | `supabase.from('content_chunk').or(orFilter)` | WIRED | `supabase` imported from `./retrieval`; used in `fetchRandomChunks()` at line 247 |
| `packages/ai/src/question-generator.ts` | `packages/ai/src/openrouter.ts` | `openrouter.chat.completions.create` | WIRED | Imported at line 10; called in `callLLM()` at line 161 |
| `packages/ai/src/question-generator.ts` | `packages/ai/src/question-schema.ts` | `generatedQuestionsArraySchema.safeParse()` | WIRED | Imported at lines 14-16; Zod validation at line 201 |
| `packages/ai/src/index.ts` | question-generator + question-schema | Re-exports | WIRED | Lines 26-29 export all new symbols |

### Requirements Coverage

All 4 success criteria from ROADMAP.md are satisfied by the verified artifacts and links above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/mocks/questions.ts` | 4 | TODO comment: "Replace this file by running seed script" | Info | Informational only — mock bank IS populated with 100 real questions. Comment references optional regeneration step |

### Warnings (Not Blockers)

**1. LLM timeout is 8s, success criteria says 10s**

- `LLM_TIMEOUT_MS = 8000` in `question-generator.ts` (line 35)
- ROADMAP success criterion says "timeout 10s"
- 8s is stricter than 10s — this is a safe deviation. The fallback still triggers on any timeout. Not a goal failure.

**2. "Готовим вопросы..." message is shown on session page, not during actual AI generation**

- The actual LLM call happens in `startSession` mutation on the `/diagnostic` intro page
- During the AI generation wait (~5-8s), the intro page shows a generic "Загрузка..." button spinner
- After `startSession` completes and redirects to `/diagnostic/session`, the session page shows "Готовим вопросы..." during `getSessionState` query loading
- `getSessionState` is fast (DB read only) — the informative message appears AFTER generation is done
- The plan's intent (user sees contextual message during AI wait) is only partially achieved
- Goal is still met: diagnostic works with AI questions, rate limiting works, fallback works
- This is a UX polish issue, not a functional gap

### Human Verification Required

**1. AI Generation End-to-End**

**Test:** Start a diagnostic session with valid OPENROUTER_API_KEY, complete it, run again. Compare question texts across runs.
**Expected:** Different questions per run (LLM generates unique content from 5,291 RAG chunks); questions are in Russian; 4 options each; EASY/MEDIUM/HARD mix visible
**Why human:** Cannot execute live LLM calls in static verification

**2. Rate Limit Enforcement**

**Test:** Simulate 51 `startSession` calls for the same user within one hour (e.g., via tRPC client or Postman)
**Expected:** First 50 succeed, 51st returns `TRPCError` code `TOO_MANY_REQUESTS` with message "Слишком много запросов на диагностику. Попробуйте через час."
**Why human:** In-memory state requires running server

**3. Loading State UX**

**Test:** Click "Начать диагностику" and observe what the user sees during the ~5-8s LLM generation wait
**Expected:** Ideally "Готовим вопросы..." during the wait; actual behavior may show "Загрузка..." on intro page then "Готовим вопросы..." on session page
**Why human:** UX timing gap identified in analysis — needs manual confirmation of user experience impact

## Implementation Details

### Architecture Verified

The implementation follows the exact architecture described in PLAN 01 and PLAN 02:

- **Per-category parallel generation:** `Promise.allSettled` across 5 categories (lines 68-72 in `question-generator.ts`)
- **FINANCE fallback:** `CATEGORY_TO_COURSES.FINANCE = []` triggers immediate throw → mock substitution (lines 110-112)
- **Model fallback chain:** Primary (`MODELS.chat` = gemini-2.5-flash) → Fallback (`MODELS.fallback` = gpt-4o-mini) → throw (lines 128-145)
- **Zod validation:** `generatedQuestionsArraySchema.safeParse()` after JSON parsing (line 201)
- **Options shuffle:** Fisher-Yates on options array with correctIndex recalculation (lines 270-282)
- **Triple fallback in router:** AI generation → per-category mock (via callback) → full mock (`getBalancedQuestions`) outer catch

### Commit History Verified

All 4 commits documented in summaries exist in git log:
- `9c10958` — feat(02-01): add AI question generation service with Zod validation
- `2581b18` — feat(02-01): expand mock question bank to 100 and add seed script
- `4355667` — feat(02-02): integrate AI question generation into diagnostic router
- `f45b4eb` — feat(02-02): add AI generation loading state to diagnostic session

---

_Verified: 2026-02-17T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
