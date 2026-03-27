# Phase 38: Diagnostic UX Fix - Research

**Researched:** 2026-03-27
**Domain:** Next.js UI/UX — React state, Tailwind layout, shadcn/ui, tRPC result pages
**Confidence:** HIGH

## Summary

Все пять багов этой фазы — чисто frontend-фиксы в двух файлах (`diagnostic/results/page.tsx` и `learn/page.tsx`) плюс один потенциальный backend race-condition в `diagnostic.ts`. Код полностью прочитан, root causes подтверждены.

Главные вещи для плана: (1) `Tooltip` из shadcn/ui отсутствует в проекте — нужно установить `@radix-ui/react-tooltip` и создать компонент перед использованием; (2) баг "Результаты не найдены" (page9_img2) требует диагностики в БД прежде чем делать фикс; (3) `learn/page.tsx` уже фильтрует пустые секции на уровне backend (`allSections.filter(s => s.lessonIds.length > 0)`), но UI рендерит секции напрямую без дополнительной проверки на стороне клиента.

**Основная рекомендация:** Один план, три задачи: (1) zones + badges fix в results/page.tsx, (2) tooltip компонент + mobile fix, (3) расследование + error boundary для "Результаты не найдены".

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Zones Display (R14)**
- D-01: Заголовок "X зон для развития" считает ВСЕ gaps с gap > 0, не только HIGH priority. Формула: `results.gaps.filter(g => g.gap > 0).length`.
- D-02: Текст: "{N} зон для развития" (pluralized). Убрать разделение на "зоны развития" vs "рекомендации" — одна секция.

**Priority Badges (R11, R12, R13)**
- D-03: Переименовать labels: HIGH → "Высокий", MEDIUM → "Средний", LOW → "Низкий".
- D-04: Добавить tooltip на каждый badge: Высокий: "Большой разрыв с целью — рекомендуем начать с этой темы"; Средний: "Есть потенциал для улучшения"; Низкий: "Близко к цели — поддерживайте уровень".
- D-05: Добавить подзаголовок "Приоритет изучения" над секцией рекомендаций.
- D-06: Mobile: `flex-wrap` на контейнере badge'ей, `text-xs` на `sm:` breakpoint.

**Empty Sections (R20)**
- D-07: Полностью скрывать секции трека с 0 уроков. Не показывать "0/6" если секция пуста.
- D-08: Если ВСЕ секции пусты — показать placeholder "Отличный результат! Все темы освоены."

**"Результаты не найдены" (Мила)**
- D-09: Воспроизвести баг: пройти 15/15 вопросов, проверить что session сохраняется в DB. Если session не сохранилась — найти root cause.
- D-10: Добавить error boundary: если query вернул null/empty — показать "Произошла ошибка при загрузке результатов. Попробуйте перезагрузить страницу" вместо "Результаты не найдены".

### Claude's Discretion
- Exact tooltip component (Tooltip from shadcn/ui or native title attribute)
- Animation/transition on badge appearance
- Error boundary implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (уже в проекте)
| Library | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-popover` | ^1.1.15 | Уже установлен — Popover доступен |
| `class-variance-authority` | — | Badge variants уже используется |
| Tailwind CSS | — | flex-wrap, text-xs breakpoints |

### Отсутствует — нужно добавить
| Library | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-tooltip` | ^1.x | Tooltip primitive для shadcn/ui |

**Важно:** `@radix-ui/react-tooltip` НЕ установлен в `apps/web/package.json`. Список установленных Radix пакетов: accordion, alert-dialog, checkbox, dialog, popover, slot, switch. Tooltip отсутствует.

**Альтернатива без нового пакета:** HTML `title` атрибут — работает, но не кастомизируется под дизайн. Рекомендуется установить Radix Tooltip и создать `/components/ui/tooltip.tsx` по shadcn/ui паттерну (аналогично существующим компонентам).

**Installation:**
```bash
pnpm add @radix-ui/react-tooltip --filter web
```

**Затем создать** `apps/web/src/components/ui/tooltip.tsx` по shadcn/ui паттерну.

