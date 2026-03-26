# Roadmap: MAAL

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-02-26)
- ✅ **v1.1 Admin & Polish** — Phases 10-15 (shipped 2026-02-28)
- ✅ **v1.2 Auth Rework + Billing** — Phases 16-21 (shipped 2026-03-12)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Data Foundation (4/4 plans) — completed 2026-02-17
- [x] Phase 2: AI Question Generation (2/2 plans) — completed 2026-02-25
- [x] Phase 3: Video Integration (2/2 plans) — completed 2026-02-18
- [x] Phase 4: Access Control & Personalization (2/2 plans) — completed 2026-02-25
- [x] Phase 5: Security Hardening (2/2 plans) — completed 2026-02-25
- [x] Phase 5.1: VPS Infrastructure Setup (2/2 plans) — completed 2026-02-24
- [x] Phase 6: Production Deploy (2/2 plans) — completed 2026-02-24
- [x] Phase 7: Lesson & Course Name Cleanup (2/2 plans) — completed 2026-02-26
- [x] Phase 8: Documentation & Traceability Sync (1/1 plan) — completed 2026-02-26
- [x] Phase 9: Integration Wire-Up (1/1 plan) — completed 2026-02-26

Full details: `milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Admin & Polish (Phases 10-15) — SHIPPED 2026-02-28</summary>

- [x] Phase 10: Superuser & Admin Panel (3/3 plans) — completed 2026-02-26
- [x] Phase 11: Summary & Sources UX (1/1 plan) — completed 2026-02-27
- [x] Phase 12: Lesson Page Performance (1/1 plan) — completed 2026-02-27
- [x] Phase 13: Watch Progress Tracking (2/2 plans) — completed 2026-02-27
- [x] Phase 14: Tech Debt Cleanup (2/2 plans) — completed 2026-02-27
- [x] Phase 15: Landing Redesign & Theme Toggle (2/2 plans) — completed 2026-02-27

Full details: `milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Auth Rework + Billing (Phases 16-21) — SHIPPED 2026-03-12</summary>

**Milestone Goal:** Заменить Google OAuth на Яндекс ID, построить систему биллинга через CloudPayments с подписками, реализовать paywall с бесплатным превью контента, мигрировать домен.

- [x] Phase 16: Billing Data Foundation (2/2 plans) — completed 2026-03-10
- [x] Phase 17: Yandex ID Auth (2/2 plans) — completed 2026-03-10
- [x] Phase 18: CloudPayments Webhooks (2/2 plans) — completed 2026-03-10
- [x] Phase 19: Billing UI + Payment Flow (2/2 plans) — completed 2026-03-11
- [x] Phase 20: Paywall + Content Gating (2/2 plans) — completed 2026-03-12
- [x] Phase 21: Domain Migration (2/2 plans) — completed 2026-03-11

Full details: see Phase Details below

</details>

## Phase Details

### Phase 16: Billing Data Foundation
**Goal**: Платформа имеет модели данных для подписок, платежей и feature flags, готовые к использованию всеми последующими фазами
**Depends on**: Phase 15 (v1.1 complete)
**Requirements**: BILL-06, BILL-04
**Success Criteria** (what must be TRUE):
  1. Prisma-модели Subscription, Payment, PaymentEvent и FeatureFlag существуют в схеме и мигрированы в Supabase
  2. Feature flag `billing_enabled` читается из DB и может быть переключён через admin-панель без деплоя
  3. Поля Course.price и Course.isFree добавлены, seed-данные установлены (billing выключен по умолчанию)
  4. UserProfile.yandexId поле добавлено для будущей привязки Яндекс-аккаунтов
**Plans:** 2/2 plans complete

Plans:
- [x] 16-01-PLAN.md — Prisma billing models, migration, seed script, feature flag helper
- [x] 16-02-PLAN.md — Feature flag admin endpoints + /admin/settings page with toggles

