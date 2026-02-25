# Phase 7: Lesson & Course Name Cleanup - Research

**Researched:** 2026-02-25
**Domain:** Data cleanup (SQL UPDATE on Supabase PostgreSQL)
**Confidence:** HIGH

## Summary

Phase 7 is a data cleanup phase -- no new libraries, no architecture changes. The task is to update 405 lesson titles, ~405 lesson descriptions (module names), and 6 course titles/descriptions in Supabase via SQL UPDATE statements. The current data comes from `seed-from-manifest.ts` which stores raw `title_original` from filenames (e.g., `1 SEO-оптимизация.mp4`) and `Модуль: ${module.title_original}` as descriptions.

The approach is: (1) write a TypeScript cleanup script with dry-run mode, (2) execute SQL UPDATEs against Supabase, (3) update the seed script so future re-seeds produce clean data. No frontend changes needed -- titles flow from DB through tRPC routers to React components without transformation, so cleaning the DB is sufficient.

**Primary recommendation:** Single TypeScript script using Prisma client to UPDATE all records, with `--dry-run` flag showing `Было -> Стало` diffs before applying.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Убрать ВСЕ расширения медиафайлов (.mp4, .mov, .avi, .mkv и т.д.)
- Заменить подчёркивания `_` на пробелы
- Удалить технические префиксы полностью: `001_`, `m01_`, `1.`, `1.2` и т.д.
- Капитализация: первая буква заглавная, остальные как есть (естественный русский стиль)
- Пример: `1 SEO-оптимизация.mp4` -> `SEO-оптимизация`
- Пример: `1. Юнит-экономика погружение.mp4` -> `Юнит-экономика погружение`
- Визуальная нумерация в UI: да, формат `1. Название`
- Нумерация сквозная по курсу (модули в UI не выделены, только плоский список)
- Номер генерируется из поля `order` при отображении, не хранится в title
- Русские названия курсов (целевая аудитория — русскоязычные селлеры)
- Убрать цифровую нумерацию из названий курсов (порядок определяется полем `order`)
- Маппинг: `01_analytics` -> `Аналитика для маркетплейсов`, `02_ads` -> определить по содержанию
- Описание курса (сейчас `title_en`) — почистить или заменить на русское
- Модули: `Модуль: Модуль 6_ Трафик_ привлекаем клиентов SEO и рекламой` -> `Трафик: привлекаем клиентов SEO и рекламой`
- Убрать дублирующий префикс `Модуль: Модуль N_`, оставить содержательную часть
- Основной подход: одноразовый SQL UPDATE в Supabase (чистые данные в БД)
- Dry-run режим обязателен: скрипт сначала показывает `Было -> Стало` для проверки
- Обновить `seed-from-manifest.ts` — добавить cleanTitle() чтобы при повторном seed названия были чистыми

### Claude's Discretion
- Точные regex-паттерны для очистки
- Обработка edge cases (двойные пробелы, пустые названия после очистки)
- Конкретные русские названия для 6 курсов (на основе содержания)
- Формат description модулей (разделитель `:` или другой)

### Deferred Ideas (OUT OF SCOPE)
- Добавление модулей как отдельной сущности в модель данных — будущая фаза
- Группировка уроков по модулям в UI (аккордеон/секции) — будущая фаза
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAMING-01 | Ни одно название урока не содержит `.mp4`, `.mov` или других расширений файлов | Regex pattern to strip media extensions from `Lesson.title` |
| NAMING-02 | Названия модулей не содержат технических разделителей `_` и нумерации вида "Модуль N_" | Regex to clean `Lesson.description` field (module name cleanup) |
| NAMING-03 | Названия курсов не начинаются с технической нумерации ("1.", "2." и т.д.) | Hardcoded Russian course name mapping for 6 courses |
| NAMING-04 | Уроки внутри каждого модуля пронумерованы последовательно и логично | Visual numbering from `order` field in UI, not stored in title |
| NAMING-05 | Изменения применены в production и проверены визуально | Redeploy via `docker compose down && build && up` on VPS |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | 5.x | DB access for UPDATE operations | Already used in project, type-safe |
| tsx | (root devDep) | Run TypeScript scripts directly | Already used for seed scripts |

No new libraries needed. This phase uses existing project infrastructure only.

## Architecture Patterns

### Data Flow (titles to UI)

