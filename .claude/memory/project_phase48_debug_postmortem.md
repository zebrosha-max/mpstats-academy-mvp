---
name: Phase 48 Staging Deploy — 5-layer Debug Post-Mortem
description: Production incident during Phase 48 staging deploy — LibrarySection feature flag not rendering. 5 separate bugs in cascade. Captures each layer, its symptom, root cause, and fix so the next staging feature-flag deploy avoids these landmines.
type: project
---

# Phase 48 Staging — LibrarySection не показывался

**Date:** 2026-04-24
**Duration:** ~3 часа дебага, 5 итераций rebuild
**Outcome:** Library видна на staging, prod не тронут. Все 5 багов исправлены, staging-стенд рабочий.

## Why it matters

Будущие feature-flag'и на staging пройдут по тем же граблям если не знать про них. Этот пост-мортем — чеклист перед каждым новым флагом.

## Layer 1: Turbo v2 strict env mode

**Симптом:** Dockerfile ENV `NEXT_PUBLIC_SHOW_LIBRARY=true` устанавливался корректно (verified через `RUN echo` diagnostic), но после `pnpm turbo build` в client бандле `process.env.NEXT_PUBLIC_SHOW_LIBRARY` инлайнилось как `undefined`/пустая строка → `undefined === 'true'` = `false` → SWC dead-code-eliminated `<LibrarySection />` вместе с импортом.

**Root cause:** Turbo v2 strict mode фильтрует переменные окружения не задекларированные в `turbo.json`. Framework inference для Next.js покрывает только известные шаблоны типа `NEXT_PUBLIC_SITE_URL`, а кастомные `NEXT_PUBLIC_SHOW_*` отсекаются.

**Fix:** `turbo.json` → `build.env: ["NEXT_PUBLIC_*", ...]` + на всякий `next.config.js` env block. Но **этого мало** — см. Layer 2.

**How to apply:** При добавлении любого нового `NEXT_PUBLIC_*` флага — НЕ забывать что wildcard в `turbo.json` работает только если env прокидывается в build.

## Layer 2: Docker compose `${VAR}` interpolation

**Симптом:** Даже с `turbo.json` фиксом и `next.config.js` env block, после `--no-cache` rebuild флаг оставался пустым в бандле.

**Root cause:** В `docker-compose.staging.yml` args-секция использовала substitution `NEXT_PUBLIC_SHOW_LIBRARY: ${NEXT_PUBLIC_SHOW_LIBRARY:-false}`. Несмотря на то что `docker compose config` показывал `"true"`, реальный build не получал значение. При этом `NEXT_PUBLIC_STAGING: "true"` (хардкод-литерал) работал безотказно.

**Fix:** Хардкодить все флаги как literal в compose:
```yaml
args:
  NEXT_PUBLIC_STAGING: "true"
  NEXT_PUBLIC_SHOW_LIBRARY: "true"  # не ${...:-false}
```

**How to apply:** Новые staging-флаги — ВСЕГДА literal в `docker-compose.staging.yml`, никогда `${VAR}` substitution. Для нестатических значений (ключи, URL) нужен отдельный подход.

## Layer 3: React hydration + process global

**Симптом:** После попытки «хитрого» обхода SWC через `(process as unknown as ...).env` — `/learn` крашится:
```
ReferenceError: process is not defined
    at page-...js
React error #418 (hydration mismatch)
React error #423 (hydration error boundary)
```

**Root cause:** `process` global не существует в браузере. Next.js делает статическую замену `process.env.NEXT_PUBLIC_X` на литерал строки, но не полифилит `process` как объект. Любой cast/обход ломает клиентский бандл. Плюс SSR (сервер видит `process.env`) + client hydration (бандл без process) = hydration mismatch.

**Fix:**
- В компоненте: `const enabled = process.env.NEXT_PUBLIC_SHOW_LIBRARY === 'true'` — прямая строковая замена.
- В месте импорта: `const LibrarySection = dynamic(() => import('...').then(m => m.LibrarySection), { ssr: false })` — client-only, обходит SSR/hydration divergence.

**How to apply:** Для любого feature-flag client-component:
1. Доступ к env — ТОЛЬКО через `process.env.NEXT_PUBLIC_X` напрямую, без casts
2. Импортировать через `next/dynamic` с `ssr: false`, если компонент зависит от client-only флагов