### Phase 17: Yandex ID Auth
**Goal**: Пользователи входят через Яндекс ID вместо Google OAuth, тестовые аккаунты перерегистрируются, архитектура расширяема для будущих провайдеров
**Depends on**: Phase 16 (UserProfile.yandexId field)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Пользователь может нажать "Войти через Яндекс" и авторизоваться через Яндекс ID OAuth flow
  2. Существующий Google-аккаунт автоматически связывается с Яндекс-аккаунтом по совпадению verified email -- все данные (диагностики, прогресс, профиль) сохраняются
  3. Кнопка "Войти через Google" убрана из UI, Google OAuth провайдер отключён в Supabase
  4. OAuth-архитектура реализована через абстракцию провайдера, позволяющую добавить новый провайдер (Точка ID) без переписывания core auth
  5. Вход через email/password продолжает работать как fallback
**Plans:** 2/2 plans complete

Plans:
- [x] 17-01-PLAN.md — OAuthProvider abstraction + YandexProvider + Supabase admin client + callback route
- [x] 17-02-PLAN.md — Login/register UI replacement (Google -> Yandex) + Google removal + human verify

### Phase 18: CloudPayments Webhooks
**Goal**: Платформа корректно обрабатывает все события жизненного цикла подписки от CloudPayments
**Depends on**: Phase 16 (Subscription, Payment, PaymentEvent models)
**Requirements**: BILL-02, BILL-03
**Success Criteria** (what must be TRUE):
  1. Webhook endpoint принимает события Check/Pay/Fail/Recurrent/Cancel от CloudPayments с HMAC-SHA256 верификацией
  2. Обработка идемпотентна -- повторный webhook с тем же TransactionId не создаёт дублей и не ломает состояние подписки
  3. Подписка корректно переходит между статусами (active, past_due, cancelled, expired) в ответ на события
  4. Каждый входящий webhook и результат обработки логируется в PaymentEvent для аудита
**Plans:** 2/2 plans complete

Plans:
- [x] 18-01-PLAN.md — HMAC verification + webhook route + idempotent payment processing + audit logging
- [x] 18-02-PLAN.md — Subscription lifecycle service (state machine) + wire into webhook route

### Phase 19: Billing UI + Payment Flow
**Goal**: Пользователь может выбрать тарифный план, оплатить подписку через CloudPayments и управлять ей в профиле
**Depends on**: Phase 18 (working webhooks), Phase 16 (models)
**Requirements**: BILL-01, BILL-05, PAY-02, PAY-04
**Success Criteria** (what must be TRUE):
  1. Страница тарифов отображает доступные планы подписки (per-course и full platform) с ценами из DB
  2. Пользователь может оплатить подписку через CloudPayments widget (iframe) без ввода карточных данных на нашем сайте
  3. В профиле пользователь видит статус подписки, дату следующего списания и может отменить подписку
  4. Два режима подписки работают: Режим A (отдельный курс) и Режим B (вся платформа)
**Plans:** 2/2 plans complete

Plans:
- [x] 19-01-PLAN.md — Prisma PENDING migration, billing tRPC router, CP widget wrapper, cancel API, seed price update
- [x] 19-02-PLAN.md — Pricing page, profile subscription section, sidebar navigation, CP widget integration + human verify

### Phase 20: Paywall + Content Gating
**Goal**: Платный контент заблокирован для пользователей без подписки, бесплатный контент доступен всем
**Depends on**: Phase 19 (billing works end-to-end), Phase 16 (feature flag)
**Requirements**: PAY-01, PAY-03, PAY-05
**Success Criteria** (what must be TRUE):
  1. 1-2 первых урока каждого курса доступны бесплатно, остальные показывают lock UI с CTA "Оформи подписку"
  2. Диагностика навыков остаётся полностью бесплатной для всех пользователей
  3. Централизованный access service в tRPC проверяет подписку -- обойти paywall через прямой URL невозможно
  4. При выключенном billing toggle (feature flag) весь контент доступен без ограничений (для тестирования и демо)
**Plans:** 2/2 plans complete

Plans:
- [x] 20-01-PLAN.md — Access service utility + learning router enrichment with locked flags (completed 2026-03-12)
- [x] 20-02-PLAN.md — Lock UI components, LessonCard lock icon, banners, track preview gating + human verify (completed 2026-03-12)

## Progress

