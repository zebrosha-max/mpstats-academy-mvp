---
phase: 02-ai-question-generation
verified: 2026-02-25T12:00:00Z
status: human_needed
score: 4/4 success criteria verified
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Start diagnostic session and observe that AI-generated questions differ from the fixed mock set"
    expected: "Questions are varied across runs, sourced from RAG chunks — not always the same 15 questions"
    why_human: "Cannot call live LLM in static verification; RAG data source requires runtime check"
  - test: "Trigger rate limit by calling startSession more than 50 times within one hour"
    expected: "51st call returns TRPCError with code TOO_MANY_REQUESTS and Russian error message"
    why_human: "In-memory rate limiter state cannot be inspected without running the server"
  - test: "Observe 'Готовим вопросы...' loading state timing"
    expected: "Spinner appears during the AI generation wait (up to 8-10s), not after redirect to session page"
    why_human: "UX timing gap identified — loading message appears on session page AFTER generation completes, not during the actual LLM call"
---

# Phase 02: AI Question Generation Verification Report

**Phase Goal:** Диагностика использует AI-генерированные вопросы из реального контента уроков, а не фиксированный набор mock
**Verified:** 2026-02-25T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after initial verification (2026-02-17, status: passed)

## Re-Verification Summary

Previous status was `passed` with no gaps. This re-verification confirms:
- All 4 previously verified artifacts still exist and are substantive
- All 4 previously verified key links still wired
- One additional commit `f8b3003` (2026-02-18) added prompt quality improvements — no regressions introduced
- REQUIREMENTS.md status column still shows "Pending" for AIGEN-01..05 — documentation gap only, not a code gap
- No new gaps found; human verification items carried forward unchanged

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | При старте диагностики пользователь получает вопросы, сгенерированные из RAG chunks конкретных уроков | VERIFIED | `generateDiagnosticQuestions()` queries `content_chunk` via `supabase.from('content_chunk').or(orFilter)` per category; wired into `startSession` at line 250 of `diagnostic.ts` |
| 2 | Каждый вопрос имеет 4 варианта ответа, 1 правильный, и привязан к SkillCategory | VERIFIED | `generatedQuestionSchema`: `options: z.array(...).length(4)`, `correctIndex: z.number().min(0).max(3)`, `skillCategory` set in `toDiagnosticQuestion()` |
| 3 | Если LLM недоступен или timeout 10s, диагностика работает с fallback mock вопросами | VERIFIED | Triple fallback: per-category mock via `fallbackFn` callback + outer `catch` with `getBalancedQuestions()`; LLM timeout 8s (stricter than required 10s — safe deviation) |
| 4 | Генерация вопросов ограничена 50 req/hour | VERIFIED | `checkRateLimit(userId, 50, 3600000)` sliding window; `TRPCError TOO_MANY_REQUESTS` on exceed; persisted in `globalThis.__generationRateLimits` |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/ai/src/question-schema.ts` | Zod schema + JSON Schema for structured LLM output | VERIFIED | Exports `generatedQuestionSchema`, `generatedQuestionsArraySchema`, `questionJsonSchema`, `GeneratedQuestion`; 94 lines |
| `packages/ai/src/question-generator.ts` | Core generation with per-category parallel execution and model fallback | VERIFIED | 318 lines; `generateDiagnosticQuestions()`, `CATEGORY_TO_COURSES`, `MockQuestionsFn` exported; Fisher-Yates shuffle; Promise.allSettled |
| `packages/api/src/mocks/questions.ts` | 100-question fallback bank (20 per category) | VERIFIED | 1419 lines; 100 `question:` entries confirmed; exports `getMockQuestionsForCategory`, `getBalancedQuestions`, `MOCK_QUESTIONS` |
| `scripts/seed/seed-mock-questions.ts` | Seed script for AI-regenerating mock questions | VERIFIED | File exists; updated in f8b3003 with batch generation logic |
| `packages/api/src/routers/diagnostic.ts` | Async question generation in startSession with rate limiting and fallback | VERIFIED | `generateDiagnosticQuestions` imported at line 5; rate limiter at lines 40-53; full triple fallback at lines 247-258 |
| `apps/web/src/app/(main)/diagnostic/session/page.tsx` | Loading state with spinner during question generation | VERIFIED | "Готовим вопросы..." spinner with "AI подбирает вопросы на основе учебных материалов" subtext; slow hint after 3s |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `packages/api/src/routers/diagnostic.ts` | `packages/ai/src/question-generator.ts` | `import { generateDiagnosticQuestions } from '@mpstats/ai'` | WIRED | Line 5; called in `startSession` at line 250 |
| `packages/api/src/routers/diagnostic.ts` | `packages/api/src/mocks/questions.ts` | `getMockQuestionsForCategory` passed as fallback callback | WIRED | Line 4; passed as `(category, count) => getMockQuestionsForCategory(category, count)` at line 251 |
| `packages/api/src/routers/diagnostic.ts` | Rate limiter Map | `checkRateLimit` before generation | WIRED | `generationRateLimits` in `globalThis.__generationRateLimits`; called at line 240 |
| `packages/ai/src/question-generator.ts` | `packages/ai/src/retrieval.ts` | `supabase.from('content_chunk').or(orFilter)` | WIRED | `supabase` imported from `./retrieval`; used in `fetchRandomChunks()` at line 255 |
| `packages/ai/src/question-generator.ts` | `packages/ai/src/openrouter.ts` | `openrouter.chat.completions.create` | WIRED | Imported at line 10; called in `callLLM()` at line 161 |
| `packages/ai/src/question-generator.ts` | `packages/ai/src/question-schema.ts` | `generatedQuestionsArraySchema.safeParse()` | WIRED | Imported at lines 13-16; Zod validation at line 201 |
| `packages/ai/src/index.ts` | question-generator + question-schema | Re-exports | WIRED | Lines 26-29 export all question generation symbols |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| AIGEN-01 | Сервис генерирует diagnostic вопросы из RAG chunks через LLM (4 варианта, 1 правильный) | SATISFIED | `question-generator.ts` fetches `content_chunk`, calls LLM via OpenRouter, enforces `options.length(4)` via Zod |
| AIGEN-02 | Валидация структуры сгенерированных вопросов (Zod schema) | SATISFIED | `question-schema.ts` exports Zod + JSON Schema; `safeParse()` called before any question is used |
| AIGEN-03 | Fallback на mock вопросы если LLM недоступен или timeout (10s) | SATISFIED | Triple fallback chain in `diagnostic.ts`: per-category via callback + outer `catch` with `getBalancedQuestions` |
| AIGEN-04 | Вопросы привязаны к SkillCategory через lesson_id маппинг | SATISFIED | `CATEGORY_TO_COURSES` maps each `SkillCategory` to course prefixes; `toDiagnosticQuestion()` sets `skillCategory` field |
| AIGEN-05 | Rate limiting для генерации вопросов (50 req/hour) | SATISFIED | `checkRateLimit(userId, 50, 3600000)` sliding window in `diagnostic.ts` lines 45-53 |

**Note:** REQUIREMENTS.md status column still shows "Pending" for all AIGEN-* items — this is a documentation tracking gap, not a code issue. The implementation satisfies all 5 requirements.

---

### Post-Verification Changes

| Commit | Date | Files Changed | Impact |
|--------|------|---------------|--------|
| `f8b3003` | 2026-02-18 | `question-generator.ts`, `seed-mock-questions.ts`, new export scripts | Prompt quality improvement — added ЗАПРЕЩЕНО section to prevent irrelevant questions. No functional regression. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/mocks/questions.ts` | 4 | TODO comment: "Replace this file by running seed script" | Info | Mock bank IS populated with 100 real questions. Comment references optional regeneration step only |

