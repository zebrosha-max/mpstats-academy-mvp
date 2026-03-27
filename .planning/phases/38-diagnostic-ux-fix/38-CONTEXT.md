# Phase 38: Diagnostic UX Fix - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Исправить отображение результатов диагностики: зоны развития, priority badges, пустые секции трека, mobile overflow. Также воспроизвести и исправить баг "Результаты не найдены" после прохождения 15/15 вопросов.

</domain>

<decisions>
## Implementation Decisions

### Zones Display (R14)
- **D-01:** Заголовок "X зон для развития" считает ВСЕ gaps с gap > 0, не только HIGH priority. Формула: `results.gaps.filter(g => g.gap > 0).length`.
- **D-02:** Текст: "{N} зон для развития" (pluralized). Убрать разделение на "зоны развития" vs "рекомендации" — одна секция.

### Priority Badges (R11, R12, R13)
- **D-03:** Переименовать labels: HIGH → "Высокий", MEDIUM → "Средний", LOW → "Низкий".
- **D-04:** Добавить tooltip на каждый badge:
  - Высокий: "Большой разрыв с целью — рекомендуем начать с этой темы"
  - Средний: "Есть потенциал для улучшения"
  - Низкий: "Близко к цели — поддерживайте уровень"
- **D-05:** Добавить подзаголовок "Приоритет изучения" над секцией рекомендаций.
- **D-06:** Mobile: `flex-wrap` на контейнере badge'ей, `text-xs` на `sm:` breakpoint.

### Empty Sections (R20)
- **D-07:** Полностью скрывать секции трека с 0 уроков (filter out в UI). Не показывать "0/6" если секция пуста.
- **D-08:** Если ВСЕ секции пусты (ни одной ошибки, ни одного урока) — показать placeholder "Отличный результат! Все темы освоены."

### "Результаты не найдены" (Мила, page9_img2)
- **D-09:** Воспроизвести баг: пройти 15/15 вопросов, проверить что session сохраняется в DB. Если session не сохранилась — найти root cause (возможно race condition в submitAnswer или completeSession).
- **D-10:** Добавить error boundary на results page: если query вернул null/empty — показать "Произошла ошибка при загрузке результатов. Попробуйте перезагрузить страницу" вместо "Результаты не найдены".

### Claude's Discretion
- Exact tooltip component (Tooltip from shadcn/ui or native title attribute)
- Animation/transition on badge appearance
- Error boundary implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diagnostic Results
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` — zones count (line 127), priority badges (line 203), recommendation cards
- `packages/api/src/routers/diagnostic.ts` — gaps calculation (lines 67-100), priority assignment, generateSectionedPath (lines 240-398)

### Track Sections
- `apps/web/src/app/(main)/learn/page.tsx` — section rendering (lines 545-598), empty section display
- `packages/api/src/routers/learning.ts` — section population, "Проработка ошибок" lesson extraction

### Mobile Layout
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` — badge container layout

### Audit Evidence
- `screenshots/audit/sheet0_obuchenie/R11_*.jpg` — badge "Приоритет"/"Низкий" without explanation
- `screenshots/audit/sheet0_obuchenie/R13_*.jpg` — mobile overflow
- `screenshots/audit/sheet0_obuchenie/R14_*.png` — "1 зона" vs 4 recommendations
- `screenshots/audit/sheet0_obuchenie/R20_*.png` — empty "0/6" section
- `screenshots/audit/sheet1_diagnostika/images/page9_img2.png` — "Результаты не найдены"

</canonical_refs>

<code_context>
## Existing Code Insights

### Root Causes (verified by code analysis)
1. **R14**: `results.gaps.filter(g => g.priority === 'HIGH').length` counts only HIGH, but cards show all gaps > 0
2. **R11**: `PRIORITY_STYLES` has labels without tooltips — `{ badge: 'destructive', label: 'Приоритет' }`
3. **R13**: No `flex-wrap` on badge container — badges overflow on mobile
4. **R20**: `allSections.filter(s => s.lessonIds.length > 0)` filters in backend but UI may still show empty headers
5. **page9_img2**: "Результаты не найдены" — likely DiagnosticSession query returned empty; need to check if session completes correctly

### Reusable Assets
- `Tooltip` from shadcn/ui — already in project (used in other places)
- `Badge` component — already has variants (destructive, warning, success)
- `PRIORITY_STYLES` constant — easy to extend with tooltip text

### Integration Points
- `diagnostic/results/page.tsx` — main target for zones + badges fix
- `learn/page.tsx` — section filtering for empty sections
- `diagnostic.ts` — session completion flow for "Результаты не найдены" bug

</code_context>

<specifics>
## Specific Ideas

- Badge labels should use standard Russian: "Высокий"/"Средний"/"Низкий" (not "Приоритет")
- Tooltip text should be actionable: tell user what to DO, not just explain the color
- "Результаты не найдены" is a P1 bug — must be reproduced before fixing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-diagnostic-ux-fix*
*Context gathered: 2026-03-27*
