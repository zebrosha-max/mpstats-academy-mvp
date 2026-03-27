# Phase 39: AI & Content Quality - Research

**Researched:** 2026-03-27
**Domain:** LLM prompt engineering, Kinescope postMessage seek API, Prisma DB deduplication
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Добавить в system prompt инструкцию сохранять английские названия брендов: Wildberries, Ozon, MPSTATS. Никогда не транслитерировать.
- **D-02:** Post-processing regex в `generation.ts` после LLM response: `/Валбер[иеё]с(а|у|ом|е)?/gi → Wildberries`, `/Вайлдберриз/gi → Wildberries`. Двойная защита.
- **D-03:** DiagnosticHint — `onSeek` prop передаётся с lesson page. Callback делает `postMessage({...})` к Kinescope iframe + `scrollIntoView` к плееру.
- **D-04:** Визуальный feedback при клике на таймкод: brief highlight (`bg-amber-300 → bg-amber-100 transition`).
- **D-05:** SourceTooltip при клике: 1) seekTo через postMessage, 2) scrollIntoView к video-player, 3) brief highlight плеера (ring animation).
- **D-06:** Проверить что `document.getElementById('video-player')` совпадает с реальным ID iframe контейнера.
- **D-07:** One-time скрипт: найти дубликаты по `videoId`, оставить с наименьшим `order`, удалить остальные. Перед удалением — перенести LessonProgress на оставляемый lesson.
- **D-08:** Скрипт запускается вручную, результат логируется. Не автоматизировать.

### Claude's Discretion
- Exact regex patterns для других возможных транслитераций
- Highlight animation duration и style
- Скрипт дубликатов — dry-run mode по желанию

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Фаза решает четыре изолированных баги в кодовой базе MAAL. Ни один из них не требует новых зависимостей — все правки укладываются в существующий стек.

**Баг R42 (brand names):** `generation.ts` не содержит никакого упоминания Wildberries в system prompt. LLM (Qwen 3.5 Flash) транслитерирует бренды по умолчанию, потому что обучался преимущественно на русских текстах. Двойная защита — prompt + regex post-processing — наиболее надёжный подход.

**Баги R17/R18 (seek + scroll):** `DiagnosticHint.onSeek` уже передаётся с lesson page (строки 613–625 `page.tsx`), однако использует `postMessage` паттерн напрямую через `iframe`, а не через `playerRef`. `SourceTooltip.handleClick` уже вызывает `onSeek` и `scrollIntoView`, но не делает scroll к плееру перед/после seek. Проблема `R18` заключается в том, что `scrollIntoView` идёт к `document.getElementById('video-player')`, а в реальном DOM `id="video-player"` стоит на `<Card>` (строка 601 `page.tsx`), а не на `<iframe>` — это работает корректно. Однако scroll вызывается без плавной анимации при мобильном просмотре, где видео находится вверху страницы под хедером.

**Баг R35 (duplicates):** Модель `Lesson` не имеет `@unique` на `videoId`. Дубликаты появились при многократном запуске seed-скрипта. `LessonProgress` имеет FK на `Lesson.id` с `onDelete: Cascade`, поэтому при удалении дублей нужно сначала перенести progress записи вручную (если они есть).

**Primary recommendation:** Реализовать четыре независимых изменения в одном плане: prompt fix + regex в `generation.ts`, seek+scroll fix в `DiagnosticHint` и `SourceTooltip`, дедупликационный скрипт через Prisma.

---

## Standard Stack

### Core (уже в проекте)
| Library | Version | Purpose | Relevant |
|---------|---------|---------|----------|
| Prisma | 5.22.0 | DB queries для dedupe script | `packages/db` |
| TypeScript | 5.x | Скрипт дубликатов | `scripts/` |
| React | 18.x | Клиентские компоненты | `apps/web` |

### Нет новых зависимостей
Все четыре фикса используют только существующий код.

---

## Architecture Patterns

### Паттерн: DiagnosticHint seek (текущий)

Текущая реализация в `page.tsx` строки 613–625:
```typescript
// ТЕКУЩИЙ КОД — использует прямой postMessage к iframe
onSeek={(seconds) => {
  const iframe = document.querySelector('iframe[src*="kinescope"]') as HTMLIFrameElement;
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage(
      JSON.stringify({ method: 'seekTo', params: [seconds] }),
      '*'
    );
  }
}}
```

**Проблема:** Нет scrollIntoView к плееру и нет visual highlight кнопки таймкода.

**Правильный паттерн** (через `playerRef`):
```typescript
onSeek={(seconds) => {
  playerRef.current?.seekTo(seconds);
  document.getElementById('video-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}}
```