## Architecture Patterns

### Существующий паттерн Badge в проекте
`Badge` — `<div>` с CVA variants, не принимает `title` или Tooltip напрямую. Для добавления tooltip нужно обернуть Badge в Tooltip.Provider + Tooltip.Root + Tooltip.Trigger + Tooltip.Content.

Паттерн из shadcn/ui:
```tsx
// apps/web/src/components/ui/tooltip.tsx
"use client"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger
const TooltipContent = React.forwardRef<...>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md bg-mp-gray-900 px-3 py-1.5 text-xs text-white ...",
      className
    )}
    {...props}
  />
))
```

### Паттерн для zones counter (R14)
```tsx
// БЫЛО (line 127):
{results.gaps.filter(g => g.priority === 'HIGH').length}
// СТАНЕТ:
{results.gaps.filter(g => g.gap > 0).length}
```

### Паттерн для badge labels (R11)
```tsx
// БЫЛО:
const PRIORITY_STYLES = {
  HIGH: { badge: 'destructive' as const, label: 'Приоритет' },
  ...
};
// СТАНЕТ:
const PRIORITY_STYLES = {
  HIGH: { badge: 'destructive' as const, label: 'Высокий', tooltip: 'Большой разрыв с целью — рекомендуем начать с этой темы' },
  MEDIUM: { badge: 'warning' as const, label: 'Средний', tooltip: 'Есть потенциал для улучшения' },
  LOW: { badge: 'success' as const, label: 'Низкий', tooltip: 'Близко к цели — поддерживайте уровень' },
};
```

### Паттерн для mobile badge overflow (R13)
Контейнер с badge в results/page.tsx (line 176-207):
```tsx
// В item: flex items-center justify-between
// Badge обёрнут в flex-1 с right alignment
// НУЖНО: добавить flex-wrap на внешний div items row
// и shrink-0 на Badge wrapper чтобы не сжимался
```

### Паттерн для пустых секций (R20)
`learn/page.tsx` line 547: `recommendedPath.sections!.map(...)` — итерирует все секции.

**Анализ backend:** `generateSectionedPath` в `diagnostic.ts` line 391 уже делает `allSections.filter(s => s.lessonIds.length > 0)`. Значит пустые секции фильтруются при генерации пути. Но баг R20 показывает "0/6" — это значит секции с `lessons.length > 0` попадают в UI, но после применения фильтров (`filterLesson`) все уроки отфильтровываются.

**Root cause R20:** `filterLesson` на UI применяется внутри `section.lessons.map()` (line 582-583), но счётчик `completedInSection/section.lessons.length` (line 550) считает ВСЕ уроки секции, включая отфильтрованные. Секция рендерится с заголовком "X/6", но внутри 0 уроков.

**Фикс D-07:** Перед рендером секции добавить фильтр:
```tsx
{recommendedPath.sections!
  .filter(section => section.lessons.filter(l => filterLesson(l as LessonWithProgress)).length > 0)
  .map((section) => { ... })}
```

### Паттерн error boundary (D-10)
В `diagnostic/results/page.tsx` уже есть обработка `if (!results)` (line 69-87). Нужно изменить сообщение:
```tsx
// БЫЛО:
<p className="text-body text-mp-gray-500">Результаты не найдены</p>
// СТАНЕТ:
<p className="text-body text-mp-gray-500">Произошла ошибка при загрузке результатов. Попробуйте перезагрузить страницу.</p>
<Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
  Перезагрузить
</Button>
```

### Anti-Patterns to Avoid
- **Не использовать `title` атрибут для tooltips** — непоследовательно с дизайн-системой, не кастомизируется.
- **Не трогать backend `generateSectionedPath`** — уже правильно фильтрует. Фикс только на UI.
- **Не добавлять стейт для tooltip visibility** — Radix управляет hover/focus автоматически.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip | Custom CSS hover | `@radix-ui/react-tooltip` | Accessibility (ARIA), keyboard focus, portal positioning |
| Pluralization | Custom if/else | Хардкодить 3 формы Russian plural | Нет i18n lib в проекте — хардкод допустим |