**Execution Order:**
Phases 17 and 18 are independent tracks (auth and billing). Both depend on Phase 16 and can execute in parallel. Phases 19 and 20 are sequential after their dependencies.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 4/4 | Complete | 2026-02-17 |
| 2. AI Question Generation | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. Video Integration | v1.0 | 2/2 | Complete | 2026-02-18 |
| 4. Access Control | v1.0 | 2/2 | Complete | 2026-02-25 |
| 5. Security Hardening | v1.0 | 2/2 | Complete | 2026-02-25 |
| 5.1 VPS Infrastructure | v1.0 | 2/2 | Complete | 2026-02-24 |
| 6. Production Deploy | v1.0 | 2/2 | Complete | 2026-02-24 |
| 7. Lesson Name Cleanup | v1.0 | 2/2 | Complete | 2026-02-26 |
| 8. Documentation Sync | v1.0 | 1/1 | Complete | 2026-02-26 |
| 9. Integration Wire-Up | v1.0 | 1/1 | Complete | 2026-02-26 |
| 10. Superuser & Admin Panel | v1.1 | 3/3 | Complete | 2026-02-26 |
| 11. Summary & Sources UX | v1.1 | 1/1 | Complete | 2026-02-27 |
| 12. Lesson Page Performance | v1.1 | 1/1 | Complete | 2026-02-27 |
| 13. Watch Progress Tracking | v1.1 | 2/2 | Complete | 2026-02-27 |
| 14. Tech Debt Cleanup | v1.1 | 2/2 | Complete | 2026-02-27 |
| 15. Landing Redesign & Theme Toggle | v1.1 | 2/2 | Complete | 2026-02-27 |
| 16. Billing Data Foundation | v1.2 | 2/2 | Complete | 2026-03-10 |
| 17. Yandex ID Auth | v1.2 | 2/2 | Complete | 2026-03-10 |
| 18. CloudPayments Webhooks | v1.2 | 2/2 | Complete | 2026-03-10 |
| 19. Billing UI + Payment Flow | v1.2 | 2/2 | Complete | 2026-03-11 |
| 20. Paywall + Content Gating | v1.2 | 2/2 | Complete | 2026-03-12 |
| 21. Domain Migration | v1.2 | 2/2 | Complete | 2026-03-11 |
| 22. Email Notifications | v1.3 | - | Superseded by Phase 33 | - |
| 23. Diagnostic 2.0 | v1.3 | 3/3 | Complete | 2026-03-17 |
| 26. Yandex Metrika | v1.3 | Complete    | 2026-03-19 | 2026-03-19 |
| 27. SEO + Custom Error Pages | v1.3 | 2/2 | Complete | 2026-03-18 |
| 30. Content Discovery | v1.3 | 2/2 | Complete | 2026-03-18 |
| 31. Admin Roles | v1.3 | 2/2 | Complete | 2026-03-18 |
| 32. Custom Track Management | v1.3 | 2/2 | Complete | 2026-03-19 |
| 33. CQ Email Automation | v1.3 | 2/3 | Code Complete (CQ dashboard pending) | 2026-03-25 |
| 25. Legal + Cookie Consent | v1.3 | 2/2 | Complete | 2026-03-26 |
| 34. User Profile Enhancement | v1.3 | 2/2 | Complete | 2026-03-26 |
| 35. Lesson Comments | v1.3 | 0/0 | Not Planned | - |
| 36. Product Tour / Onboarding | v1.3 | 0/0 | Not Planned | - |

### Phase 21: Domain migration from DuckDNS to platform.mpstats.academy

**Goal:** Перевести production-приложение с временного academyal.duckdns.org на постоянный домен platform.mpstats.academy (DNS, SSL, Nginx, env, OAuth, Docker rebuild, верификация)
**Requirements**: DOM-01, DOM-02, DOM-03, DOM-04, DOM-05, DOM-06
**Depends on:** Phase 19 (production app running)
**Plans:** 2/2 plans complete

Plans:
- [x] 21-01-PLAN.md — DNS A-record (human), VPS infrastructure (Nginx + SSL + env + Docker rebuild) (completed 2026-03-11)
- [x] 21-02-PLAN.md — External OAuth services update (Supabase + Yandex), test fixtures, docs, E2E verification (completed 2026-03-11)

### Phase 22: ~~Transactional email notifications~~ — SUPERSEDED by Phase 33

**Status:** Superseded. All email functionality reimplemented in Phase 33 (CQ Email Automation) with updated event names (pa_ prefix), correct data flow (setUserProps → trackEvent), and expanded scope (10 events vs original 9).

