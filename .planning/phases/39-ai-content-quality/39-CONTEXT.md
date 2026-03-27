# Phase 39: AI & Content Quality - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Исправить качество AI-текстов (бренды), сделать таймкоды кликабельными (seek + scroll), починить footnote-ссылки, удалить дубликаты уроков из БД.

</domain>

<decisions>
## Implementation Decisions

### Brand Names in AI Output (R42)
- **D-01:** Добавить в system prompt инструкцию: "Сохраняй английские названия брендов маркетплейсов: Wildberries, Ozon, MPSTATS. Никогда не транслитерируй их на русский (не 'Валберес', не 'Озон')."
- **D-02:** Добавить post-processing regex в `generation.ts` после получения LLM response: `/Валбер[иеё]с(а|у|ом|е)?/gi → Wildberries`, `/Вайлдберриз/gi → Wildberries`. Двойная защита (prompt + regex).

### Timecode Seek in DiagnosticHint (R17)
- **D-03:** DiagnosticHint уже имеет кнопки с `onClick={() => onSeek(tc.start)}`. Проблема: `onSeek` prop может не передаваться или не подключён к плееру. Исправить: передать `onSeek` callback из lesson page → DiagnosticHint, callback делает `postMessage({type: 'seekTo', time: seconds})` к Kinescope iframe + `scrollIntoView` к плееру.
- **D-04:** Добавить visual feedback при клике на таймкод: brief highlight (bg-amber-300 → bg-amber-100 transition).

### Footnote Scroll Fix (R18)
- **D-05:** SourceTooltip при клике: 1) seekTo(timecode_start) через postMessage к iframe, 2) scrollIntoView к video-player элементу, 3) brief highlight плеера (ring animation).
- **D-06:** Проверить что `document.getElementById('video-player')` совпадает с реальным ID iframe контейнера.

### Duplicate Lessons (R35)
- **D-07:** Написать one-time скрипт (не миграция): найти дубликаты по `videoId`, оставить lesson с наименьшим `order`, удалить остальные. Перед удалением — перенести прогресс (LessonProgress) с удаляемого на оставляемый.
- **D-08:** Скрипт запускается вручную, результат логируется. Не автоматизировать — одноразовая операция.

### Claude's Discretion
- Exact regex patterns для других возможных транслитераций
- Highlight animation duration и style
- Скрипт дубликатов — dry-run mode по желанию

</decisions>

<canonical_refs>
## Canonical References

### AI Generation
- `packages/ai/src/generation.ts` — system prompt (lines 62-85), summary generation, chat generation
- `packages/ai/src/openrouter.ts` — OpenRouter client config

### Timecodes & Hints
- `apps/web/src/components/diagnostic/DiagnosticHint.tsx` — timecode buttons with onSeek (lines 54-62)
- `apps/web/src/components/video/KinescopePlayer.tsx` — iframe player, postMessage API
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — lesson page, DiagnosticHint integration

### Footnotes
- `apps/web/src/components/learning/SourceTooltip.tsx` — citation click handler (lines 55-59)
- `apps/web/src/components/shared/SafeMarkdown.tsx` — SOURCE_REF_REGEX, citation rendering

### Duplicate Lessons
- `packages/db/prisma/schema.prisma` — Lesson model, LessonProgress relation
- Supabase DB — direct query needed

### Audit Screenshots
- `screenshots/audit/sheet0_obuchenie/R17_*.png` — non-working play buttons
- `screenshots/audit/sheet0_obuchenie/R18_IMG_7481.JPG` — footnotes scrolling wrong
- `screenshots/audit/sheet0_obuchenie/R35_*.png` — duplicate lessons (4=6, 7=10)
- `screenshots/audit/sheet0_obuchenie/R42_IMG_7480.JPG` — "Валберес"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `KinescopePlayer.tsx` — already has postMessage API for seekTo
- `DiagnosticHint.tsx` — already has timecode buttons with onSeek prop
- `SourceTooltip.tsx` — already has handleClick with scrollIntoView
- Prisma client — for duplicate detection query

### Known Issues
- `onSeek` in DiagnosticHint may not be wired to player — need to trace prop chain
- `SourceTooltip` uses `document.getElementById('video-player')` — verify ID exists
- Kinescope iframe postMessage format: `{type: 'seekTo', data: {time: seconds}}`

### Integration Points
- `learn/[id]/page.tsx` → passes onSeek to DiagnosticHint and SourceTooltip
- `generation.ts` → post-processing step after LLM response

</code_context>

<specifics>
## Specific Ideas

- Regex should handle all Russian case forms: Валберис/Валберес/Валберёс + падежи (а/у/ом/е)
- Duplicate script should output what it will delete BEFORE actually deleting (dry-run first)
- Timecode seek needs to work both on desktop (side panel) and mobile (scrolled below video)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-ai-content-quality*
*Context gathered: 2026-03-27*