```
DB (Lesson.title) -> tRPC learning router -> React LessonCard/LessonPage
DB (Lesson.description) -> tRPC learning router -> React LessonCard (description line)
DB (Course.title) -> tRPC learning router -> React LearnPage (CardTitle)
DB (Course.description) -> tRPC learning router -> React LearnPage (CardDescription)
```

No intermediate transformations exist. Cleaning DB values = clean UI. No frontend changes required.

### Script Structure

```
scripts/
├── seed/
│   └── seed-from-manifest.ts    # UPDATE: add cleanTitle() for future seeds
└── cleanup/
    └── cleanup-names.ts          # NEW: one-time cleanup script with --dry-run
```

### Pattern: Cleanup Script with Dry-Run

```typescript
// scripts/cleanup/cleanup-names.ts
const DRY_RUN = process.argv.includes('--dry-run');

// 1. Fetch all records
// 2. Apply transformations
// 3. Print diff table (Было -> Стало)
// 4. If not dry-run, execute UPDATE
// 5. Print summary
```

### Regex Patterns for Title Cleanup

Based on analysis of screenshots and seed script:

**Lesson titles** (currently `title_original` from filenames):
- `1 SEO-оптимизация.mp4` -- has prefix number and extension
- `1. Юнит-экономика погружение.mp4` -- has `N.` prefix and extension
- `1.2 Типы конкуренции как понять, кто мой конкурент.mp4` -- has `N.N` prefix

```typescript
function cleanLessonTitle(raw: string): string {
  let title = raw;
  // 1. Remove file extensions (.mp4, .mov, .avi, .mkv, .webm, .flv)
  title = title.replace(/\.(mp4|mov|avi|mkv|webm|flv|MP4|MOV)$/i, '');
  // 2. Remove leading numeric prefixes: "1 ", "1. ", "1.2 ", "001_", "m01_"
  title = title.replace(/^(\d+\.?\d*\.?\s*|m?\d+_)/, '');
  // 3. Replace underscores with spaces
  title = title.replace(/_/g, ' ');
  // 4. Collapse multiple spaces
  title = title.replace(/\s{2,}/g, ' ').trim();
  // 5. Capitalize first letter (preserve rest)
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  return title;
}
```

**Module descriptions** (currently `Модуль: ${module.title_original}`):
- `Модуль: Модуль 6_ Трафик_ привлекаем клиентов SEO и рекламой`
- `Модуль: Модуль 2_ Экономика продаж_ считаем и зарабатываем`

```typescript
function cleanModuleDescription(raw: string): string {
  let desc = raw;
  // 1. Remove "Модуль: " prefix
  desc = desc.replace(/^Модуль:\s*/, '');
  // 2. Remove "Модуль N_ " or "Модуль N " prefix (the duplicate)
  desc = desc.replace(/^Модуль\s+\d+_?\s*/, '');
  // 3. Replace remaining underscores with spaces
  desc = desc.replace(/_/g, ' ');
  // 4. Collapse multiple spaces, trim
  desc = desc.replace(/\s{2,}/g, ' ').trim();
  // 5. Capitalize first letter
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }
  return desc;
}
```

**Course titles** -- hardcoded mapping (6 courses):

```typescript
const COURSE_NAMES: Record<string, { title: string; description: string }> = {
  '01_analytics': {
    title: 'Аналитика для маркетплейсов',
    description: 'Внутренняя и внешняя аналитика, юнит-экономика, конкурентный анализ',
  },
  '02_ads': {
    title: 'Реклама и продвижение',
    description: 'SEO-оптимизация, рекламные кампании, трафик и конверсии',
  },
  '03_ai': {
    title: 'AI-инструменты для селлеров',
    description: 'Использование искусственного интеллекта в работе на маркетплейсах',
  },
  '04_workshops': {
    title: 'Практические воркшопы',
    description: 'Пошаговые разборы и мастер-классы',
  },
  '05_ozon': {
    title: 'Работа с Ozon',
    description: 'Особенности продаж и продвижения на площадке Ozon',
  },
  '06_express': {
    title: 'Экспресс-курсы',
    description: 'Быстрые курсы по ключевым темам маркетплейсов',
  },
};
```

> Note: Exact Russian names for courses are Claude's discretion. The planner should verify these by checking actual lesson content in each course or asking the user. The names above are educated guesses based on the `skill_category` mapping and course IDs.

### UI Visual Numbering

Currently lesson titles include numbers from filenames. After cleanup, visual numbering comes from `order` field.

