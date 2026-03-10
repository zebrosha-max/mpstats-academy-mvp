# Requirements: MAAL v1.2

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

- [ ] **BILL-01**: CloudPayments widget интегрирован (iframe-виджет, PCI DSS не нужен)
- [x] **BILL-02**: Рекуррентные подписки с автопродлением через CloudPayments
- [x] **BILL-03**: Webhook handler с HMAC-SHA256 верификацией и идемпотентностью (по TransactionId)
- [x] **BILL-04**: Billing toggle — включение/выключение биллинга через DB flag без деплоя
- [ ] **BILL-05**: Управление подпиской в профиле (статус, следующее списание, отмена)
- [x] **BILL-06**: Prisma модели: Subscription, Payment, PaymentEvent, FeatureFlag

### Paywall

- [ ] **PAY-01**: Content gating — 1-2 бесплатных урока на курс, остальные заблокированы
- [ ] **PAY-02**: Страница тарифов с планами подписки и CTA
- [ ] **PAY-03**: Lock UI на платных уроках (замки, баннер "Оформи подписку")
- [ ] **PAY-04**: Два режима подписки — per-course (Режим A) и full platform (Режим B)
- [ ] **PAY-05**: Централизованный access service в tRPC (не в middleware)

## Future Requirements

Deferred to v1.3+. Tracked but not in current roadmap.

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

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 17 | Complete |
| AUTH-02 | Phase 17 | Complete |
| AUTH-03 | Phase 17 | Complete |
| AUTH-04 | Phase 17 | Complete |
| BILL-01 | Phase 19 | Pending |
| BILL-02 | Phase 18 | Complete |
| BILL-03 | Phase 18 | Complete |
| BILL-04 | Phase 16 | Complete |
| BILL-05 | Phase 19 | Pending |
| BILL-06 | Phase 16 | Complete |
| PAY-01 | Phase 20 | Pending |
| PAY-02 | Phase 19 | Pending |
| PAY-03 | Phase 20 | Pending |
| PAY-04 | Phase 19 | Pending |
| PAY-05 | Phase 20 | Pending |

**Coverage:**
- v1.2 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation*