## Common Pitfalls

### Pitfall 1: Tooltip требует Provider
**What goes wrong:** Tooltip рендерится без контента, ошибка в консоли "Missing Tooltip Provider"
**Why it happens:** `@radix-ui/react-tooltip` требует `TooltipProvider` выше в дереве
**How to avoid:** Добавить `<TooltipProvider>` в root layout или обернуть локально в results page
**Warning signs:** Tooltip не появляется, консоль показывает Radix ошибку

### Pitfall 2: Badge — div, не button
**What goes wrong:** `Tooltip.Trigger` требует focusable элемент для keyboard accessibility
**Why it happens:** `Badge` — `<div>`, не имеет tabIndex
**How to avoid:** Использовать `TooltipTrigger asChild` + добавить `tabIndex={0}` на Badge, или обернуть `<span>`
**Warning signs:** tooltip не появляется при tab-навигации

### Pitfall 3: filterLesson vs section.lessons.length несинхронность
**What goes wrong:** Секция рендерится с "0/6" (баг R20) — заголовок показывает длину несфильтрованного массива
**Why it happens:** `completedInSection` и `section.lessons.length` считаются до применения `filterLesson`
**How to avoid:** Вычислить filtered lessons один раз до рендера секции, использовать для и счётчика и рендера
**Warning signs:** Секция с заголовком и счётчиком, но пустым телом

### Pitfall 4: "Результаты не найдены" — race condition
**What goes wrong:** Пользователь дошёл до 15/15, `submitAnswer` завершил последний ответ, но редирект на results происходит до того, как `getResults` query может получить COMPLETED session
**Why it happens:** В `session/page.tsx` после `isComplete=true` происходит `router.push` немедленно; `getResults` query на results page запускается сразу, но сессия ещё может быть `IN_PROGRESS` в момент первого запроса (race)
**How to avoid:** D-09 требует воспроизведения. Потенциальный фикс: `getResults` должен проверять оба статуса (`COMPLETED` ИЛИ retry logic) или results page должна делать retry при получении null
**Warning signs:** "Результаты не найдены" у пользователей после успешного прохождения

### Pitfall 5: Pluralization для "зон"
**What goes wrong:** "1 зоны для развития" (неправильное склонение)
**Why it happens:** Русская морфология: 1 зона, 2-4 зоны, 5+ зон
**How to avoid:** Хелпер-функция:
```tsx
function pluralizeZones(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} зона`;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return `${n} зоны`;
  return `${n} зон`;
}
```

## Code Examples

### Полный пример Tooltip wrapper для Badge
```tsx
// Source: shadcn/ui docs pattern + Radix Tooltip
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Usage in results/page.tsx:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Badge variant={PRIORITY_STYLES[gap.priority].badge}>
        {PRIORITY_STYLES[gap.priority].label}
      </Badge>
    </TooltipTrigger>
    <TooltipContent>
      <p>{PRIORITY_STYLES[gap.priority].tooltip}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Фикс zones counter + pluralization
```tsx
// results/page.tsx line 127
const gapCount = results.gaps.filter(g => g.gap > 0).length;
// ...
<div className="text-display font-bold text-mp-blue-500">
  {gapCount}
</div>
<div className="text-body-sm text-mp-gray-500 mt-1">
  {pluralizeZones(gapCount)} для развития
</div>
```

### Фикс empty sections (R20)
```tsx
// learn/page.tsx — перед секцией рекомендаций
{recommendedPath.sections!
  .map(section => ({
    ...section,
    filteredLessons: section.lessons.filter(l => filterLesson(l as LessonWithProgress))
  }))
  .filter(section => section.filteredLessons.length > 0)
  .map((section) => {
    const completedInSection = section.filteredLessons.filter(l => l.status === 'COMPLETED').length;
    // ...рендер с section.filteredLessons
  })}
{/* Fallback: все секции пусты */}
{recommendedPath.sections!.every(s =>
  s.lessons.filter(l => filterLesson(l as LessonWithProgress)).length === 0
) && (
  <Card className="shadow-mp-card">
    <CardContent className="py-8 text-center">
      <p className="text-body text-mp-green-700">Отличный результат! Все темы освоены.</p>
    </CardContent>
  </Card>
)}
```