The `learn/page.tsx` shows lessons inside course cards. Currently NO visual numbering is rendered -- `LessonCard` just shows `lesson.title`. To add `1. Title` format, the LessonCard or the parent page needs a small change to prepend the lesson's index within the course.

Places where visual number should appear:
1. **LessonCard title** -- `{index + 1}. {lesson.title}` (in learn page course list)
2. **Lesson detail page** -- already shows `Урок {currentLessonNumber}` in header, and `lesson.title` as h1

Decision: The CONTEXT says "Номер генерируется из поля `order` при отображении". The `order` field is per-course sequential. The simplest approach: render `{lesson.order}. {lesson.title}` in LessonCard. This IS a minor frontend change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB migration | Custom SQL strings | Prisma Client `updateMany`/`update` | Type safety, connection handling |
| Regex testing | Manual testing on 405 titles | Dry-run mode with full diff output | Catch edge cases before applying |

## Common Pitfalls

### Pitfall 1: Empty Titles After Cleanup
**What goes wrong:** Some filenames might be entirely numeric (e.g., `001.mp4`), leaving empty string after cleanup
**Why it happens:** Aggressive regex stripping
**How to avoid:** After cleanup, check `if (title.trim() === '') { keep original or flag for manual review }`
**Warning signs:** Any row where cleaned title is shorter than 3 characters

### Pitfall 2: Regex Order Matters
**What goes wrong:** Removing extension before prefix can fail if extension is part of title
**Why it happens:** Sequential regex application
**How to avoid:** Remove extension first (anchored to end of string with `$`), then remove prefix

### Pitfall 3: Underscore in Legitimate Content
**What goes wrong:** Some titles might use `_` legitimately (unlikely but possible)
**Why it happens:** Blanket `_` -> space replacement
**How to avoid:** Replace `_` only after removing known technical patterns. In this case, all `_` are from filenames, so blanket replacement is safe.

### Pitfall 4: Module Description Edge Cases
**What goes wrong:** Some module titles might have nested underscores like `Модуль: Модуль 6_ Трафик_ привлекаем клиентов SEO и рекламой` where `_` appears both as separator after number AND in content
**Why it happens:** Original folder naming used `_` as separator
**How to avoid:** First remove `Модуль: Модуль N_` prefix, THEN replace remaining `_` with spaces. The `_` after "Трафик" is a separator that should become `: ` or just a space.

### Pitfall 5: Production Deployment
**What goes wrong:** Script runs against local DB instead of production Supabase
**Why it happens:** Wrong DATABASE_URL in env
**How to avoid:** Script reads from `.env` which points to Supabase cloud -- same DB for dev and prod. Docker container reads same Supabase, so no separate deploy step for DB changes. Just redeploy container to clear any caches.

### Pitfall 6: Seed Script Not Updated
**What goes wrong:** Next time someone runs seed, dirty titles come back
**Why it happens:** `seed-from-manifest.ts` uses raw `title_original`
**How to avoid:** Add `cleanTitle()` function to seed script and apply to all title/description inserts

## Code Examples

### Current Data (from screenshots and seed script)

Lesson titles (stored in `Lesson.title`):
```
"1 SEO-оптимизация.mp4"
"1. Юнит-экономика погружение.mp4"
"1.2 Типы конкуренции как понять, кто мой конкурент.mp4"
"1 Работа с фокусными товарами и анализ конверсий.mp4"
"1. Внутренняя аналитика МП.mp4"
```

Lesson descriptions (stored in `Lesson.description`):
```
"Модуль: Модуль 6_ Трафик_ привлекаем клиентов SEO и рекламой"
"Модуль: Модуль 2_ Экономика продаж_ считаем и зарабатываем"
"Модуль: Модуль 5_ Ассортимент_ оптимизируем и растим продажи"
"Модуль: Модуль 3_ Конкурентная разведка_ анализируем рынок и конкурентов"
```

Course titles (stored in `Course.title`):
```
"01_analytics"    (same as course.id)
"02_ads"
...
```

Course descriptions (stored in `Course.description`, from `title_en`):
```
"Analytics for Marketplaces"
...
```

### Cleanup Script Structure

