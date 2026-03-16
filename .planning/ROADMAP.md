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
| 22. Email Notifications | 2/3 | In Progress|  | - |

### Phase 21: Domain migration from DuckDNS to platform.mpstats.academy

**Goal:** Перевести production-приложение с временного academyal.duckdns.org на постоянный домен platform.mpstats.academy (DNS, SSL, Nginx, env, OAuth, Docker rebuild, верификация)
**Requirements**: DOM-01, DOM-02, DOM-03, DOM-04, DOM-05, DOM-06
**Depends on:** Phase 19 (production app running)
**Plans:** 2/2 plans complete

Plans:
- [x] 21-01-PLAN.md — DNS A-record (human), VPS infrastructure (Nginx + SSL + env + Docker rebuild) (completed 2026-03-11)
- [x] 21-02-PLAN.md — External OAuth services update (Supabase + Yandex), test fixtures, docs, E2E verification (completed 2026-03-11)

### Phase 22: Transactional email notifications (billing, auth, system)

**Goal:** Платформа отправляет транзакционные email-уведомления через Carrot Quest при всех ключевых событиях (billing, auth, система), auth-письма Supabase переведены на CQ для единого брендинга, scheduled emails для re-engagement
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, EMAIL-06, EMAIL-07
**Depends on:** Phase 21
**Success Criteria** (what must be TRUE):
  1. EMAIL-SPEC.md содержит драфты всех 9 писем с переменными, CQ event names и flow-схемами
  2. CQ API клиент отправляет events при billing-событиях (оплата, отказ, отмена, рекуррент)
  3. Supabase auth emails (confirm, reset) перенаправляются через Send Email Hook на CQ
  4. Welcome и diagnostic-completed emails триггерятся при соответствующих событиях
  5. GitHub Actions cron запускает ежедневную проверку неактивности и истечения подписок
  6. Toast-уведомления (sonner) появляются в UI при оплате и отмене
  7. Feature flag `email_notifications_enabled` контролирует отправку писем
**Plans:** 2/3 plans executed

Plans:
- [ ] 22-01-PLAN.md — EMAIL-SPEC.md specification document for email team (9 emails, drafts, variables, flows)
- [ ] 22-02-PLAN.md — CQ API client + sonner toasts + billing email triggers in webhook handlers
- [ ] 22-03-PLAN.md — Supabase Send Email Hook + welcome/diagnostic triggers + scheduled emails cron + human verify

### Phase 23: Diagnostic 2.0 — personalized learning track with lesson-level topic tagging, question-to-content tracing, and error-based path prioritization

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 22
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 23 to break down)
