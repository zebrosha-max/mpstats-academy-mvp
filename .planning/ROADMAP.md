# Roadmap: MAAL Milestone 1

## Overview

Миграция MAAL с mock-данных на production-ready платформу. Критический путь: реальные данные в БД (Phase 1) -> безопасность (Phase 5) -> деплой (Phase 6). AI-вопросы (Phase 2), Kinescope видео (Phase 3) и контроль доступа (Phase 4) строятся поверх данных, но частично параллельны друг другу.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Seed реальных курсов/уроков и миграция трёх роутеров с mock на Prisma (completed 2026-02-17)
- [ ] **Phase 2: AI Question Generation** - Генерация диагностических вопросов из RAG chunks вместо mock
- [ ] **Phase 3: Video Integration** - Kinescope плеер с реальными видео и перемоткой по таймкодам
- [ ] **Phase 4: Access Control & Personalization** - Мягкое ограничение доступа и персонализированный трек
- [ ] **Phase 5: Security Hardening** - Защита endpoints, rate limiting, санитизация AI output
- [ ] **Phase 6: Production Deploy** - Standalone build, PM2, Nginx, SSL на VPS

## Phase Details

### Phase 1: Data Foundation
**Goal**: Приложение работает с реальными данными из Supabase — курсы, уроки, диагностики и профили сохраняются между перезапусками
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08
**Success Criteria** (what must be TRUE):
  1. Страница /learn отображает 6 реальных курсов и 80+ уроков из Supabase (не hardcoded массивы)
  2. Пользователь проходит диагностику, перезапускает сервер — результаты и SkillProfile сохранены
  3. Dashboard показывает статистику на основе реальных DiagnosticSession и LessonProgress из БД
  4. Каждый урок принадлежит одной из SkillCategory (ANALYTICS, MARKETING, etc.) через lesson_id маппинг
  5. Если Supabase недоступна, приложение показывает graceful fallback вместо crash
**Plans:** 4 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Seed scripts (manifest + AI classification) and shared utilities (ensureUserProfile, db-errors)
- [x] 01-02-PLAN.md — Learning router migration to Prisma + frontend updates
- [x] 01-03-PLAN.md — Diagnostic router migration to Prisma (session/answer/skillProfile persistence)
- [x] 01-04-PLAN.md — Profile router + dashboard migration with real stats + E2E verification

### Phase 2: AI Question Generation
**Goal**: Диагностика использует AI-генерированные вопросы из реального контента уроков, а не фиксированный набор mock
**Depends on**: Phase 1 (нужны реальные lesson_id и SkillCategory маппинг)
**Requirements**: AIGEN-01, AIGEN-02, AIGEN-03, AIGEN-04, AIGEN-05
**Success Criteria** (what must be TRUE):
  1. При старте диагностики пользователь получает вопросы, сгенерированные из RAG chunks конкретных уроков
  2. Каждый вопрос имеет 4 варианта ответа, 1 правильный, и привязан к SkillCategory
  3. Если LLM недоступен или timeout 10s, диагностика работает с fallback mock вопросами
  4. Генерация вопросов ограничена 50 req/hour
**Plans**: TBD

Plans:
- [ ] 02-01: Question generator service и validation pipeline
- [ ] 02-02: Integration с diagnostic router и fallback logic

### Phase 3: Video Integration
**Goal**: Пользователь смотрит реальные видеоуроки через Kinescope и может переходить к конкретным моментам по таймкодам из RAG
**Depends on**: Phase 1 (нужны lesson записи в БД для маппинга videoId)
**Requirements**: VIDEO-01, VIDEO-02, VIDEO-03, VIDEO-04
**Success Criteria** (what must be TRUE):
  1. На странице урока воспроизводится реальное Kinescope видео (не placeholder)
  2. Клик по таймкоду в RAG summary/chat перематывает видео к нужному моменту
  3. Если videoId отсутствует у урока, показывается информативный placeholder
**Plans**: TBD

Plans:
- [ ] 03-01: Kinescope SDK integration и videoId mapping
- [ ] 03-02: Timecode seek из RAG citations

### Phase 4: Access Control & Personalization
**Goal**: Пользователь проходит диагностику прежде чем получить доступ к видео, и видит персонализированный трек обучения
**Depends on**: Phase 1 (реальные данные), Phase 2 (AI диагностика)
**Requirements**: ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04
**Success Criteria** (what must be TRUE):
  1. Пользователь без пройденной диагностики видит баннер "Пройди диагностику" вместо видеоплеера
  2. Фильтр "Мой трек" на /learn показывает только уроки, рекомендованные на основе SkillProfile
  3. Рекомендованные уроки помечены бейджем "Рекомендовано для вас"
  4. recommendedPath сохраняется в профиль и доступен между сессиями
**Plans**: TBD

Plans:
- [ ] 04-01: Soft gating и personalized path

### Phase 5: Security Hardening
**Goal**: Все endpoints защищены, AI output безопасен, приложение готово к production трафику
**Depends on**: Phase 1, Phase 2 (endpoints, которые нужно защитить, уже существуют)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05
**Success Criteria** (what must be TRUE):
  1. Неаутентифицированный запрос к AI endpoints возвращает 401 (не выполняет LLM запрос)
  2. LLM endpoints ограничены по rate (50 req/hour per user), при превышении — 429
  3. AI-генерированный markdown рендерится безопасно (нет XSS через dangerouslySetInnerHTML)
  4. service_role key не присутствует в client-side bundle после build
  5. Ошибка в diagnostic/learning/chat компоненте показывает Error Boundary, а не белый экран
**Plans**: TBD

Plans:
- [ ] 05-01: Protected procedures и rate limiting
- [ ] 05-02: Sanitization, error boundaries, server-only enforcement

### Phase 6: Production Deploy
**Goal**: Приложение доступно в интернете по HTTPS, работает стабильно под PM2 с мониторингом
**Depends on**: Phase 1, Phase 5 (данные + безопасность обязательны до деплоя)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07
**Success Criteria** (what must be TRUE):
  1. Пользователь открывает production URL по HTTPS и видит landing page
  2. Google OAuth работает в production (redirect URI обновлён)
  3. Полный flow работает: регистрация -> диагностика -> результаты -> обучение -> RAG chat
  4. PM2 автоматически перезапускает приложение при crash
  5. Health check endpoint возвращает статус приложения и БД
**Plans**: TBD

Plans:
- [ ] 06-01: Standalone build и PM2 config
- [ ] 06-02: Nginx, SSL, environment setup
- [ ] 06-03: E2E smoke tests и health check

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
Note: Phases 2 and 3 can execute in parallel after Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 4/4 | Complete | 2026-02-17 |
| 2. AI Question Generation | 0/2 | Not started | - |
| 3. Video Integration | 0/2 | Not started | - |
| 4. Access Control | 0/1 | Not started | - |
| 5. Security Hardening | 0/2 | Not started | - |
| 6. Production Deploy | 0/3 | Not started | - |
