# Requirements: MAAL v1.2 + v1.3 + v1.4 + v1.5

**Defined:** 2026-03-06
**Core Value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных

## v1.2 Requirements

Requirements for Auth Rework + Billing milestone. Each maps to roadmap phases.

### Auth Rework

- [x] **AUTH-01**: Пользователь может войти через Яндекс ID (серверный OAuth flow + Supabase Admin API)
- [x] **AUTH-02**: Существующий Google-аккаунт мигрирован на email/password (связывание по verified email)
- [x] **AUTH-03**: Google OAuth убран из Supabase и UI (кнопки, провайдер)
- [x] **AUTH-04**: OAuth архитектура расширяема для будущих провайдеров (Точка ID и др.)

### Billing

- [x] **BILL-01**: CloudPayments widget интегрирован (iframe-виджет, PCI DSS не нужен)
- [x] **BILL-02**: Рекуррентные подписки с автопродлением через CloudPayments
- [x] **BILL-03**: Webhook handler с HMAC-SHA256 верификацией и идемпотентностью (по TransactionId)
- [x] **BILL-04**: Billing toggle — включение/выключение биллинга через DB flag без деплоя
- [x] **BILL-05**: Управление подпиской в профиле (статус, следующее списание, отмена)
- [x] **BILL-06**: Prisma модели: Subscription, Payment, PaymentEvent, FeatureFlag

### Paywall

- [x] **PAY-01**: Content gating — 1-2 бесплатных урока на курс, остальные заблокированы
- [x] **PAY-02**: Страница тарифов с планами подписки и CTA
- [x] **PAY-03**: Lock UI на платных уроках (замки, баннер "Оформи подписку")
- [x] **PAY-04**: Два режима подписки — per-course (Режим A) и full platform (Режим B)
- [x] **PAY-05**: Централизованный access service в tRPC (не в middleware)

## v1.3 Requirements

Requirements for Email Notifications phase.

### Email Notifications

- [x] **EMAIL-01**: EMAIL-SPEC.md с драфтами 9 писем, переменными и flow-схемами для email-команды
- [x] **EMAIL-02**: Carrot Quest API клиент для отправки событий из серверного кода
- [x] **EMAIL-03**: Billing email триггеры (оплата, отказ, отмена, рекуррент) через CQ events
- [ ] **EMAIL-04**: Auth email триггеры (welcome, подтверждение, сброс пароля) через CQ + Supabase Send Email Hook
- [ ] **EMAIL-05**: Scheduled emails (цепочка неактивности 7/14/30д, напоминание об истечении подписки) через GH Actions cron
- [x] **EMAIL-06**: Toast-уведомления в UI при ключевых событиях (sonner)
- [x] **EMAIL-07**: Feature flag `email_notifications_enabled` для kill switch

## v1.4 Requirements

Requirements for Diagnostic 2.0 — personalized learning track.

### Lesson Tagging

- [x] **DIAG-01**: Каждый урок размечен 1-3 skillCategories (мульти-категория вместо single)
- [x] **DIAG-02**: Каждый урок размечен 2-5 свободных топиков с канонической нормализацией
- [x] **DIAG-03**: Сложность уроков назначена LLM (EASY/MEDIUM/HARD вместо hardcoded MEDIUM)

### Question Tracing

- [x] **DIAG-04**: Диагностические вопросы содержат sourceChunkIds, sourceLessonIds и sourceTimecodes
- [x] **DIAG-05**: DiagnosticAnswer хранит sourceData для привязки ошибок к конкретным урокам

### Sectioned Learning Path

- [x] **DIAG-06**: Трек обучения состоит из 4 секций (Ошибки, Углубление, Развитие, Продвинутый) с порогами 70/85%

### Frontend

- [x] **DIAG-07**: Аккордеон-секции на странице "Мой трек" с expand/collapse и цветовой кодировкой
- [x] **DIAG-08**: Хинт с таймкодом из диагностики на странице урока (dismissible, между плеером и табами)
- [x] **DIAG-09**: Двойной Radar Chart (было/стало) при повторной диагностике

## v1.5 Requirements

Requirements for Admin Roles phase.

### Admin Roles

- [x] **ROLE-01**: Prisma enum Role { USER ADMIN SUPERADMIN } заменяет boolean isAdmin
- [x] **ROLE-02**: adminProcedure разрешает ADMIN и SUPERADMIN, superadminProcedure — только SUPERADMIN
- [x] **ROLE-03**: ADMIN и SUPERADMIN обходят paywall (admin_bypass в checkLessonAccess)
- [x] **ROLE-04**: changeUserRole мутация с защитой SUPERADMIN-only и запретом само-разжалования
- [x] **ROLE-05**: toggleUserField (isActive) ограничен SUPERADMIN-only
- [x] **ROLE-06**: Admin layout проверяет role вместо isAdmin, показывает role badge
- [x] **ROLE-07**: UserTable показывает role dropdown (SUPERADMIN) или badge (ADMIN) с privilege-aware контролами
- [x] **ROLE-08**: Sidebar и MobileNav показывают условную ссылку "Админка" для ADMIN/SUPERADMIN

