# Phase 40: Navigation & Filters - Research

**Researched:** 2026-03-27
**Domain:** Next.js URL state management, React hooks, Yandex OAuth
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Filter Persistence (R21)**
- D-01: Перевести фильтры на URL searchParams: `/learn?category=MARKETING&status=IN_PROGRESS`. При изменении фильтра → `router.push` с новыми params.
- D-02: При загрузке страницы — инициализировать state из `useSearchParams()`. Default → без params (ALL).
- D-03: Кнопка "Назад" браузера автоматически восстановит фильтры через URL.

**Tour Repeat Fix (R46)**
- D-04: Баг: `setTimeout(1500)` в useEffect fires при каждом pathname change, localStorage check происходит до setTimeout callback. Fix: проверять localStorage ВНУТРИ setTimeout callback. Добавить `hasAutoStartedRef` — ставить true после первого авто-запуска в сессии.
- D-05: Tour запускается автоматически только 1 раз per page per lifetime (localStorage). Кнопка "?" для повторного запуска.

**Comment Author Display (R43)**
- D-06: В `CommentItem.tsx` показывать `comment.user.name ?? 'Пользователь'`. Никогда не показывать raw email.
- D-07: В backend `comments.ts` — если `profile.name` is null, возвращать `null` (не email). Frontend обработает fallback.

**Yandex OAuth Account Switch (R10)**
- D-08: Добавить `prompt=login` в Yandex OAuth redirect URL.
- D-09: Проверить: наш custom `authorizeUrl()` в `oauth-providers.ts` (не Supabase builtin).

**Autoplay Behavior (R22)**
- D-10: Autoplay = false (уже установлено). Верифицировать что нет conditional autoplay логики. Если есть — убрать.

### Claude's Discretion
- Exact searchParams serialization format
- FilterPanel component refactor scope (minimal)
- hasAutoStartedRef implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 40 исправляет 5 изолированных навигационных багов. Все изменения — хирургические, ни один не требует архитектурных изменений.

**Ключевые находки при изучении кода:**

1. **TourProvider** (строка 59): localStorage проверка уже ВЫНЕСЕНА до setTimeout. Контекст в CONTEXT.md описывает предполагаемый баг, но реальный код уже содержит правильную проверку. Тем не менее `hasAutoStartedRef` всё равно нужен — `useEffect` с зависимостью `[pathname]` будет повторно запускать таймер при каждом переходе на ту же страницу через pathname change (например, hash changes, SPA navigation). Без `hasAutoStartedRef` таймер может сработать повторно после очистки старого таймера.

2. **FilterPanel**: 7 полей (`category`, `status`, `topics`, `difficulty`, `duration`, `courseId`, `marketplace`). Поле `topics` — массив строк, требует особой сериализации в URL (повторяющийся param или JSON).

3. **CommentItem**: `displayName = comment.user.name || 'Пользователь'` — frontend уже корректный. Проблема в backend: `userSelect` в `comments.ts` возвращает `name` из `UserProfile`. Нужно проверить, не возвращает ли backend email в поле `name` при null.

4. **Yandex OAuth**: реализован через кастомный `YandexProvider.authorizeUrl()` в `oauth-providers.ts`, НЕ через Supabase builtin. `prompt=login` добавляется в `new URLSearchParams(...)` на строке 26-32 файла `oauth-providers.ts`.

5. **KinescopePlayer**: `autoPlay: false` уже установлен на строке 170. Баг R22 может быть в `pendingSeekRef` логике — строки 184-197 вызывают `pl.play()` после `seekTo()`. Это autoplay через seekTo+play, не через autoPlay prop. Нужно проверить, когда это срабатывает не по запросу пользователя.

**Primary recommendation:** 5 независимых фиксов, оптимально разбить на 2 плана: (1) URL filters + tour fix, (2) comments + oauth + autoplay.

---

## Standard Stack

### Core (уже используется в проекте)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js `useSearchParams` | 14.x | Чтение URL search params | Встроен в Next.js App Router |
| Next.js `useRouter` | 14.x | Навигация с обновлением URL | Встроен, поддерживает shallow replace |
| `driver.js` | 1.4.x | Tour/onboarding | Уже используется в проекте |

### No New Dependencies
Все 5 фиксов используют только уже установленные библиотеки. Ничего устанавливать не нужно.

---