`PlayerHandle.seekTo` уже делает `playerRef.current.seekTo(seconds).then(() => play())` — достаточно одного вызова.

### Паттерн: handleTimecodeClick (существующий, рабочий)

Уже реализован в `page.tsx` строка 280–283:
```typescript
const handleTimecodeClick = (seconds: number) => {
  playerRef.current?.seekTo(seconds);
  document.getElementById('video-player')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
```

Этот же callback уже передаётся в `SourceTooltip` через `onSourceSeek={handleTimecodeClick}` и в `CollapsibleFootnotes` через `onSeek={handleTimecodeClick}`. **Для R18 нужно убедиться, что scroll корректно работает на мобиле** (`block: 'nearest'` vs `block: 'start'`).

### Паттерн: Visual highlight на таймкод-кнопке

```typescript
// В DiagnosticHint — добавить состояние highlight
const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

const handleSeek = (seconds: number, index: number) => {
  onSeek(seconds);
  setHighlightedIndex(index);
  setTimeout(() => setHighlightedIndex(null), 800);
};
```

CSS: `bg-amber-300` → через 800ms `bg-amber-100` (transition уже есть в классах кнопки).

### Паттерн: Post-processing regex в generation.ts

```typescript
// После получения LLM response, перед return
function fixBrandNames(text: string): string {
  return text
    .replace(/Валбер[иеё]с(а|у|ом|е)?/gi, (_, ending) => 'Wildberries' + (ending ? '' : ''))
    .replace(/Вайлдберриз/gi, 'Wildberries')
    .replace(/Вайлдберис/gi, 'Wildberries')
    // Озон — спорно, оставить только если не совпадает с русским словом
    ;
}

const content = fixBrandNames(response.choices[0]?.message?.content || '...');
```

**Важно:** Падежные формы "Валберес**а/у/ом/е**" при замене теряют окончание → нужно заменить всё слово целиком на "Wildberries" (бренд не склоняется в правильном тексте).

### Паттерн: System prompt brand instruction

Добавить в оба system prompts (`generateLessonSummary` и `generateChatResponse`):
```
- Названия брендов пиши ТОЛЬКО по-английски: Wildberries (не «Валберес», не «Вайлдберриз»), Ozon (не «Озон»), MPSTATS
```

### Паттерн: Дедупликационный скрипт

```typescript
// scripts/dedup-lessons.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(dryRun = true) {
  // 1. Найти все Lesson с одинаковым videoId
  const lessons = await prisma.lesson.findMany({
    where: { videoId: { not: null } },
    orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
  });

  // 2. Сгруппировать по videoId
  const byVideoId = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    if (!lesson.videoId) continue;
    const group = byVideoId.get(lesson.videoId) ?? [];
    group.push(lesson);
    byVideoId.set(lesson.videoId, group);
  }

  // 3. Найти дубликаты (группы с size > 1)
  const duplicateGroups = [...byVideoId.values()].filter(g => g.length > 1);

  for (const group of duplicateGroups) {
    const [keep, ...remove] = group; // наименьший order (уже sorted)
    console.log(`KEEP: ${keep.id} (order=${keep.order})`);
    remove.forEach(r => console.log(`  DELETE: ${r.id} (order=${r.order})`));

    if (!dryRun) {
      // Перенести LessonProgress с удаляемых на оставляемый
      for (const dup of remove) {
        await prisma.lessonProgress.updateMany({
          where: { lessonId: dup.id },
          data: { lessonId: keep.id },
        });
        await prisma.lesson.delete({ where: { id: dup.id } });
      }
    }
  }

  console.log(`\nTotal duplicate groups: ${duplicateGroups.length}`);
}

main(process.argv.includes('--execute')).finally(() => prisma.$disconnect());
```

**Запуск:**
```bash
npx ts-node scripts/dedup-lessons.ts           # dry-run (безопасно)
npx ts-node scripts/dedup-lessons.ts --execute # реальное удаление
```

**Важно:** `LessonProgress` имеет `@@unique([pathId, lessonId])`. При переносе progress возможен конфликт, если для одного `pathId` есть progress и на keep, и на remove. Нужно обработать через `upsert` или пропустить конфликт.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand name correction | Полная NLP-нормализация | Простой regex replace | Достаточно для 2-3 брендов, zero deps |
| Duplicate detection | Сложный diff алгоритм | Prisma groupBy/findMany | Достаточно простого Map по videoId |
| Seek + scroll | Кастомный iframe message bus | Существующий `playerRef.seekTo` | PlayerHandle уже реализован |