## v1.6 Requirements

Requirements for SEO + Custom Error Pages phase.

### SEO & Meta

- [x] **SEO-01**: Root layout имеет OG-теги (og:title, og:description, og:image, og:url, og:type, og:locale=ru_RU) и title template "Page | MPSTATS Academy"
- [x] **SEO-02**: sitemap.xml содержит 4 публичные страницы (/, /pricing, /login, /register)
- [x] **SEO-03**: robots.txt блокирует protected routes (/dashboard, /learn, /diagnostic, /profile, /admin, /api)
- [x] **SEO-04**: Каждый route group имеет уникальный title и description через layout metadata
- [x] **SEO-05**: Error-страницы (404, 500, global-error) показывают логотип MPSTATS Academy, 404 ведёт на /
- [x] **SEO-06**: Yandex Webmaster верификация через мета-тег в root layout

## v1.7 Requirements

Requirements for Content Discovery phase.

### Content Discovery

- [x] **SEARCH-01**: Семантический поиск по урокам через vector search (top-10 уроков с 1-2 фрагментами и таймкодами)
- [x] **SEARCH-02**: 7 фильтров (категория, статус, темы, сложность, длительность, курс, маркетплейс) работают в режимах поиска, курсов и трека
- [x] **SEARCH-03**: Клик на таймкод фрагмента открывает урок на нужной позиции видео (seekTo)
- [x] **SEARCH-04**: Уроки из рекомендованного трека показывают badge "В вашем треке" в результатах поиска
- [x] **SEARCH-05**: Очистка поиска (X или backspace) возвращает к режиму курсов/трека

## v1.8 Requirements

Requirements for Custom Track Management phase.

### Track Management

- [ ] **TRACK-01**: Тип LearningPathSection расширен id `'custom'` и полем `addedAt` для ручных добавлений
- [ ] **TRACK-02**: tRPC мутация `addToTrack` добавляет урок в секцию "Мои уроки", при отсутствии трека создаёт новый LearningPath
- [ ] **TRACK-03**: tRPC мутация `removeFromTrack` удаляет урок из любой секции (custom или AI)
- [ ] **TRACK-04**: tRPC мутация `rebuildTrack` перегенерирует AI-секции из последней диагностики, сохраняя "Мои уроки"
- [ ] **TRACK-05**: Завершение диагностики сохраняет существующую custom-секцию (не перезаписывает)
- [ ] **TRACK-06**: Кнопка "+" на LessonCard в режиме "Все курсы" — toggle "+"/"checkmark" для добавления в трек
- [ ] **TRACK-07**: Кнопка "Убрать" в режиме "Мой трек" для удаления из любой секции
- [ ] **TRACK-08**: Секция "Мои уроки" отображается первой (выше AI-секций) с фиолетовым стилем
- [ ] **TRACK-09**: Кнопка "Перестроить трек" с диалогом подтверждения
- [ ] **TRACK-10**: Toast-уведомления (sonner) при добавлении, удалении и перестройке трека

## v1.9 Requirements

Requirements for Support Contact phase.

### Support Contact

- [ ] **SUPP-01**: Публичная страница /support с контактной информацией (email clients@mpstats.academy, кнопка открытия CQ чата)
- [ ] **SUPP-02**: FAQ аккордеон с 5 частыми вопросами (оплата, отмена, email, видео, диагностика)
- [ ] **SUPP-03**: Форма обратной связи с дропдауном темы и отправкой через CQ event "Support Request"
- [ ] **SUPP-04**: Ссылка "Поддержка" в sidebar footer, mobile-nav и landing footer

## Future Requirements

Deferred to v1.8+. Tracked but not in current roadmap.

### Auth Extensions

- **AUTH-05**: Точка ID OAuth провайдер (для пользователей Точка банка)

### Billing Extensions

- **BILL-07**: 54-ФЗ интеграция через CloudKassир (онлайн-чеки)
- **BILL-08**: Промокоды и скидки
- **BILL-09**: Trial period (бесплатный пробный период)

### Compliance

- **COMP-01**: Полное accessibility audit (WCAG 2.1 AA)
- **COMP-02**: Full-app dark mode

### Diagnostic Extensions (deferred from Phase 23)

- **DIAG-10**: Адаптивная сложность вопросов (IRT-lite) на лету
- **DIAG-11**: Spaced repetition для закрепления вопросов
- **DIAG-12**: Визуализация истории прогресса между диагностиками (графики роста)
- **DIAG-13**: Гибкая диагностика (10-100 вопросов, выбор количества)
- ~~**DIAG-14**: Поиск и фильтрация по топикам уроков~~ → covered by SEARCH-02 (Phase 30)

## Out of Scope