### Phase 23: Diagnostic 2.0 — personalized learning track with lesson-level topic tagging, question-to-content tracing, and error-based path prioritization

**Goal:** Пользователь видит прямую связь между ошибками в диагностике и рекомендованными уроками: мульти-категорийная разметка 405 уроков, привязка вопросов к источникам с таймкодами, 4-секционный трек обучения по ошибкам, хинты с таймкодами на страницах уроков, двойной Radar Chart для повторной диагностики
**Requirements**: DIAG-01, DIAG-02, DIAG-03, DIAG-04, DIAG-05, DIAG-06, DIAG-07, DIAG-08, DIAG-09
**Depends on:** Phase 22
**Success Criteria** (what must be TRUE):
  1. Каждый из 405 уроков размечен 1-3 skillCategories, 2-5 топиками и LLM-назначенной сложностью
  2. Диагностические вопросы содержат sourceChunkIds, sourceLessonIds и sourceTimecodes
  3. "Мой трек" отображает 4 секции-аккордеона (Ошибки / Углубление / Развитие / Продвинутый) вместо плоского списка
  4. Страница урока из секции "Ошибки" показывает хинт с кликабельным таймкодом между видео и табами
  5. При повторной диагностике Radar Chart показывает два полигона (было/стало)
  6. Старые плоские треки продолжают работать (backward compatibility)
**Plans:** 3/3 plans complete

Plans:
- [x] 23-01-PLAN.md — Schema migration (multi-category, topics, sourceData) + shared types + LLM tagging script
- [x] 23-02-PLAN.md — Question source tracing + section-based path generation algorithm
- [x] 23-03-PLAN.md — Frontend: accordion track sections + diagnostic hints + dual Radar Chart + human verify (completed 2026-03-17)

### Phase 24: Support Contact — функционал связи со службой поддержки

**Goal:** Пользователь имеет публичную страницу /support с контактной информацией, FAQ аккордеоном и формой обратной связи через CQ, ссылки на поддержку доступны из sidebar, mobile-nav и landing footer
**Requirements**: SUPP-01, SUPP-02, SUPP-03, SUPP-04
**Depends on:** Phase 23
**Success Criteria** (what must be TRUE):
  1. Страница /support публичная (без авторизации) с контактами (email + CQ чат), FAQ (5 вопросов) и формой обратной связи
  2. Форма отправляет CQ event "Support Request" с темой, сообщением и email
  3. Ссылка "Поддержка" видна в sidebar footer, mobile-nav и landing footer
**Plans:** 1/1 plans complete

Plans:
- [ ] 24-01-PLAN.md — Support page (contacts, FAQ, form with CQ event) + navigation links (sidebar, mobile-nav, landing footer)
### Phase 25: Legal + Cookie Consent — оферта, политики, чекбоксы регистрации, баннер кук

**Goal:** 5 legal-страниц на платформе (/legal/offer, /legal/pdn, /legal/adv, /legal/cookies, /policy), 3 чекбокса на форме регистрации (оферта + ПДн обязательные, рекламная рассылка опциональная), cookie consent баннер, ссылки в footer
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05
**Depends on:** Phase 24
**Success Criteria** (what must be TRUE):
  1. 5 страниц с legal-контентом доступны по URL: /legal/offer, /legal/pdn, /legal/adv, /legal/cookies, /policy
  2. Оферта содержит заполненные пропуски (URL, 24 часа)
  3. Форма регистрации содержит 3 чекбокса: оферта (обязательный), ПДн (обязательный), рекламная рассылка (опциональный)
  4. Регистрация невозможна без обязательных чекбоксов
  5. Cookie consent баннер при первом визите, выбор сохраняется в localStorage
  6. Footer содержит ссылки на все legal-страницы
**Plans:** 2 plans

Plans:
- [x] 25-01-PLAN.md — Legal pages (offer, pdn, adv, cookies, policy) + LegalPageLayout + footer links (completed 2026-03-26)
- [x] 25-02-PLAN.md — Registration checkboxes (offer + PD required, adv optional) + CookieConsent banner (completed 2026-03-26)

### Phase 26: Яндекс Метрика — интеграция аналитики