```typescript
// scripts/cleanup/cleanup-names.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// ... cleanLessonTitle(), cleanModuleDescription(), COURSE_NAMES ...

async function main() {
  // Step 1: Clean lesson titles
  const lessons = await prisma.lesson.findMany({ orderBy: [{ courseId: 'asc' }, { order: 'asc' }] });

  console.log('=== LESSON TITLES ===');
  for (const lesson of lessons) {
    const newTitle = cleanLessonTitle(lesson.title);
    const newDesc = lesson.description ? cleanModuleDescription(lesson.description) : null;

    if (newTitle !== lesson.title || newDesc !== lesson.description) {
      console.log(`[${lesson.id}]`);
      if (newTitle !== lesson.title) console.log(`  title: "${lesson.title}" -> "${newTitle}"`);
      if (newDesc !== lesson.description) console.log(`  desc:  "${lesson.description}" -> "${newDesc}"`);

      if (!DRY_RUN) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { title: newTitle, description: newDesc },
        });
      }
    }
  }

  // Step 2: Clean course names
  console.log('\n=== COURSE NAMES ===');
  for (const [courseId, names] of Object.entries(COURSE_NAMES)) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (course) {
      console.log(`[${courseId}] "${course.title}" -> "${names.title}"`);
      console.log(`  desc: "${course.description}" -> "${names.description}"`);

      if (!DRY_RUN) {
        await prisma.course.update({
          where: { id: courseId },
          data: { title: names.title, description: names.description },
        });
      }
    }
  }
}
```

### Seed Script Update

```typescript
// In seed-from-manifest.ts, add cleanTitle() and use it:
// create: { title: cleanLessonTitle(lesson.title_original), ... }
// update: { title: cleanLessonTitle(lesson.title_original), ... }
// description: cleanModuleDescription(`Модуль: ${module.title_original}`),
```

### UI Visual Numbering (minor frontend change)

```typescript
// In learn/page.tsx, inside course lessons map:
{visibleLessons.map((lesson, index) => (
  <LessonCard
    key={lesson.id}
    lesson={{
      ...lesson,
      title: `${lesson.order}. ${lesson.title}`,  // or index + 1
    }}
    showCourse={false}
    isRecommended={recommendedLessonIds.has(lesson.id)}
  />
))}
```

Alternative: modify `LessonCard` to accept `showNumber` prop instead of mutating title.

## State of the Art

No technology changes. This is purely a data cleanup operation on existing stack.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw filenames as titles | Clean human-readable titles | This phase | User sees professional course structure |

## Open Questions

1. **Exact Russian course names**
   - What we know: 6 courses mapped by ID (01_analytics through 06_express)
   - What's unclear: User may want specific names different from guesses above
   - Recommendation: Use dry-run output to show proposed names, let user approve before applying

2. **Module description format after cleanup**
   - What we know: Remove `Модуль: Модуль N_` prefix, replace `_` with spaces
   - What's unclear: Should remaining content use `:` as separator or not? E.g., `Трафик: привлекаем клиентов` vs `Трафик привлекаем клиентов`
   - Recommendation: Keep natural punctuation. The `_` after topic name (e.g., `Трафик_`) acts as `: `, so replace first `_` after the topic with `: ` and remaining with spaces

3. **Visual numbering in lesson detail page**
   - What we know: `lesson.title` will no longer have numbers. Header shows "Урок N из M".
   - What's unclear: Should lesson detail h1 also show number prefix?
   - Recommendation: Leave lesson detail as is (h1 = clean title, header shows "Урок N из M"). Only add numbering in course list view.

## Sources

### Primary (HIGH confidence)
- `scripts/seed/seed-from-manifest.ts` -- source of current title data, line 199: `title: lesson.title_original`, line 200: `description: \`Модуль: ${module.title_original}\``
- `packages/db/prisma/schema.prisma` -- Course and Lesson models, fields: title, description, order
- `packages/api/src/routers/learning.ts` -- all tRPC endpoints pass `l.title` and `l.description` directly from DB
- `screenshots/naming_lessions/1.jpg` and `2.jpg` -- visual confirmation of current dirty titles in production

### Secondary (MEDIUM confidence)
- Course name guesses based on COURSE_SKILL_MAP and course IDs -- need user validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, uses existing Prisma client
- Architecture: HIGH -- data flows verified by reading all router endpoints and UI components
- Regex patterns: MEDIUM -- based on screenshot examples, may miss edge cases (dry-run will catch)
- Course names: LOW -- educated guesses, need user approval
- Pitfalls: HIGH -- identified from code analysis

**Research date:** 2026-02-25
**Valid until:** No expiration (data cleanup, not library-dependent)