---

## Common Pitfalls

### Pitfall 1: Regex падежные окончания Wildberries
**What goes wrong:** Замена `/Валберес/g → Wildberries` не покрывает "Валберес**а**" → останется "**а**" после замены
**Why it happens:** Regex не захватывает окончание
**How to avoid:** Захватить окончание в группу `(а|у|ом|е)?` и заменить всё совпадение целиком (без окончания — бренд не склоняется)
**Pattern:** `.replace(/Валбер[иеё]с(?:а|у|ом|е)?/gi, 'Wildberries')`

### Pitfall 2: LessonProgress @@unique конфликт при dedupe
**What goes wrong:** `updateMany({ where: { lessonId: dup.id }, data: { lessonId: keep.id } })` упадёт, если в той же `pathId` уже есть запись с `lessonId = keep.id`
**Why it happens:** Prisma не поддерживает `ON CONFLICT DO NOTHING` в `updateMany`
**How to avoid:** Перед update проверить конфликт; если есть — удалить дублирующую запись progress, а не переносить
```typescript
// Pseudo-code:
const existing = await prisma.lessonProgress.findUnique({
  where: { pathId_lessonId: { pathId: prog.pathId, lessonId: keep.id } }
});
if (existing) {
  await prisma.lessonProgress.delete({ where: { id: prog.id } });
} else {
  await prisma.lessonProgress.update({ where: { id: prog.id }, data: { lessonId: keep.id } });
}
```

### Pitfall 3: DiagnosticHint onSeek не использует playerRef
**What goes wrong:** Прямой postMessage к iframe не вызывает `play()` после seek, поэтому видео встаёт на паузе
**Why it happens:** `postMessage` — fire-and-forget без колбэка; playerRef.seekTo делает `.then(() => play())`
**How to avoid:** Использовать `playerRef.current?.seekTo(seconds)` вместо прямого postMessage

### Pitfall 4: scrollIntoView block: 'nearest' на мобиле
**What goes wrong:** `block: 'nearest'` не скроллит наверх, если плеер уже частично виден — пользователь не видит начало seek
**Why it happens:** 'nearest' минимизирует скролл
**How to avoid:** Использовать `block: 'start'` для DiagnosticHint seek (где явно хочется увидеть видео), оставить 'nearest' для SourceTooltip (тонкая подстройка)

### Pitfall 5: id "video-player" на Card vs на iframe
**What goes wrong:** `document.getElementById('video-player')` возвращает `<Card>` div, а не iframe — scrollIntoView работает, seekTo нет
**Why it happens:** id стоит на контейнере Card, не на iframe элементе
**Impact:** scrollIntoView работает корректно (скроллит к Card). seekTo идёт через playerRef — тоже корректно. **Проблемы нет.**

### Pitfall 6: Visual highlight при быстрых кликах
**What goes wrong:** При нескольких быстрых кликах — таймаут предыдущего highlight не сброшен
**How to avoid:** Хранить ref на таймаут, очищать перед новым

---

## Code Examples

### Исправление DiagnosticHint.onSeek в lesson page

Текущий код (строки 613–625 `page.tsx`) заменяется на:
```typescript
// Source: apps/web/src/app/(main)/learn/[id]/page.tsx
{lessonHints.length > 0 && (
  <DiagnosticHint
    lessonId={lessonId}
    hints={lessonHints}
    onSeek={(seconds) => {
      playerRef.current?.seekTo(seconds);
      document.getElementById('video-player')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }}
  />
)}
```

### Highlight state в DiagnosticHint

```typescript
// Source: apps/web/src/components/diagnostic/DiagnosticHint.tsx
const [activeTimecode, setActiveTimecode] = useState<number | null>(null);
const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleSeek = (seconds: number, index: number) => {
  if (highlightTimer.current) clearTimeout(highlightTimer.current);
  setActiveTimecode(index);
  onSeek(seconds);
  highlightTimer.current = setTimeout(() => setActiveTimecode(null), 800);
};

// В JSX кнопки:
onClick={() => handleSeek(tc.start, i)}
className={cn(
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium transition-colors",
  activeTimecode === i
    ? "bg-amber-300 text-amber-800"
    : "bg-amber-100 text-amber-700 hover:bg-amber-200"
)}
```

### SourceTooltip scroll fix

```typescript
// Source: apps/web/src/components/learning/SourceTooltip.tsx
const handleClick = () => {
  if (!disabled) {
    onSeek(source.timecode_start);
    document.getElementById('video-player')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }
};
```

Это уже так написано — проверить что `block: 'nearest'` работает на mobile (достаточно).