**Goal:** Счётчик Яндекс.Метрики (94592073) загружается на всех страницах платформы с SPA-трекингом, 8 типизированных целей с параметрами отслеживают ключевые конверсии (регистрация, логин, диагностика, уроки, оплата, CTA), данные о целях доступны в отчётах Метрики
**Requirements**: YM-01, YM-02, YM-03
**Depends on:** Phase 25
**Success Criteria** (what must be TRUE):
  1. YandexMetrika компонент рендерится в production с webvisor, clickmap, trackLinks, accurateTrackBounce
  2. 8 целей с префиксом `platform_` определены в типизированном модуле и вызываются в 7 страницах
  3. Dockerfile содержит ARG+ENV для NEXT_PUBLIC_YANDEX_ID (build-time inlining)
  4. 8 целей созданы в дашборде Метрики как "JavaScript event"
  5. Счётчик подтверждён в production (mc.yandex.ru запросы в DevTools)
**Plans:** 1/1 plans complete

Plans:
- [x] 26-01-PLAN.md — Analytics module (constants + helper + types), YandexMetrika in layout, goal wiring in 7 pages, Dockerfile/env, dashboard goals (completed 2026-03-19)

### Phase 27: SEO + Custom Error Pages — sitemap, robots.txt, OG-теги, брендированные 404/500

**Goal:** Сайт корректно индексируется поисковиками (sitemap, robots.txt), ссылки красиво отображаются в соцсетях (OG-теги с брендированным изображением), каждая страница имеет уникальный title/description, error-страницы брендированы логотипом MPSTATS Academy
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06
**Depends on:** Phase 26
**Success Criteria** (what must be TRUE):
  1. sitemap.xml содержит 4 публичные страницы (/, /pricing, /login, /register)
  2. robots.txt блокирует /dashboard, /learn, /diagnostic, /profile, /admin, /api
  3. Root layout имеет OG-теги (og:image, og:locale ru_RU, og:type website) и title template
  4. Каждый route group имеет уникальный title и description через metadata в layout файлах
  5. Error-страницы (404, error, global-error) показывают логотип MPSTATS Academy
  6. 404 страница ведёт на / (не /dashboard)
**Plans:** 2/2 plans complete

Plans:
- [ ] 27-01-PLAN.md — SEO foundation: root metadata with OG tags + title template, sitemap.ts, robots.ts, OG image
- [ ] 27-02-PLAN.md — Error page branding (Logo on 404/500), per-page metadata via layouts, visual verification

### Phase 28: Боевой CloudPayments — переключение с тестовых на production credentials

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 27
**Plans:** 2 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 28 to break down)

### Phase 29: Sentry Monitoring — мониторинг ошибок в продакшене

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 28
**Plans:** 2 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 29 to break down)

### Phase 30: Content Discovery — smart search по боли, фильтры по урокам, персональный трек

**Goal:** Пользователь находит нужный контент через семантический поиск по проблеме/боли и расширенную фильтрацию (топики, сложность, длительность, курс, маркетплейс), результаты показывают релевантные фрагменты с таймкодами, уроки из рекомендованного трека маркируются badge "В вашем треке"
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05
**Depends on:** Phase 29
**Success Criteria** (what must be TRUE):
  1. Пользователь вводит запрос-боль в поисковую строку на /learn и получает top-10 релевантных уроков с 1-2 фрагментами и таймкодами
  2. 7 фильтров (категория, статус, топики, сложность, длительность, курс, маркетплейс) работают в режимах поиска, курсов и трека
  3. Клик на таймкод фрагмента открывает урок на нужной позиции видео
  4. Уроки из рекомендованного трека показывают badge "В вашем треке" в результатах
  5. Очистка поиска возвращает к обычному режиму курсов/трека
**Plans:** 2/2 plans complete

Plans:
- [x] 30-01-PLAN.md — Backend: searchLessons tRPC endpoint, getCourses extension (topics/skillCategories/skillLevel), splitLink update (completed 2026-03-18)
- [x] 30-02-PLAN.md — Frontend: SearchBar + FilterPanel + SearchResultCard components, /learn page integration, timecode deep-link + human verify (completed 2026-03-18)

### Phase 31: Admin Roles — разделение admin/superadmin, управление доступом команды