## Layer 4: API filter vs Phase 46 data model drift

**Симптом:** Флаг доходит, компонент рендерится (в DevTools chunk `7478...js` загружен с `{enabled: !0}`), но данных нет. `getLibrary` возвращает `[]`.

**Root cause:** `packages/api/src/routers/learning.ts` → `getLibrary` фильтровал lessons через `course: { isHidden: true, id: { startsWith: 'skill_' } }`. Phase 46 (2026-04-22) переместил skill-уроки в **regular courses** (Аналитика, Маркетинг), оставив `skill_*` курсы как пустые holder'ы. Фильтр возвращал 0 пересечений даже при 418 уроках с `skillBlocks != null`.

**DB snapshot:**
- `skill_*` courses: 2 штуки (skill_analytics, skill_marketing), оба isHidden=true, но без lessons
- Lessons matching `course.id startsWith 'skill_' AND course.isHidden AND lesson.!isHidden AND videoId != null`: **0**
- Lessons with `skillBlocks != null`: **418** (в regular courses)

**Fix:** Заменил в `getLibrary`:
```ts
where: {
  isHidden: false,
  videoId: { not: null },
  skillBlocks: { not: Prisma.JsonNull },  // вместо course.startsWith('skill_')
}
```

**How to apply:** При добавлении новых query-фильтров на легаси-данные — **сначала проверить текущий state БД через Supabase SQL**, не доверять архитектурным намерениям из старых плановых документов. Data model drift между фазами — частая ловушка.

## Layer 5: UI placement в view ternary

**Симптом:** Компонент в бандле, данные есть, но в DOM ничего. Browser grep `Библиотек` → not found.

**Root cause:** `<LibrarySection />` был вставлен внутрь ветки `viewMode === 'courses'` ternary-блока:
```tsx
{viewMode === 'path' ? (
  <>... track view ...</>
) : (
  /* Courses view */
  <div>
    {courses?.map(...)}
    <LibrarySection />  // ← здесь
  </div>
)}
```
Дефолтный view — `path` (Мой трек), новые пользователи его видят. Library в него не попадал.

**Fix:** Вынести `<LibrarySection />` наружу ternary, после закрытия обеих веток. Теперь виден во всех view-режимах.

**How to apply:** Для глобальных feature-секций, которые должны быть на странице независимо от внутреннего state — **размещать вне условных блоков view mode**. Для view-specific — оставлять внутри (например, «Рекомендованные только в Мой трек»).

## Prevention checklist (для следующего staging feature-flag)

- [ ] Новый флаг добавлен в `docker-compose.staging.yml` `args` как literal `"true"` (не `${...}`)
- [ ] Если флаг `NEXT_PUBLIC_*`, он попадает в `turbo.json` `build.env` wildcard (уже есть `NEXT_PUBLIC_*`)
- [ ] Компонент использует `process.env.NEXT_PUBLIC_X === 'true'` — без обёрток, без `(process as any)`
- [ ] Импорт через `dynamic(..., { ssr: false })` если компонент зависит от client-only env
- [ ] API endpoint запрашивает реальные данные из БД (проверить через Supabase SQL до коммита)
- [ ] Компонент placing вне условных view ternary если должен быть глобально виден
- [ ] После rebuild — `docker exec container grep -c <компонент> <chunk>` подтверждает бандл
- [ ] Browser verify → DOM содержит компонент + данные

## Files changed during debug

- `docker-compose.staging.yml` — hardcode `NEXT_PUBLIC_SHOW_LIBRARY: "true"`
- `turbo.json` — `build.env: ["NEXT_PUBLIC_*", ...]`
- `apps/web/next.config.js` — `env` block (оставил как safety net)
- `apps/web/src/components/learning/LibrarySection.tsx` — direct `process.env.X`, internal gate
- `apps/web/src/app/(main)/learn/page.tsx` — `dynamic(ssr:false)` + moved outside ternary
- `packages/api/src/routers/learning.ts` — filter by `skillBlocks`, not `course.id prefix`

## Related memory

- `project_staging_environment.md` — основная doc staging-стенда
- `reference_local_secrets.md` — где лежит basic auth пароль
- `project_skill_mapping_plan.md` — Phase 46, почему skill lessons в regular courses
