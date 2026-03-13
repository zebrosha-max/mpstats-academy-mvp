# Requirements: MAAL v1.2 + v1.3

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

- [ ] **EMAIL-01**: EMAIL-SPEC.md с драфтами 9 писем, переменными и flow-схемами для email-команды
- [ ] **EMAIL-02**: Carrot Quest API клиент для отправки событий из серверного кода
- [ ] **EMAIL-03**: Billing email триггеры (оплата, отказ, отмена, рекуррент) через CQ events
- [ ] **EMAIL-04**: Auth email триггеры (welcome, подтверждение, сброс пароля) через CQ + Supabase Send Email Hook
- [ ] **EMAIL-05**: Scheduled emails (цепочка неактивности 7/14/30д, напоминание об истечении подписки) через GH Actions cron
- [ ] **EMAIL-06**: Toast-уведомления в UI при ключевых событиях (sonner)
- [ ] **EMAIL-07**: Feature flag `email_notifications_enabled` для kill switch

## Future Requirements

Deferred to v1.4+. Tracked but not in current roadmap.

### Auth Extensions

- **AUTH-05**: Точка ID OAuth провайдер (для пользователей Точка банка)

### Billing Extensions

- **BILL-07**: 54-ФЗ интеграция через CloudKassir (онлайн-чеки)
- **BILL-08**: Промокоды и скидки
- **BILL-09**: Trial period (бесплатный пробный период)

### Compliance

- **COMP-01**: Полное accessibility audit (WCAG 2.1 AA)
- **COMP-02**: Full-app dark mode

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

**Coverage:**
- v1.2 requirements: 15 total, 15 complete
- v1.3 requirements: 7 total, 0 complete
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-13 after Phase 22 planning*
