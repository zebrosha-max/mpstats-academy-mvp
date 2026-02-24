# Requirements: MAAL Milestone 1

**Defined:** 2026-02-16
**Core Value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных.

## v1 Requirements

### Data Migration

- [ ] **DATA-01**: Курсы и уроки загружаются из Supabase (таблицы Course/Lesson), а не из hardcoded mock
- [ ] **DATA-02**: Seed script заполняет Course/Lesson таблицы из существующих content_chunk данных (6 курсов, 80+ уроков)
- [ ] **DATA-03**: Маппинг lesson_id prefix → SkillCategory (01_analytics→ANALYTICS, 02_ads→MARKETING, etc.)
- [ ] **DATA-04**: Learning router (`packages/api/src/routers/learning.ts`) использует Prisma вместо mock arrays
- [ ] **DATA-05**: Diagnostic router (`packages/api/src/routers/diagnostic.ts`) сохраняет сессии в Supabase вместо globalThis Map
- [ ] **DATA-06**: Profile router (`packages/api/src/routers/profile.ts`) читает реальные данные из DiagnosticSession/SkillProfile
- [ ] **DATA-07**: Dashboard отображает реальную статистику (из migrated routers)
- [ ] **DATA-08**: Mock fallback — если Supabase недоступна, приложение не крашится

### AI Question Generation

- [ ] **AIGEN-01**: Сервис генерирует diagnostic вопросы из RAG chunks через LLM (4 варианта, 1 правильный)
- [ ] **AIGEN-02**: Валидация структуры сгенерированных вопросов (Zod schema)
- [ ] **AIGEN-03**: Fallback на mock вопросы если LLM недоступен или timeout (10s)
- [ ] **AIGEN-04**: Вопросы привязаны к SkillCategory через lesson_id маппинг
- [ ] **AIGEN-05**: Rate limiting для генерации вопросов (50 req/hour)

### Access Control

- [ ] **ACCESS-01**: Пользователь без диагностики видит баннер "Пройди диагностику чтобы открыть видео"
- [ ] **ACCESS-02**: Фильтр "Мой трек" показывает только рекомендованные уроки на основе SkillProfile
- [ ] **ACCESS-03**: recommendedPath сохраняется в профиль пользователя (Supabase)
- [ ] **ACCESS-04**: Badge "Рекомендовано для вас" на уроках из recommendedPath

### Video Integration

- [ ] **VIDEO-01**: Kinescope API loader (`@kinescope/player-iframe-api-loader`) интегрирован
- [ ] **VIDEO-02**: videoId маппинг — каждый урок имеет videoId из Kinescope
- [ ] **VIDEO-03**: Timecode seek — клик по таймкоду в RAG chat перематывает видео
- [ ] **VIDEO-04**: Fallback UI если videoId отсутствует (placeholder с сообщением)

### Security Hardening

- [ ] **SEC-01**: AI router endpoints используют protectedProcedure (не publicProcedure)
- [ ] **SEC-02**: Rate limiting на LLM endpoints (50 req/hour per user)
- [ ] **SEC-03**: Санитизация AI output — замена dangerouslySetInnerHTML на безопасный рендеринг
- [ ] **SEC-04**: Supabase service_role key доступен только server-side (не утекает в клиент)
- [ ] **SEC-05**: Error boundaries в React компонентах (diagnostic, learning, chat)

### Production Deploy

- [x] **DEPLOY-01**: Next.js standalone build (`output: 'standalone'` в next.config.js)
- [x] **DEPLOY-02**: PM2 ecosystem config для production
- [x] **DEPLOY-03**: Nginx reverse proxy с SSL (Let's Encrypt)
- [x] **DEPLOY-04**: Environment variables настроены на VPS
- [x] **DEPLOY-05**: Prisma binary targets для Linux (Ubuntu 24.04)
- [x] **DEPLOY-06**: Health check endpoint для мониторинга
- [ ] **DEPLOY-07**: Критичные E2E тесты: auth flow, diagnostic flow, learning flow

## v2 Requirements

### Enhanced Diagnostics

- **DIAG-01**: Адаптивная сложность вопросов (IRT-lite) на основе предыдущих ответов
- **DIAG-02**: Кеширование сгенерированных вопросов для повторного использования
- **DIAG-03**: Визуализация прогресса навыков между диагностиками

### Content Management

- **CMS-01**: Административная панель для управления курсами/уроками
- **CMS-02**: Bulk import транскриптов и видео

### UX Polish

- **UX-01**: Dark mode toggle
- **UX-02**: Полное accessibility audit (WCAG 2.1 AA)
- **UX-03**: Полное QA покрытие (unit tests, component tests)
- **UX-04**: Watch progress tracking (процент просмотра видео)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first, мобильная версия не приоритет для MVP |
| Платёжная система | MVP бесплатный |
| Real-time уведомления | Не нужны для образовательного контента |
| SCORM/xAPI | Over-engineering для MVP |
| Gamification (бейджи, очки) | Усложняет без доказанной ценности |
| Custom video player | Kinescope предоставляет готовый |
| Multi-language | Только русский для MVP |
| Microservices | Monolith достаточен при текущей нагрузке |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1: Data Foundation | Pending |
| DATA-02 | Phase 1: Data Foundation | Pending |
| DATA-03 | Phase 1: Data Foundation | Pending |
| DATA-04 | Phase 1: Data Foundation | Pending |
| DATA-05 | Phase 1: Data Foundation | Pending |
| DATA-06 | Phase 1: Data Foundation | Pending |
| DATA-07 | Phase 1: Data Foundation | Pending |
| DATA-08 | Phase 1: Data Foundation | Pending |
| AIGEN-01 | Phase 2: AI Question Generation | Pending |
| AIGEN-02 | Phase 2: AI Question Generation | Pending |
| AIGEN-03 | Phase 2: AI Question Generation | Pending |
| AIGEN-04 | Phase 2: AI Question Generation | Pending |
| AIGEN-05 | Phase 2: AI Question Generation | Pending |
| VIDEO-01 | Phase 3: Video Integration | Pending |
| VIDEO-02 | Phase 3: Video Integration | Pending |
| VIDEO-03 | Phase 3: Video Integration | Pending |
| VIDEO-04 | Phase 3: Video Integration | Pending |
| ACCESS-01 | Phase 4: Access Control | Pending |
| ACCESS-02 | Phase 4: Access Control | Pending |
| ACCESS-03 | Phase 4: Access Control | Pending |
| ACCESS-04 | Phase 4: Access Control | Pending |
| SEC-01 | Phase 5: Security Hardening | Pending |
| SEC-02 | Phase 5: Security Hardening | Pending |
| SEC-03 | Phase 5: Security Hardening | Pending |
| SEC-04 | Phase 5: Security Hardening | Pending |
| SEC-05 | Phase 5: Security Hardening | Pending |
| DEPLOY-01 | Phase 6: Production Deploy | Complete |
| DEPLOY-02 | Phase 6: Production Deploy | Complete |
| DEPLOY-03 | Phase 6: Production Deploy | Complete |
| DEPLOY-04 | Phase 6: Production Deploy | Complete |
| DEPLOY-05 | Phase 6: Production Deploy | Complete |
| DEPLOY-06 | Phase 6: Production Deploy | Complete |
| DEPLOY-07 | Phase 6: Production Deploy | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation*