**Goal:** Трёхуровневая иерархия ролей (USER / ADMIN / SUPERADMIN) с paywall bypass для админов, защитой привилегий и обновлённым UI админки
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06, ROLE-07, ROLE-08
**Depends on:** Phase 30
**Success Criteria** (what must be TRUE):
  1. Prisma enum Role { USER ADMIN SUPERADMIN } заменяет boolean isAdmin в UserProfile
  2. adminProcedure разрешает ADMIN и SUPERADMIN, superadminProcedure — только SUPERADMIN
  3. ADMIN и SUPERADMIN обходят paywall через admin_bypass в checkLessonAccess
  4. changeUserRole мутация доступна только SUPERADMIN с запретом само-разжалования
  5. UserTable показывает role dropdown для SUPERADMIN и read-only badge для ADMIN
  6. Sidebar и MobileNav показывают условную ссылку "Админка" для ADMIN/SUPERADMIN
**Plans:** 2/2 plans complete

Plans:
- [x] 31-01-PLAN.md — Schema migration (Role enum), tRPC middleware, access bypass, role management mutations
- [x] 31-02-PLAN.md — Frontend: admin layout, UserTable role UI, sidebar admin link + human verify (completed 2026-03-18)

### Phase 32: Custom Track Management — ручное управление персональным треком (добавить/удалить уроки)

**Goal:** Пользователь может вручную добавлять и удалять уроки из персонального трека обучения: кнопка "+" в "Все курсы", удаление из "Мой трек", секция "Мои уроки" сохраняется при перестройке AI-трека и повторной диагностике
**Requirements**: TRACK-01, TRACK-02, TRACK-03, TRACK-04, TRACK-05, TRACK-06, TRACK-07, TRACK-08, TRACK-09, TRACK-10
**Depends on:** Phase 31
**Success Criteria** (what must be TRUE):
  1. LearningPathSection расширен id 'custom' и полем addedAt для ручных добавлений
  2. Три tRPC мутации (addToTrack, removeFromTrack, rebuildTrack) обрабатывают все edge cases
  3. Кнопка "+" на LessonCard в режиме "Все курсы" переключается на checkmark при добавлении
  4. Кнопка "Убрать" в режиме "Мой трек" удаляет урок из любой секции
  5. Секция "Мои уроки" отображается первой с фиолетовым стилем
  6. "Перестроить трек" перегенерирует AI-секции, сохраняя "Мои уроки"
  7. Завершение диагностики не перезаписывает custom-секцию
**Plans:** 2/2 plans complete

Plans:
- [x] 32-01-PLAN.md — Type extensions (custom section, addedAt) + 3 tRPC mutations + diagnostic integration (completed 2026-03-19)
- [x] 32-02-PLAN.md — Frontend: LessonCard toggle, remove buttons, rebuild dialog, optimistic updates + human verify (completed 2026-03-19)

### Phase 33: CQ Email Automation — 10 событий Carrot Quest + HTML-шаблоны + inactive tracking

**Goal:** Полная интеграция email-автоматизации через Carrot Quest: 10 событий (платежи, аутентификация, реактивация), переименование event names под CQ ТЗ (pa_ префикс), HTML-шаблоны из Stripo, трекинг активности пользователей (lastActiveAt) и cron для inactive уведомлений
**Requirements**: CQ-01 через CQ-10
**Depends on:** Phase 32
**Success Criteria** (what must be TRUE):
  1. 10 CQ событий отправляются с правильными именами (pa_ префикс) и свойствами
  2. Supabase email hook (DOI, password reset) передаёт уникальные ссылки в CQ
  3. pa_registration_completed отправляется при подтверждении email
  4. pa_subscription_expiring отправляется за 3 дня до истечения подписки
  5. lastActiveAt обновляется при каждом входе пользователя
  6. Cron-эндпоинт отправляет pa_inactive_7/14/30 для неактивных пользователей
  7. 10 automation rules настроены в CQ дашборде
  8. HTML-шаблоны из Stripo загружены в CQ
**Plans:** 3 plans (2/3 complete)

- [x] 33-01-PLAN.md — Event rename (pa_ prefix) + lastActiveAt schema + tRPC tracking (completed 2026-03-24)
- [x] 33-02-PLAN.md — New events (registration_completed, subscription_expiring, inactive) + cron endpoints + GitHub Action (completed 2026-03-24)
- [ ] 33-03-PLAN.md — CQ dashboard setup (templates + automation rules) + E2E verification (manual — pending)