| Feature | Reason |
|---------|--------|
| One-time покупка курса | Только подписочная модель |
| Stripe/YooKassa | CloudPayments выбран как основной процессинг |
| Mobile app | Web-first, PWA достаточен |
| Multi-currency | Только RUB |
| Marketplace модель | Один вендор, не marketplace |
| Gamification | Усложняет без доказанной ценности |
| Notification center (колокольчик) | Deferred — отдельная фаза |
| Browser push notifications | Deferred — требует service worker |
| Email analytics | Deferred — open rate, click rate |
| User notification preferences | Deferred — настройки уведомлений |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 17 | Complete |
| AUTH-02 | Phase 17 | Complete |
| AUTH-03 | Phase 17 | Complete |
| AUTH-04 | Phase 17 | Complete |
| BILL-01 | Phase 19 | Complete |
| BILL-02 | Phase 18 | Complete |
| BILL-03 | Phase 18 | Complete |
| BILL-04 | Phase 16 | Complete |
| BILL-05 | Phase 19 | Complete |
| BILL-06 | Phase 16 | Complete |
| PAY-01 | Phase 20 | Complete |
| PAY-02 | Phase 19 | Complete |
| PAY-03 | Phase 20 | Complete |
| PAY-04 | Phase 19 | Complete |
| PAY-05 | Phase 20 | Complete |
| EMAIL-01 | Phase 22 (Plan 01) | Planned |
| EMAIL-02 | Phase 22 (Plan 02) | Planned |
| EMAIL-03 | Phase 22 (Plan 02) | Planned |
| EMAIL-04 | Phase 22 (Plan 03) | Planned |
| EMAIL-05 | Phase 22 (Plan 03) | Planned |
| EMAIL-06 | Phase 22 (Plan 02) | Planned |
| EMAIL-07 | Phase 22 (Plan 02) | Planned |
| DIAG-01 | Phase 23 (Plan 01) | Complete |
| DIAG-02 | Phase 23 (Plan 01) | Complete |
| DIAG-03 | Phase 23 (Plan 01) | Complete |
| DIAG-04 | Phase 23 (Plan 02) | Complete |
| DIAG-05 | Phase 23 (Plan 02) | Complete |
| DIAG-06 | Phase 23 (Plan 02) | Complete |
| DIAG-07 | Phase 23 (Plan 03) | Complete |
| DIAG-08 | Phase 23 (Plan 03) | Complete |
| DIAG-09 | Phase 23 (Plan 03) | Complete |
| ROLE-01 | Phase 31 (Plan 01) | Planned |
| ROLE-02 | Phase 31 (Plan 01) | Planned |
| ROLE-03 | Phase 31 (Plan 01) | Planned |
| ROLE-04 | Phase 31 (Plan 01) | Planned |
| ROLE-05 | Phase 31 (Plan 01) | Planned |
| ROLE-06 | Phase 31 (Plan 02) | Planned |
| ROLE-07 | Phase 31 (Plan 02) | Planned |
| ROLE-08 | Phase 31 (Plan 02) | Planned |
| SEO-01 | Phase 27 (Plan 01) | Complete |
| SEO-02 | Phase 27 (Plan 01) | Complete |
| SEO-03 | Phase 27 (Plan 01) | Complete |
| SEO-04 | Phase 27 (Plan 02) | Complete |
| SEO-05 | Phase 27 (Plan 02) | Complete |
| SEO-06 | Phase 27 (Plan 02) | Complete |
| SEARCH-01 | Phase 30 (Plan 01, 02) | Complete |
| SEARCH-02 | Phase 30 (Plan 01, 02) | Complete |
| SEARCH-03 | Phase 30 (Plan 02) | Complete |
| SEARCH-04 | Phase 30 (Plan 01, 02) | Complete |
| SEARCH-05 | Phase 30 (Plan 02) | Complete |
| TRACK-01 | Phase 32 (Plan 01) | Planned |
| TRACK-02 | Phase 32 (Plan 01) | Planned |
| TRACK-03 | Phase 32 (Plan 01) | Planned |
| TRACK-04 | Phase 32 (Plan 01) | Planned |
| TRACK-05 | Phase 32 (Plan 01) | Planned |
| TRACK-06 | Phase 32 (Plan 02) | Planned |
| TRACK-07 | Phase 32 (Plan 02) | Planned |
| TRACK-08 | Phase 32 (Plan 02) | Planned |
| TRACK-09 | Phase 32 (Plan 02) | Planned |
| TRACK-10 | Phase 32 (Plan 02) | Planned |
| SUPP-01 | Phase 24 (Plan 01) | Planned |
| SUPP-02 | Phase 24 (Plan 01) | Planned |
| SUPP-03 | Phase 24 (Plan 01) | Planned |
| SUPP-04 | Phase 24 (Plan 01) | Planned |

**Coverage:**
- v1.2 requirements: 15 total, 15 complete
- v1.3 requirements: 7 total, 5 complete
- v1.4 requirements: 9 total, 9 complete
- v1.5 requirements: 8 total, 0 planned
- v1.6 requirements: 6 total, 6 complete
- v1.7 requirements: 5 total, 5 complete
- v1.8 requirements: 10 total, 0 planned
- v1.9 requirements: 4 total, 0 planned
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-19 after Phase 24 planning*
