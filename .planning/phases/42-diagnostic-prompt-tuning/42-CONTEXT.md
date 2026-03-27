# Phase 42: Diagnostic Prompt Tuning - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Улучшить system prompt для генерации вопросов диагностики на основе ревью Милы (12 замечаний к 15 вопросам). Только изменение промптов — без рефакторинга кода генерации.

</domain>

<decisions>
## Implementation Decisions

### Category Mapping (Мила: вопросы 1, 2, 5, 6)
- **D-01:** Добавить в system prompt explicit правила маппинга тем → осей:
  ```
  Правила выбора рубрики:
  - SEO, поисковые фразы, ключевые слова, индексация → Маркетинг
  - Реклама, ставки, показы, CTR, РК → Маркетинг
  - Бюджет, расходы, юнит-экономика, маржа, CPO → Финансы
  - Контент карточки, фото, инфографика, описание, воронка → Контент
  - Логистика, FBO/FBS, остатки, поставки → Операции
  - Аналитика, отчёты, мониторинг, конкуренты → Аналитика
  ```

### Negative Examples (Мила: вопросы 3, 8, 10, 12)
- **D-02:** Добавить в system prompt запреты:
  ```
  НЕ генерируй вопросы о:
  - Сертификатах курса или процессе обучения
  - Плагинах, расширениях или инструментах МПСТАТС (биддер, парсер)
  - Целях или структуре самого курса
  - Определениях общих IT-терминов (что такое ИИ, нейросеть)
  Вопросы должны проверять знания О МАРКЕТПЛЕЙСАХ, не об инструментах.
  ```

### Answer Quality (Мила: вопросы 4, 5)
- **D-03:** Добавить инструкцию по качеству ответов:
  ```
  Варианты ответов:
  - Все 4 варианта должны быть правдоподобными для специалиста среднего уровня
  - Неправильные варианты — частые заблуждения или близкие по смыслу понятия
  - Избегай абсурдных вариантов ("Мозг человека из нейросетей")
  - Правильный ответ НЕ должен быть очевидным без знания предмета
  ```

### Marketplace Context (Мила: вопросы 2, 7)
- **D-04:** Добавить правило:
  ```
  Если вопрос специфичен для площадки — обязательно укажи: Wildberries или Ozon.
  Не задавай вопросы "в общем" когда ответ зависит от площадки.
  ```

### Terminology (Мила: вопрос 11)
- **D-05:** Добавить:
  ```
  Используй только реальные бизнес-термины маркетплейсов.
  Не придумывай новых понятий. Если не уверен в термине — замени на описательную формулировку.
  ```

### Question Style (Мила: вопросы 5, 8, 11)
- **D-06:** Добавить:
  ```
  Предпочитай вопросы про алгоритм действий и практические решения.
  Избегай вопросов на определения и теоретические знания.
  Формулируй вопросы профессиональным языком маркетплейсов.
  ```

### Claude's Discretion
- Exact prompt formatting and ordering of rules
- Whether to add examples of good/bad questions
- Testing strategy (manual review vs automated)

</decisions>

<canonical_refs>
## Canonical References

### Question Generation
- `packages/ai/src/question-generator.ts` — system prompt for diagnostic questions, generateQuestionsForCategory()
- `packages/ai/src/question-schema.ts` — Zod schema for generated questions

### Мила's Review
- `screenshots/audit/sheet1_diagnostika/R3_diagnostika_review.txt` — full text of review
- `screenshots/audit/sheet1_diagnostika/images/` — 15 screenshots of reviewed questions

</canonical_refs>

<code_context>
## Existing Code Insights

### Current System Prompt Location
- `question-generator.ts` contains the system prompt for question generation
- Prompt is inline string, not in separate file
- Already has basic instructions about format (4 options, 1 correct)

### Integration
- Changes only to prompt text — no code refactoring
- Same file, same function, just better instructions

</code_context>

<specifics>
## Specific Ideas

- All 6 rule blocks (D-01 through D-06) should be added to ONE system prompt
- Order: category rules first, then negative examples, then answer quality, then context/terminology
- After changing prompt — generate 3 test sessions (15 questions each) and manually review quality

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-diagnostic-prompt-tuning*
*Context gathered: 2026-03-27*
