# Phase 40: Navigation & Filters - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Исправить навигационные баги: фильтры сохраняются в URL, онбординг-тур не повторяется, email скрыт в комментариях, Яндекс OAuth позволяет сменить аккаунт, autoplay консистентно.

</domain>

<decisions>
## Implementation Decisions

### Filter Persistence (R21)
- **D-01:** Перевести фильтры на URL searchParams: `/learn?category=MARKETING&status=IN_PROGRESS`. При изменении фильтра → `router.push` с новыми params.
- **D-02:** При загрузке страницы — инициализировать state из `useSearchParams()`. Default → без params (ALL).
- **D-03:** Кнопка "Назад" браузера автоматически восстановит фильтры через URL.

### Tour Repeat Fix (R46)
- **D-04:** Баг: `setTimeout(1500)` в useEffect fires при каждом pathname change, localStorage check происходит до setTimeout callback. Fix: проверять localStorage ВНУТРИ setTimeout callback. Добавить `hasAutoStartedRef` — ставить true после первого авто-запуска в сессии.
- **D-05:** Tour запускается автоматически только 1 раз per page per lifetime (localStorage). Кнопка "?" для повторного запуска.

### Comment Author Display (R43)
- **D-06:** В `CommentItem.tsx` показывать `comment.user.name ?? 'Пользователь'`. Никогда не показывать raw email.
- **D-07:** В backend `comments.ts` — если `profile.name` is null, возвращать `null` (не email). Frontend обработает fallback.

### Yandex OAuth Account Switch (R10)
- **D-08:** Добавить `prompt=login` в Yandex OAuth redirect URL. Это заставит Яндекс показать экран выбора аккаунта при каждом входе.
- **D-09:** Проверить: Supabase Yandex provider config или наш custom redirect в `actions.ts`.

### Autoplay Behavior (R22)
- **D-10:** Autoplay = false (уже установлено). Верифицировать что нет conditional autoplay логики. Если есть — убрать.

### Claude's Discretion
- Exact searchParams serialization format
- FilterPanel component refactor scope (minimal)
- hasAutoStartedRef implementation details

</decisions>

<canonical_refs>
## Canonical References

### Filters
- `apps/web/src/app/(main)/learn/page.tsx` — FilterState, useState (line 54), DEFAULT_FILTERS
- `apps/web/src/components/learning/FilterPanel.tsx` — FilterState interface, filter controls

### Tour
- `apps/web/src/components/shared/TourProvider.tsx` — localStorage check (line 59), setTimeout (line 64), auto-start logic

### Comments
- `apps/web/src/components/comments/CommentItem.tsx` — displayName (line 154)
- `packages/api/src/routers/comments.ts` — author profile query

### OAuth
- `apps/web/src/lib/auth/actions.ts` — signIn with Yandex OAuth
- Supabase Dashboard — Yandex provider settings

### Autoplay
- `apps/web/src/components/video/KinescopePlayer.tsx` — autoPlay prop

### Audit Screenshots
- `screenshots/audit/sheet0_obuchenie/R10_*.png` — Yandex OAuth no account switch
- `screenshots/audit/sheet0_obuchenie/R21_*.png` — filter reset on back
- `screenshots/audit/sheet0_obuchenie/R43_IMG_7483.png` — email in comments
- `screenshots/audit/sheet0_obuchenie/R46_IMG_7490.png` — tour every 15 min

</canonical_refs>

<code_context>
## Existing Code Insights

### Filter State
- `learn/page.tsx:54` — `const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)` — pure React state, no URL
- `FilterPanel.tsx` — `FilterState` interface with 7 fields (category, status, topics, difficulty, duration, courseId, marketplace)
- Next.js `useSearchParams()` + `useRouter()` available

### Tour Persistence
- `TourProvider.tsx:16-17` — `getLocalStorageKey(page)` returns `tour_${page}_completed`
- `TourProvider.tsx:59` — check happens BEFORE setTimeout
- `TourProvider.tsx:64` — setTimeout(1500) fires on every pathname change

### Comments
- `CommentItem.tsx:154` — `const displayName = comment.user.name || 'Пользователь'` — already correct but backend may send email as name
- `comments.ts` — need to check what's returned in user.name field

### OAuth
- `actions.ts` — `supabase.auth.signInWithOAuth({ provider: 'yandex', options: { redirectTo } })`
- Supabase handles Yandex OAuth flow — `prompt` param may need to go in `options.queryParams`

</code_context>

<specifics>
## Specific Ideas

- searchParams should be shallow (no full page reload) — use `router.replace` not `router.push`
- Filter serialization: only include non-default values in URL (clean URLs)
- Tour fix is 2-3 lines change — move localStorage check inside callback

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-navigation-filters*
*Context gathered: 2026-03-27*