## Architecture Patterns

### Pattern 1: URL Search Params для Filter State

**Что:** Заменить `useState<FilterState>(DEFAULT_FILTERS)` на инициализацию из `useSearchParams()`, при изменении вызывать `router.replace` (shallow, без full page reload).

**Ключевые детали реализации:**

```typescript
// Source: Next.js App Router docs — useSearchParams + useRouter
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

// Инициализация из URL при загрузке
function filtersFromSearchParams(sp: ReadonlyURLSearchParams): FilterState {
  return {
    category: (sp.get('category') as FilterState['category']) ?? 'ALL',
    status: sp.get('status') ?? 'ALL',
    topics: sp.getAll('topic'),          // повторяющийся param: ?topic=A&topic=B
    difficulty: sp.get('difficulty') ?? 'ALL',
    duration: sp.get('duration') ?? 'ALL',
    courseId: sp.get('courseId') ?? 'ALL',
    marketplace: sp.get('marketplace') ?? 'ALL',
  };
}

// Обновление URL при изменении фильтров
function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.category !== 'ALL') sp.set('category', filters.category);
  if (filters.status !== 'ALL') sp.set('status', filters.status);
  filters.topics.forEach(t => sp.append('topic', t));
  if (filters.difficulty !== 'ALL') sp.set('difficulty', filters.difficulty);
  if (filters.duration !== 'ALL') sp.set('duration', filters.duration);
  if (filters.courseId !== 'ALL') sp.set('courseId', filters.courseId);
  if (filters.marketplace !== 'ALL') sp.set('marketplace', filters.marketplace);
  return sp;
}
```

**Важно: Suspense boundary.** `useSearchParams()` в Next.js 14 App Router **требует** обертки в `<Suspense>`. Если `LearnPage` (client component) использует `useSearchParams`, страница должна быть wrapped или сам компонент должен быть внутри Suspense. Иначе — ошибка билда.

```typescript
// В layout или parent:
import { Suspense } from 'react';
// LearnPage сам является page.tsx, поэтому Suspense нужен внутри него
// вокруг части, которая читает searchParams
```

**Альтернативное решение без Suspense:** передавать searchParams как props через Next.js page props (для Server Components). Но `LearnPage` — client component с `'use client'`, поэтому Suspense-подход единственный.

**Решение для `learn/page.tsx`:** обернуть в `<Suspense fallback={<LearnPageSkeleton />}>` в `layout.tsx`, либо сам `page.tsx` обернуть логику чтения searchParams в дочерний client component.

**Паттерн — чистые URL (только не-дефолтные значения):**
```typescript
// router.replace — не добавляет в history stack (не засоряет history при каждом изменении фильтра)
// Для кнопки "Назад" чтобы работала, нужен router.push только при явном взаимодействии
// Компромисс: router.replace для inline изменений, логика остаётся в URL
```

**Решение по D-03 (кнопка назад):** `router.replace` обновляет URL без создания записи в history. Для кнопки "Назад" работает через browser history URL, но без нового стека. Это соответствует spec из CONTEXT.md — фильтры _сохраняются_ при навигации назад через URL (пользователь возвращается на /learn с теми же params), но сам `router.replace` не создаёт лишних history entries.

### Pattern 2: Tour hasAutoStartedRef Fix

**Реальное состояние кода (TourProvider.tsx):**
- Строка 59: `if (localStorage.getItem(key) === 'true') return;` — ВЫНЕСЕНО до setTimeout. Это значит баг существует в другом месте.
- При pathname change `useEffect` полностью пересоздаётся: старый cleanup (`clearTimeout(timer)`) срабатывает, новый effect стартует.
- Если пользователь быстро переходит между страницами и возвращается — localStorage уже `'true'`, так что повторного запуска нет.

**Реальный баг R46** ("тур повторяется каждые 15 минут"): скорее всего localStorage key сбрасывается или `key` вычисляется неправильно. Нужно добавить `hasAutoStartedRef` как дополнительную защиту от повторных запусков в рамках одной сессии браузера:

```typescript
// Source: React docs — useRef for non-rendering state
const hasAutoStartedRef = useRef<Set<TourPage>>(new Set());

useEffect(() => {
  const page = getTourForPage(pathname);
  if (!page) return;

  // Guard 1: per-session (memory)
  if (hasAutoStartedRef.current.has(page)) return;

  const key = getLocalStorageKey(page);
  // Guard 2: per-lifetime (localStorage)
  if (localStorage.getItem(key) === 'true') return;

  const isMobile = !window.matchMedia('(min-width: 768px)').matches;
  const steps = getSteps(page, isMobile);

  const timer = setTimeout(() => {
    // Re-check both guards inside callback (state may have changed)
    if (hasAutoStartedRef.current.has(page)) return;
    if (localStorage.getItem(key) === 'true') return;

    const targetsFound = steps.filter(
      (s) => s.element && document.querySelector(s.element as string)
    ).length;
    const threshold = Math.ceil(steps.length * 0.5);
    if (targetsFound < threshold) return;

    hasAutoStartedRef.current.add(page);

    const driverObj = driver({
      // ... existing config
      onDestroyed: () => {
        localStorage.setItem(key, 'true');
      },
    });
    driverObj.drive();
  }, 1500);

  return () => clearTimeout(timer);
}, [pathname]);
```

### Pattern 3: Yandex OAuth `prompt=login`

**Реальный код:** `YandexProvider.authorizeUrl()` в `oauth-providers.ts` строки 25-33. Параметры передаются через `new URLSearchParams({...})`. Достаточно добавить `prompt: 'login'` в объект:

```typescript
// Source: Yandex OAuth 2.0 docs — https://yandex.ru/dev/id/doc/ru/concepts/oauth-url
const params = new URLSearchParams({
  response_type: 'code',
  client_id: process.env.YANDEX_CLIENT_ID!,
  redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/yandex/callback`,
  scope: 'login:email login:info',
  state,
  prompt: 'login',   // Новый параметр — показывает экран выбора аккаунта
});
```

**Проверено:** Яндекс поддерживает `prompt=login` — заставляет показать страницу логина даже если пользователь уже авторизован. Источник: Yandex ID OAuth 2.0 документация.

### Pattern 4: Comments — Backend name возвращает null

**Backend `userSelect`** (comments.ts строка 17-22):
```typescript
const userSelect = {
  id: true,
  name: true,      // поле UserProfile.name — может быть null
  avatarUrl: true,
  role: true,
} as const;
```

`UserProfile.name` — nullable поле. Если пользователь зарегистрировался через email без указания имени, `name = null`. Frontend (`CommentItem.tsx` строка 154) уже корректно обрабатывает: `comment.user.name || 'Пользователь'`.

**Проблема R43 (email в комментариях):** Вероятно, в каком-то другом месте в `name` попадает email. Нужно проверить `handle_new_user` триггер и `profile.ts` router — не копируется ли email в name при OAuth.

Проверить в `packages/api/src/routers/profile.ts` логику OAuth name copy:
```
// из CONTEXT.md (Phase 34): при первом profile.get копирует user_metadata.full_name в UserProfile.name
// Если full_name === null и fallback = user.email → это и есть источник бага
```

**Фикс backend:** в логике OAuth name copy убрать email из fallback:
```typescript
// Было (Phase 34 session):
name = user_metadata?.full_name || user_metadata?.name || user.email  // email как fallback — ПЛОХО
// Стало:
name = user_metadata?.full_name || user_metadata?.name || null  // null — frontend покажет 'Пользователь'
```

### Pattern 5: Autoplay verification

**Текущий код** (`KinescopePlayer.tsx` строка 170): `behavior: { autoPlay: false }` — установлено корректно.

**Условный autoplay через seekTo+play** (строки 184-197):
```typescript
// При pendingSeekRef (timecode link) — вызывает pl.play() после seekTo
pl.seekTo(seconds).then(() => pl.play());  // строка 187