## Runtime State Inventory

Не применимо — фаза не является rename/refactor/migration.

## Environment Availability

Шаг пропущен — фаза чисто frontend, нет внешних зависимостей сверх уже используемых (npm пакеты).

Единственное добавление: `@radix-ui/react-tooltip` устанавливается через pnpm, npm registry доступен.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (E2E) + Vitest (unit) |
| Config file | `apps/web/playwright.config.ts` |
| Quick run command | `pnpm test:e2e -- --grep "Diagnostic"` |
| Full suite command | `pnpm test:e2e` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| D-01/D-02 | Zones counter показывает все gaps > 0 | E2E visual | `pnpm test:e2e -- --grep "radar chart"` | ✅ diagnostic-flow.spec.ts |
| D-03/D-04 | Badge labels и tooltip видны | E2E | новый тест | ❌ Wave 0 |
| D-06 | Mobile badge не overflow | E2E (mobile viewport) | `pnpm test:e2e -- --grep "Diagnostic" --project=mobile` | ✅ с мобильным viewport |
| D-07/D-08 | Пустые секции скрыты | E2E | `pnpm test:e2e -- --grep "learning"` | ✅ learning-flow.spec.ts |
| D-09 | Session сохраняется после 15/15 | E2E | `pnpm test:e2e -- --grep "full diagnostic"` | ✅ diagnostic-flow.spec.ts (полный flow) |
| D-10 | Error state показывает reload кнопку | E2E | новый тест | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test:e2e -- --grep "Diagnostic" --timeout=60000`
- **Per wave merge:** `pnpm test:e2e`
- **Phase gate:** Full suite green перед `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Добавить тест "badge labels показывают Высокий/Средний/Низкий" в `diagnostic-flow.spec.ts`
- [ ] Добавить тест "error state на results page показывает reload button" в `diagnostic-flow.spec.ts`

## Open Questions

1. **Race condition в "Результаты не найдены"**
   - Что знаем: `getResults` возвращает `null` если `session.status !== 'COMPLETED'` (строго). `submitAnswer` обновляет статус COMPLETED синхронно перед редиректом.
   - Что неясно: Мила видела баг после 15/15 — возможно это не race condition, а конкретный edge case (сеть, retry, двойной submit).
   - Рекомендация: D-09 требует воспроизведения через DevTools Network throttling. Если race — добавить retry в `getResults` query (`retry: 2, retryDelay: 1000`). В любом случае D-10 (error boundary) исправляет UX независимо от root cause.

## Sources

### Primary (HIGH confidence)
- Прямое чтение `apps/web/src/app/(main)/diagnostic/results/page.tsx` — подтверждены R14 (line 127), R11 (PRIORITY_STYLES), R13 (отсутствие flex-wrap)
- Прямое чтение `packages/api/src/routers/diagnostic.ts` — подтверждены gaps calculation, session completion flow
- Прямое чтение `apps/web/src/app/(main)/learn/page.tsx` (lines 547-600) — подтверждён R20 (filterLesson не применяется к счётчикам)
- Прямое чтение `apps/web/src/app/(main)/diagnostic/session/page.tsx` — понят flow завершения сессии
- Прямое чтение `apps/web/package.json` — подтверждено отсутствие `@radix-ui/react-tooltip`

### Secondary (MEDIUM confidence)
- shadcn/ui паттерн для Tooltip — стандартный для проекта (аналогично другим shadcn компонентам)

## Metadata

**Confidence breakdown:**
- Root causes: HIGH — все подтверждены чтением кода
- Фиксы R14, R11, R13: HIGH — простые изменения в одном файле
- Фикс R20: HIGH — root cause подтверждён (filterLesson vs счётчики)
- Tooltip реализация: HIGH — стандартный shadcn/ui паттерн, только нужно установить пакет
- "Результаты не найдены" root cause: MEDIUM — воспроизведение требуется

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (стабильный стек)
