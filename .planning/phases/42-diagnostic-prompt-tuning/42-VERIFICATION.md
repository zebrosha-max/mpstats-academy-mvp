---
phase: 42-diagnostic-prompt-tuning
verified: 2026-03-27T13:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Запустить диагностическую сессию и проверить 15 вопросов"
    expected: "Вопросы практические, корректные рубрики, правдоподобные варианты ответов, указание WB/Ozon где нужно"
    why_human: "Качество LLM-генерации нельзя проверить статически — нужен реальный прогон с оценкой эксперта (Мила)"
---

# Phase 42: Diagnostic Prompt Tuning — Verification Report

**Phase Goal:** AI генерирует релевантные, профессиональные вопросы с корректными рубриками.
**Verified:** 2026-03-27T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System prompt содержит правила маппинга тем к осям (SEO→Маркетинг, бюджет→Финансы и т.д.) | ✓ VERIFIED | Строки 265–274: секция `## ПРАВИЛА ВЫБОРА РУБРИКИ` с 6 маппингами тем→рубрик |
| 2 | System prompt запрещает вопросы о курсе, сертификатах, плагинах, биддере | ✓ VERIFIED | Строки 315–318: `❌ Сертификаты курса...`, `❌ Плагины...инструменты МПСТАТС (биддер, парсер)`, `❌ Цели или структура самого курса` |
| 3 | System prompt требует правдоподобные варианты ответов без абсурда | ✓ VERIFIED | Строки 290–295: секция `## КАЧЕСТВО ВАРИАНТОВ ОТВЕТА` — плохие дистракторы и абсурдные варианты запрещены |
| 4 | System prompt требует указание МП (WB/Ozon) для платформенно-специфичных вопросов | ✓ VERIFIED | Строки 297–300: секция `## КОНТЕКСТ ПЛОЩАДКИ` — "обязательно укажи: Wildberries или Ozon" |
| 5 | System prompt запрещает выдуманные термины | ✓ VERIFIED | Строка 305: "Не придумывай новых понятий. Если не уверен в термине — замени на описательную формулировку." |
| 6 | System prompt требует практические вопросы про алгоритм действий | ✓ VERIFIED | Строка 307: "Предпочитай вопросы про алгоритм действий и практические решения." |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/ai/src/question-generator.ts` | Updated buildSystemPrompt with 6 rule blocks from Mila review, contains "ПРАВИЛА ВЫБОРА РУБРИКИ" | ✓ VERIFIED | Функция lines 260–332, 72 строки, все 6 блоков правил присутствуют |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/ai/src/question-generator.ts` | LLM API call | `buildSystemPrompt()` return value passed to `callLLM()` | ✓ WIRED | Line 178: `const systemPrompt = buildSystemPrompt(category, count)`. Lines 187 и 215: передаётся как `{ role: 'system', content: systemPrompt }` — в обоих путях (json_schema и json_object fallback) |

### Data-Flow Trace (Level 4)

Артефакт — функция `buildSystemPrompt`, не UI-компонент. Data-flow trace не применяется (нет рендеринга динамических данных).

Поток вызова: `generateDiagnosticQuestions()` → `generateQuestionsForCategory()` → `callLLM()` → `buildSystemPrompt()` → LLM API. Цепочка полностью прослеживается в файле.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Все 6 ключевых строк присутствуют в файле | `grep -c "ПРАВИЛА ВЫБОРА РУБРИКИ\|КАЧЕСТВО ВАРИАНТОВ\|Wildberries или Ozon\|Не придумывай\|алгоритм действий\|Сертификаты курса"` | 6/6 matches | ✓ PASS |
| buildSystemPrompt вызывается и передаётся в LLM | `grep -n "buildSystemPrompt\|systemPrompt"` | line 178 — assign, lines 187+215 — pass to LLM | ✓ PASS |
| TypeScript ошибок в question-generator.ts нет | `npx tsc --noEmit -p packages/ai/tsconfig.json` (без test-файлов) | 0 errors | ✓ PASS |
| Коммит 6c84bd6 содержит изменения prompt | `git show 6c84bd6 --stat` | +37/-2 lines в question-generator.ts | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PROMPT-01 | 42-01 | Маппинг тем к осям (D-01) | ✓ SATISFIED | Секция `## ПРАВИЛА ВЫБОРА РУБРИКИ`, строки 265–275 |
| PROMPT-02 | 42-01 | Запрет курсо-специфичных вопросов (D-02) | ✓ SATISFIED | `## СТРОГО ЗАПРЕЩЕНО` расширен — 4 новые строки ❌ |
| PROMPT-03 | 42-01 | Качество вариантов ответов (D-03) | ✓ SATISFIED | Секция `## КАЧЕСТВО ВАРИАНТОВ ОТВЕТА`, строки 290–295 |
| PROMPT-04 | 42-01 | Контекст площадки WB/Ozon (D-04) | ✓ SATISFIED | Секция `## КОНТЕКСТ ПЛОЩАДКИ`, строки 297–300 |
| PROMPT-05 | 42-01 | Реальная терминология (D-05) | ✓ SATISFIED | Секция `## ТЕРМИНОЛОГИЯ И СТИЛЬ`, строки 303–309 |
| PROMPT-06 | 42-01 | Стиль вопросов — практика, алгоритмы (D-06) | ✓ SATISFIED | Секция `## ТЕРМИНОЛОГИЯ И СТИЛЬ`, строки 307–309 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/ai/src/tagging.ts` | 245 | `'stripCodeFences' is declared but its value is never read` | ℹ️ Info | Pre-existing TS warning, вне scope фазы 42, не влияет на prompt |

Изменённый файл (`question-generator.ts`) не содержит anti-patterns. Изменения — исключительно текст prompt внутри template literal, без логических изменений.

### Human Verification Required

#### 1. Экспертная оценка сгенерированных вопросов

**Test:** Запустить новую диагностическую сессию на platform.mpstats.academy и передать 15 вопросов Миле (или другому эксперту по маркетплейсам) на повторное ревью.
**Expected:** Вопросы практические, рубрики корректные (SEO-тема → Маркетинг, не Аналитика), варианты ответов правдоподобны, нет выдуманных терминов, нет вопросов о курсе/плагинах/биддере. Улучшение относительно исходного ревью с 12 замечаниями.
**Why human:** Качество LLM-генерации нельзя оценить статически — prompt задаёт правила, но соответствие конкретных сгенерированных вопросов этим правилам требует экспертной проверки.

### Gaps Summary

Пробелов нет. Все 6 правил из ревью Милы реализованы и присутствуют в `buildSystemPrompt()`. Существующие правила (no authors/speakers, no VPN) сохранены. Типизация файла чистая. Ключевая цепочка `buildSystemPrompt() → callLLM() → LLM API` полностью прослеживается в обоих кодовых путях (json_schema и json_object fallback).

Единственное, что невозможно верифицировать автоматически — фактическое улучшение качества генерируемых вопросов, поскольку оно проявляется только в runtime при реальном вызове LLM.

---

_Verified: 2026-03-27T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