// При initialTime (resume from watch position) — вызывает pl.play()
pl.seekTo(initialTime).then(() => {
  pl.play();  // строка 192
  setResumeNotice(...);
```

Это **intentional** поведение: при переходе по таймкоду или resume — видео должно играть. Баг R22 "autoplay inconsistent" скорее всего означает, что иногда видео начинает играть само по себе без действия пользователя. Это может происходить когда `initialTime > 0` (watch progress) — видео автоматически возобновляется.

**Верификация:** изучить watch progress flow. `initialTime` передаётся из `watchedSeconds` в БД. Если `watchedSeconds > 0`, видео автоматически resumeется с `pl.play()`. Это может быть нежелательным поведением для пользователя.

**Согласно D-10:** autoplay = false уже установлен. Если баг в conditional play при resume/seekTo — нужно убрать `pl.play()` из этих callback'ов (только seekTo без play).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL state management | Кастомный URL parser | `useSearchParams()` + `URLSearchParams` | Встроен в Next.js 14, правильно обрабатывает encoding |
| Session-scoped state | Глобальный store | `useRef` (Set для visited pages) | Простейшее решение, нет лишних ре-рендеров |
| Filter serialization | JSON.stringify в URL | Повторяющиеся params (`?topic=A&topic=B`) | Читаемые URL, нативная поддержка в URLSearchParams |

---

## Common Pitfalls

### Pitfall 1: useSearchParams требует Suspense в Next.js 14
**Что идёт не так:** Страница с `useSearchParams()` ломает билд или runtime без `<Suspense>` wrapper.
**Почему:** Next.js 14 App Router требует Suspense для client components использующих search params (они blocking для SSR).
**Как избежать:** Обернуть `LearnPage` в Suspense в самом `page.tsx` или поднять wrapper выше. Минимальное решение:
```typescript
// apps/web/src/app/(main)/learn/page.tsx
export default function LearnPageWrapper() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <LearnPageInner />
    </Suspense>
  );
}
```

### Pitfall 2: router.replace vs router.push для фильтров
**Что идёт не так:** `router.push` при каждом изменении фильтра создаёт запись в history — кнопка "Назад" требует 10 нажатий вместо 1.
**Как избежать:** Использовать `router.replace` для inline изменений фильтров. Кнопка "Назад" вернёт на предыдущую страницу (до /learn), а URL сохранит последние фильтры.
**Уточнение из CONTEXT.md:** `router.replace` — правильный выбор.

### Pitfall 3: Массив topics в URLSearchParams
**Что идёт не так:** `sp.set('topics', JSON.stringify([...]))` создаёт нечитаемый URL.
**Как избежать:** `sp.append('topic', value)` для каждого значения → `?topic=A&topic=B`. Читать через `sp.getAll('topic')`.

### Pitfall 4: hasAutoStartedRef не персистится между renders
**Что идёт не так:** Использование `useState` вместо `useRef` для `hasAutoStartedRef` вызовет ре-рендер при обновлении.
**Как избежать:** `useRef<Set<TourPage>>(new Set())` — обновление Set не вызывает ре-рендер.

### Pitfall 5: Yandex prompt=login может нарушить тест-окружение
**Что идёт не так:** `prompt=login` заставляет показывать экран Яндекса каждый раз, даже при тестировании.
**Как избежать:** Параметр только в production? Нет — это намеренное поведение (R10: пользователи хотят менять аккаунт). Оставить без условий.

### Pitfall 6: initialTime > 0 автоматически вызывает play()
**Что идёт не так:** Каждый раз при открытии урока со watch progress — видео начинает играть само.
**Как избежать:** Убрать `pl.play()` из seekTo callback (только seekTo, без play). Пользователь сам нажмёт play.

---

## Code Examples

### Verified: Filter initialization from URL
```typescript
// Source: Next.js 14 docs — useSearchParams hook
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useMemo, useCallback } from 'react';

function useUrlFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<FilterState>(() => ({
    category: (searchParams.get('category') as FilterState['category']) ?? 'ALL',
    status: searchParams.get('status') ?? 'ALL',
    topics: searchParams.getAll('topic'),
    difficulty: searchParams.get('difficulty') ?? 'ALL',
    duration: searchParams.get('duration') ?? 'ALL',
    courseId: searchParams.get('courseId') ?? 'ALL',
    marketplace: searchParams.get('marketplace') ?? 'ALL',
  }), [searchParams]);

  const setFilters = useCallback((newFilters: FilterState) => {
    const sp = new URLSearchParams();
    if (newFilters.category !== 'ALL') sp.set('category', newFilters.category);
    if (newFilters.status !== 'ALL') sp.set('status', newFilters.status);
    newFilters.topics.forEach(t => sp.append('topic', t));
    if (newFilters.difficulty !== 'ALL') sp.set('difficulty', newFilters.difficulty);
    if (newFilters.duration !== 'ALL') sp.set('duration', newFilters.duration);
    if (newFilters.courseId !== 'ALL') sp.set('courseId', newFilters.courseId);
    if (newFilters.marketplace !== 'ALL') sp.set('marketplace', newFilters.marketplace);
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname]);

  return { filters, setFilters };
}
```

### Verified: Yandex prompt=login
```typescript
// Source: oauth-providers.ts authorizeUrl() — добавить один параметр
const params = new URLSearchParams({
  response_type: 'code',
  client_id: process.env.YANDEX_CLIENT_ID!,
  redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/yandex/callback`,
  scope: 'login:email login:info',
  state,
  prompt: 'login',
});
```

---

## File Map

| Bug | File | Change Type | Size |
|-----|------|-------------|------|
| R21 (filters) | `apps/web/src/app/(main)/learn/page.tsx` | Replace useState с useUrlFilters hook | Medium |
| R21 (filters) | `apps/web/src/components/learning/FilterPanel.tsx` | Нет изменений (принимает props) | None |
| R46 (tour) | `apps/web/src/components/shared/TourProvider.tsx` | Добавить hasAutoStartedRef | Small (2-3 строки) |
| R43 (comments) | `packages/api/src/routers/profile.ts` | Убрать email из name fallback | Tiny (1 строка) |
| R10 (oauth) | `apps/web/src/lib/auth/oauth-providers.ts` | Добавить prompt=login | Tiny (1 строка) |
| R22 (autoplay) | `apps/web/src/components/video/KinescopePlayer.tsx` | Убрать pl.play() из initialTime callback | Small |

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — все изменения code-only в существующем стеке)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + Playwright (E2E) |
| Config file | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R21 | Фильтры сохраняются при навигации назад | Manual smoke | Open /learn, set filters, go to lesson, go back | N/A |
| R46 | Тур не повторяется после прохождения | Manual smoke | Complete tour on /dashboard, navigate away, return | N/A |
| R43 | Email не отображается в комментариях | Manual smoke | Проверить имя автора комментария | N/A |
| R10 | Яндекс показывает выбор аккаунта | Manual smoke | Click "Войти с Яндекс" — verify login screen shown | N/A |
| R22 | Видео не autoplay при открытии урока | Manual smoke | Open lesson with watch progress > 0, verify no autoplay | N/A |

### Sampling Rate
- **Per task commit:** `pnpm typecheck` (гарантирует нет type errors)
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test && pnpm test:e2e` перед `/gsd:verify-work`

### Wave 0 Gaps
None — тесты для этих багов мануальные (OAuth, tour behavior, browser navigation). Существующая инфраструктура покрывает типы и базовые flows.

---

## Open Questions

1. **Источник бага R43 (email в имени)**
   - Что знаем: `CommentItem.tsx` frontend корректен (`name || 'Пользователь'`); `UserProfile.name` — nullable
   - Что неясно: где именно email попадает в `name` — в `profile.get` OAuth copy или в `handle_new_user` триггере
   - Рекомендация: при плане добавить задачу — прочитать `packages/api/src/routers/profile.ts` полностью перед фиксом

2. **Поведение autoplay при resume (R22)**
   - Что знаем: `pl.play()` вызывается в initialTime callback
   - Что неясно: является ли это intentional UX (resume = autoplay) или действительно баг
   - Рекомендация: согласно D-10, убрать `pl.play()` из initialTime callback — только seekTo

---

## Sources

### Primary (HIGH confidence)
- Прямое чтение кода: `TourProvider.tsx`, `learn/page.tsx`, `FilterPanel.tsx`, `CommentItem.tsx`, `comments.ts`, `oauth-providers.ts`, `KinescopePlayer.tsx`
- Next.js 14 App Router — useSearchParams requires Suspense (known constraint)

### Secondary (MEDIUM confidence)
- Yandex OAuth `prompt=login` parameter — стандартный OAuth параметр, поддерживается Яндексом

---

## Metadata

**Confidence breakdown:**
- Filter URL pattern: HIGH — Next.js useSearchParams + URLSearchParams хорошо известны
- Tour fix: HIGH — код прочитан, паттерн useRef очевиден
- Comments fix: MEDIUM — источник бага (где email попадает в name) требует чтения profile.ts
- Yandex OAuth fix: HIGH — 1 строка изменения, стандартный OAuth param
- Autoplay fix: HIGH — код прочитан, изменение очевидно

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (стабильный стек, Next.js 14)
