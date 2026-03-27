# Phase 37: Watch Progress Fix - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Исправить систему отслеживания прогресса уроков: просмотр видео до конца должен корректно записывать 100% и статус COMPLETED, счётчики "Завершено" должны быть согласованы по всей платформе. Чисто backend/frontend bugfix — без новых фич.

</domain>

<decisions>
## Implementation Decisions

### Duration Source
- **D-01:** Duration для расчёта процента берётся из БД (`Lesson.duration`, уже заполнено из Kinescope API для всех 405 уроков), НЕ из Kinescope player events. Timer fallback `position * 1.1` удаляется.
- **D-02:** Duration передаётся в KinescopePlayer как prop `knownDuration` (в секундах, `Lesson.duration * 60`). Player использует его вместо estimated.

### Progress Calculation
- **D-03:** Формула: `watchedPercent = Math.round((position / knownDuration) * 100)`. Если `knownDuration === 0` или null → не сохранять прогресс (защита от деления на 0).
- **D-04:** Авто-завершение при 90%+: если `saveWatchProgress` возвращает `status: 'COMPLETED'` → показать toast "Урок завершён!" и обновить UI (badge, счётчики).

### Counter Consistency
- **D-05:** Оба счётчика ("N Завершено" наверху и "X/Y завершено" в прогрессе трека) должны использовать один source — `recommendedPath.completedLessons`.
- **D-06:** Верхний счётчик "Завершено" берёт данные из того же query что и "X/Y завершено" (не из отдельного getPath).

### "Следующий урок" Button
- **D-07:** Кнопка "Следующий" — только навигация, НЕ должна вызывать saveWatchProgress или updateProgress. Текущее поведение (простой Link) — корректное, нужно убедиться что timer не срабатывает при навигации.

### Claude's Discretion
- Toast notification стиль и длительность — на усмотрение (использовать существующий toast если есть)
- Exact debounce timing (15s) — оставить как есть или изменить
- Loading states при обновлении прогресса

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Progress Tracking Backend
- `packages/api/src/routers/learning.ts` — saveWatchProgress (line 560-627), updateProgress (630-685), completeLesson (688-735), getCourses/getCourse progress calc (40-47, 113-120)
- `packages/db/prisma/schema.prisma` — LessonProgress model (lines 150-164), LessonStatus enum (144-148)

### Video Player Frontend
- `apps/web/src/components/video/KinescopePlayer.tsx` — timer fallback (line 149), startTimerTracking, onTimeUpdate handler
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — handleTimeUpdate (344-363), saveWatchProgressRef pattern, completeLesson button (686-734), "Следующий" button (736-745), progress badge (668-676)

### Counter Display
- `apps/web/src/app/(main)/learn/page.tsx` — stats calculation (line 275-277), recommendedPath display (line 384)
- `packages/api/src/routers/learning.ts` — getRecommendedPath completedLessons count (318-327), getPath lessons count (178-219)

### Audit Screenshots
- `screenshots/audit/sheet0_obuchenie/R24_*.png` — "1 завершено" vs "0/71 завершено"
- `screenshots/audit/sheet0_obuchenie/R25_*.png` — 19% при полном просмотре
- `screenshots/audit/sheet0_obuchenie/R26_*.png` — 21% при 15:36/15:36
- `screenshots/audit/sheet0_obuchenie/R27_*.png` — прогресс 21→26→25%

</canonical_refs>

<code_context>
## Existing Code Insights

### Root Causes (verified by code analysis)
1. **21% bug**: `KinescopePlayer.tsx:149` — timer fallback: `effectiveDuration = knownDuration > 0 ? knownDuration : Math.max(position * 1.1, 60)`. Если Kinescope events не стреляют (а они часто не стреляют — v0.5.4 broken), duration считается как `position * 1.1`. При position=20s → duration=22s → 91%, но при position=200s → duration=220s → 91%. Реальная длительность 936s (15:36) → 200/936 = 21%.
2. **+1% bug**: Каждый тик таймера `position += 1` → пересчёт %. При revisit страницы timer стартует заново.
3. **Counter mismatch**: `getPath` считает ALL lessons, `getRecommendedPath` — только recommended sections.

### Reusable Assets
- `saveWatchProgress` mutation — throttled 15s debounce, ref-pattern для стабильности
- `completeLesson` mutation — уже правильно ставит 100% + COMPLETED
- `Lesson.duration` field — уже заполнено для 405 уроков (в минутах, целое число)
- Toast: проверить наличие toast компонента (shadcn/ui toast или sonner)

### Integration Points
- `KinescopePlayer.tsx` — передать `duration` prop из lesson data
- `learn/[id]/page.tsx` — lesson query уже возвращает `duration`
- `learn/page.tsx` — унифицировать source для счётчиков

</code_context>

<specifics>
## Specific Ideas

- Duration в БД хранится в минутах (`Math.ceil(seconds/60)`), для расчёта нужны секунды → `duration * 60`
- Kinescope events ненадёжны (react-player v0.5.4 broken) → timer fallback единственный способ tracking'а
- Auto-complete toast не должен блокировать UI — просто информативный

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-watch-progress-fix*
*Context gathered: 2026-03-27*
