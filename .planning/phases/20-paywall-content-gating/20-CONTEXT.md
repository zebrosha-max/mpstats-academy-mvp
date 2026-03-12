# Phase 20: Paywall + Content Gating - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Блокировка платного контента для пользователей без подписки. Бесплатный превью (первые 2 урока), lock UI на платных уроках, замки в каталоге, централизованный access service в tRPC. Диагностика бесплатна всем, но персональный трек («Мой трек») доступен только с PLATFORM-подпиской. При billing_enabled=false весь контент открыт.

</domain>

<decisions>
## Implementation Decisions

### Бесплатный превью
- Первые 2 урока каждого курса (order=1, order=2) бесплатны автоматически — без ручной настройки
- Бесплатный урок = полный опыт: видео + AI Summary + Chat + таймкоды — без ограничений
- Регистрация обязательна для просмотра любых уроков (включая бесплатные) — protectedProcedure сохраняется
- На бесплатных уроках — мягкий баннер под видео: «Вам доступно ещё N уроков — оформите подписку» с CTA → /pricing

### Lock UI на платных уроках
- Вместо видео — блок с замком, названием урока и CTA «Оформить подписку» → /pricing
- Название и описание урока видны, AI панель (Summary + Chat) скрыта
- Навигация prev/next работает — можно листать между залоченными уроками (видны названия, описания)
- Прямой URL на залоченный урок (/learn/lesson_id) → показывает lock UI (не редирект)

### Каталог курсов (/learn)
- Все уроки видны в каталоге, платные помечены иконкой замка 🔒 на LessonCard (вместо play)
- LessonCard с замком кликабельна — открывает страницу урока с lock UI
- Под курсом (после бесплатных уроков) — мини-баннер «Ещё N уроков доступны по подписке → /pricing»
- Прогресс курса считается от всех уроков: «2 из 15 уроков», прогресс-бар от просмотренных из доступных

### Доступ COURSE vs PLATFORM
- COURSE-подписка: все уроки купленного курса открыты. В других курсах — превью (первые 2) + замки
- PLATFORM-подписка: все уроки всех курсов открыты + персональный трек «Мой трек»
- Диагностика бесплатна всем (5 осей, Radar Chart) независимо от подписки
- Персональный трек «Мой трек» = фича PLATFORM: без подписки — превью (первые 3 урока трека видны, остальные blur + CTA «Оформить полный доступ»)
- Таб «Мой трек» на /learn виден всегда (если диагностика пройдена), но без PLATFORM показывает превью + CTA
- Страница результатов диагностики: первые 3 урока трека видны, остальные blur + CTA на полный доступ

### Апгрейд COURSE → PLATFORM
- При покупке PLATFORM — существующие COURSE-подписки автоматически отменяются (CANCELLED, доступ до currentPeriodEnd)
- PLATFORM начинается с полной цены, без proration (доплата — deferred)
- Множественные COURSE-подписки на разные курсы разрешены

### Feature flag
- При billing_enabled=false: весь контент доступен без ограничений, замки не показываются, баннеры скрыты
- Централизованный access service в tRPC (не middleware) — Edge Runtime не может использовать Prisma

### Claude's Discretion
- Точный дизайн lock UI блока (цвета, иконка, размер)
- Стиль мягкого баннера на бесплатных уроках
- Стиль мини-баннера под курсом в каталоге
- Реализация blur-эффекта для превью трека
- Архитектура access service (отдельная утилита vs middleware в tRPC)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **billing router** (`packages/api/src/routers/billing.ts`): getSubscription, getPlans, isEnabled — для проверки подписки
- **isFeatureEnabled()** (`packages/api/src/utils/feature-flags.ts`): billing_enabled check
- **LessonCard** (`components/learning/LessonCard.tsx`): добавить prop `locked` для иконки замка
- **DiagnosticGateBanner** (`components/learning/DiagnosticGateBanner.tsx`): паттерн gate-баннера — переиспользовать для paywall
- **Badge component** (`components/ui/badge.tsx`): 15+ вариантов для статусов
- **Card component** (`components/ui/card.tsx`): варианты для lock UI блока

### Established Patterns
- tRPC: protectedProcedure для всех lesson endpoints — paywall проверка добавляется здесь
- Lesson page: `learning.getLesson` возвращает lesson + course + navigation — добавить поле `locked: boolean`
- Learn page: viewMode 'path' | 'courses' — таб «Мой трек» уже есть, добавить gating
- Subscription query: `billing.getSubscription` — ACTIVE/CANCELLED с courseId
- Feature flag pattern: `if (!enabled) return []` — весь контент доступен при выключенном billing

### Integration Points
- `packages/api/src/routers/learning.ts` — добавить access check в getCourses, getLesson, getPath
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — lock UI вместо видео для заблокированных
- `apps/web/src/app/(main)/learn/page.tsx` — замки на LessonCard, баннеры под курсами
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` — превью трека с blur
- `apps/web/src/components/learning/LessonCard.tsx` — prop locked + иконка замка

</code_context>

<specifics>
## Specific Ideas

- «Диагностика может быть фичей оценки знаний для всех, а персональный трек — премиум за полный доступ» — ключевая идея upsell через превью трека
- Превью трека после диагностики: первые 3 урока видны, остальные blur — мотивация к покупке PLATFORM
- Баннер на бесплатных уроках ненавязчивый — не мешает просмотру, но напоминает о подписке

</specifics>

<deferred>
## Deferred Ideas

- **Proration при апгрейде COURSE → PLATFORM** — расчёт доплаты пропорционально оставшимся дням COURSE-подписок. Требует хранение CP subscription ID и сложную биллинг-логику. → v1.3 (BILL-10)
- **Автоматическая отмена COURSE при покупке PLATFORM через CP API** — сейчас отмена локальная. Для полной отмены рекуррента нужен CP subscription ID из webhook Token. → v1.3
- **Настраиваемое количество бесплатных уроков per-course** — сейчас hardcode 2 для всех. Поле Course.freeLessonsCount для гибкости. → будущая фаза если понадобится
- **AI (Summary/Chat) как отдельная premium-фича** — ограничить AI-функционал для бесплатных уроков. Пока всё открыто на бесплатных уроках. → будущая фаза
- **Уведомления о событиях подписки** (email при оплате, отказе, конце периода) — Phase 22

</deferred>

---

*Phase: 20-paywall-content-gating*
*Context gathered: 2026-03-12*