### Phase 34: User Profile Enhancement — аватар, display name, завершённость профиля

**Goal:** Пользователь может загрузить аватар и указать отображаемое имя (display name) в профиле. Аватар хранится в Supabase Storage, отображается в UserNav, Sidebar и будущих комментариях. При отсутствии аватара показывается fallback на инициалы. Display name запрашивается при первом входе (profile completeness).
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04
**Depends on:** Phase 33
**Success Criteria** (what must be TRUE):
  1. Supabase Storage bucket `avatars` создан с RLS-политикой (пользователь может загружать/читать только свои файлы)
  2. Профиль содержит upload-компонент с crop/resize и preview, лимит 2MB, форматы jpg/png/webp
  3. Display name — обязательное поле, запрашивается при первом входе через модал/баннер на дашборде
  4. UserNav и Sidebar показывают аватар пользователя (или инициалы как fallback)
  5. tRPC мутация `updateProfile` обновляет name и avatarUrl атомарно
**Plans:** 2 plans

Plans:
- [x] 34-01-PLAN.md — Backend: Supabase Storage bucket, tRPC avatar endpoints, layout+UserNav refactor to UserProfile (completed 2026-03-26)
- [x] 34-02-PLAN.md — Frontend: avatar upload on profile, completeness banner on dashboard, human verify (completed 2026-03-26)

### Phase 35: Lesson Comments — комментарии к урокам с ответами (1 уровень вложенности)

**Goal:** Под каждым уроком блок комментариев с аватарами и именами пользователей. Поддержка ответов (1 уровень вложенности), кнопка "Ответить", удаление своих комментариев. На десктопе — в правой колонке под AI-чатом, на мобилке — отдельная секция под навигацией.
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, COMM-06
**Depends on:** Phase 34 (аватар + display name для идентификации)
**Success Criteria** (what must be TRUE):
  1. Prisma-модель `LessonComment` с self-relation `parentId` для 1-уровневой вложенности
  2. tRPC роутер comments: list (с replies), create, delete (только свои + admin)
  3. Компонент комментария показывает аватар, display name, дату, контент и кнопку "Ответить"
  4. На десктопе комментарии отображаются под AI-чатом в правой колонке (sidebar)
  5. На мобилке комментарии — отдельная секция под навигацией урока
  6. Optimistic updates при отправке и удалении комментариев
  7. Пагинация: первые 20 комментариев, кнопка "Показать ещё"
**Plans:** 2 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 35 to break down)

### Phase 36: Product Tour / Onboarding — 3 tooltip-тура для новых пользователей

**Goal:** Новые пользователи получают пошаговый tooltip-тур при первом посещении ключевых страниц: Dashboard (навигация по sidebar), Обучение (каталог, фильтры, трек), Урок (видео, summary, AI-чат, комментарии). Тур можно пропустить и повторить через кнопку `?` в хедере.
**Requirements**: TOUR-01, TOUR-02, TOUR-03, TOUR-04
**Depends on:** Phase 35 (комментарии нужны для тура урока)
**Success Criteria** (what must be TRUE):
  1. Библиотека driver.js (или аналог) интегрирована, 3 тура определены декларативно (массив шагов)
  2. Dashboard-тур (4-5 шагов): sidebar навигация (Диагностика, Обучение, Дашборд, Профиль)
  3. Learn-тур (5-6 шагов): поиск, фильтры, "Мой трек", секции (ошибки/рекомендации/custom), добавление в трек
  4. Lesson-тур (4-5 шагов): видеоплеер, summary, AI-чат, комментарии, навигация
  5. Каждый тур запускается один раз (localStorage: `tour_{page}_completed`)
  6. Кнопка `?` в хедере/на странице позволяет повторить тур
  7. Кнопка "Пропустить" завершает тур и сохраняет флаг
**Plans:** 2 plans

Plans:
- [x] 36-01-PLAN.md — Tour infrastructure: driver.js, TourProvider, HelpCircle, CSS, definitions
- [ ] 36-02-PLAN.md — data-tour attributes on Dashboard, Learn, Lesson pages + verification