### Brand regex в generation.ts

```typescript
// Source: packages/ai/src/generation.ts
function fixBrandNames(text: string): string {
  return text
    .replace(/Валбер[иеё]с(?:а|у|ом|е)?/gi, 'Wildberries')
    .replace(/Вайлдберриз/gi, 'Wildberries')
    .replace(/Вайлдберис/gi, 'Wildberries');
}

// Применить к content после LLM response в обеих функциях:
const content = fixBrandNames(response.choices[0]?.message?.content || 'Ошибка генерации.');
```

### System prompt addition

```
// Добавить в ОБОИХ system prompts:
- Названия маркетплейсов пиши ТОЛЬКО по-английски: Wildberries (не «Валберес»), Ozon (не «Озон»), MPSTATS
```

---

## State of the Art

### Kinescope Player — текущий статус

KinescopePlayer уже использует полноценный `playerRef` (`PlayerHandle`) с `seekTo` через Kinescope Iframe API. Прямой postMessage формат `{ method: 'seekTo', params: [seconds] }` — это **устаревший паттерн** из Phase 30 (timecode deep-link). Актуальный путь: через `playerRef.current?.seekTo(seconds)`.

| Паттерн | Статус | Где используется |
|---------|--------|-----------------|
| `playerRef.current.seekTo(s)` | Текущий | `handleTimecodeClick` в page.tsx |
| `iframe.postMessage({ method: 'seekTo' })` | Устаревший | DiagnosticHint.onSeek в page.tsx (строки 617–624), deep-link effect |

### LLM Brand Correction — подходы

| Подход | Confidence | Надёжность |
|--------|-----------|------------|
| Только prompt | LOW | LLM иногда игнорирует инструкции при длинном контексте |
| Только regex | MEDIUM | Надёжно, но не покрывает новые транслитерации |
| Prompt + regex | HIGH | Двойная защита — выбранный подход |

---

## Open Questions

1. **Дубликаты из разных курсов?**
   - Что мы знаем: дубликаты видны на скриншотах R35 (уроки 4=6, 7=10) — предположительно внутри одного курса
   - Что неясно: могут ли одни и те же videoId встречаться в разных курсах (пересечение материала)?
   - Рекомендация: dry-run скрипт выведет группы — проверить вручную перед `--execute`

2. **Озон — транслитерировать?**
   - Что мы знаем: `Ozon` — официальное английское написание, `Озон` — русское (допустимо в разговорном контексте)
   - Что неясно: CX-требования (оставить как есть или нет)
   - Рекомендация: не трогать `Озон` в regex — это не ошибка в отличие от "Валберес"

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are code/DB only, Prisma already configured)

---

## Validation Architecture

`nyquist_validation` не задан в config.json — трактуется как enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + Playwright |
| Config file | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements → Test Map

| Area | Behavior | Test Type | Automated? |
|------|----------|-----------|-----------|
| R42 Brand names | `fixBrandNames('Валберес') === 'Wildberries'` | unit (Vitest) | Да — простой unit тест |
| R17 Timecode seek | Клик по таймкоду в DiagnosticHint → playerRef.seekTo вызывается | manual | Нет — требует iframe в browser |
| R18 Footnote scroll | Клик по [N] в SafeMarkdown → scroll к видео | manual | Нет — требует browser |
| R35 Duplicates | Скрипт находит дубликаты, не удаляет без --execute | manual | dry-run логирование |

### Wave 0 Gaps
- Нет тест-файла для `fixBrandNames` — можно добавить `packages/ai/src/__tests__/generation.test.ts` в Wave 1

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — DiagnosticHint.onSeek текущая реализация (строки 613–625)
- `apps/web/src/components/video/KinescopePlayer.tsx` — PlayerHandle.seekTo API
- `apps/web/src/components/learning/SourceTooltip.tsx` — handleClick с scrollIntoView
- `packages/ai/src/generation.ts` — system prompts, LLM response handling
- `packages/db/prisma/schema.prisma` — Lesson, LessonProgress модели

### Secondary (MEDIUM confidence)
- Audit screenshots `R17/R18/R35/R42` упоминаются в CONTEXT.md — подтверждают баги

---

## Metadata

**Confidence breakdown:**
- Brand name fix: HIGH — код прочитан, паттерн очевиден
- Timecode seek/scroll: HIGH — код прочитан, проблема идентифицирована точно
- Footnote fix: HIGH — SourceTooltip код прочитан, issue в mobile scroll
- Dedupe script: HIGH — схема прочитана, @@unique constraint задокументирован

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (код стабильный, нет внешних зависимостей)