---

### Warnings (Not Blockers)

**1. LLM timeout is 8s, success criteria says 10s**

- `LLM_TIMEOUT_MS = 8000` in `question-generator.ts` (line 35)
- ROADMAP success criterion says "timeout 10s"
- 8s is stricter than 10s — fallback still triggers on any timeout. Not a goal failure.

**2. "Готовим вопросы..." message appears after AI generation, not during**

- The actual LLM call happens in `startSession` mutation on the `/diagnostic` intro page
- During the AI generation wait (~5-8s), the intro page shows a generic button spinner
- After redirect to `/diagnostic/session`, the session page shows "Готовим вопросы..." during `getSessionState` query (fast DB read only)
- The informative message appears AFTER generation is already done
- Goal is still met: diagnostic works with AI questions, rate limiting works, fallback works
- This is a UX polish issue, not a functional gap

**3. REQUIREMENTS.md status column not updated**

- All AIGEN-01..05 rows show "Pending" in the status tracker table
- Implementation is complete and verified
- Recommend updating REQUIREMENTS.md to mark these as "Done"

---

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
**Expected:** Ideally "Готовим вопросы..." during the wait; actual behavior likely shows generic "Загрузка..." on intro page then "Готовим вопросы..." on session page
**Why human:** UX timing gap identified in analysis — needs manual confirmation of user experience impact

---

## Architecture Verified

The implementation follows the exact architecture described in PLAN 01 and PLAN 02:

- **Per-category parallel generation:** `Promise.allSettled` across 5 categories
- **FINANCE fallback:** `CATEGORY_TO_COURSES.FINANCE = []` triggers immediate throw → mock substitution
- **Model fallback chain:** Primary (`MODELS.chat` = gemini-2.5-flash) → Fallback (`MODELS.fallback` = gpt-4o-mini) → throw
- **Zod validation:** `generatedQuestionsArraySchema.safeParse()` after JSON parsing
- **Options shuffle:** Fisher-Yates on options array with correctIndex recalculation
- **Triple fallback in router:** AI generation → per-category mock (via callback) → full mock (`getBalancedQuestions`) outer catch

## Commit History Verified

All 4 original commits documented in summaries exist in git log:
- `9c10958` — feat(02-01): add AI question generation service with Zod validation
- `2581b18` — feat(02-01): expand mock question bank to 100 and add seed script
- `4355667` — feat(02-02): integrate AI question generation into diagnostic router
- `f45b4eb` — feat(02-02): add AI generation loading state to diagnostic session

Post-verification improvement commit also present:
- `f8b3003` — fix(02): improve question generation prompt and add CSV export

---

_Verified: 2026-02-25T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification of: 2026-02-17T10:00:00Z (initial, status: passed)_
