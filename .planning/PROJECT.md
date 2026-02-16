# MPSTATS Academy Adaptive Learning (MAAL)

## What This Is

Образовательная платформа для селлеров маркетплейсов с AI-диагностикой навыков и адаптивным обучением. Платформа оценивает уровень знаний пользователя по 5 осям (Аналитика, Маркетинг, Контент, Операции, Финансы), строит персонализированный трек обучения и предоставляет RAG-чат с цитированием таймкодов по видеоурокам.

## Core Value

Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения — без лишнего контента, только то, что нужно именно ему.

## Requirements

### Validated

<!-- Shipped and confirmed valuable (Sprint 0-3 + 2.5) -->

- ✓ Auth: email/password + Google OAuth через Supabase — Sprint 1
- ✓ Protected routes с middleware редиректами — Sprint 1
- ✓ Landing page с Hero, Features, CTA — Sprint 1
- ✓ Dashboard со статистикой и активностью — Sprint 2
- ✓ Diagnostic flow: intro → session → results + Radar Chart — Sprint 2
- ✓ Learning: каталог курсов, карточки уроков, страница урока — Sprint 2
- ✓ Profile settings + история диагностик — Sprint 2
- ✓ UI Redesign по MPSTATS brand guidelines (mp-blue/green/pink) — Sprint 2.5
- ✓ Анимации, скелетоны, responsive layout — Sprint 2.5
- ✓ RAG pipeline: vector search + LLM generation с цитатами — Sprint 3
- ✓ AI Summary + Chat по урокам с таймкодами — Sprint 3
- ✓ Supabase keep-alive workflow — Sprint 3
- ✓ Codebase: Turborepo monorepo, tRPC, Prisma, shadcn/ui — Sprint 0

### Active

<!-- Current milestone: замена mock → реальные данные, deploy -->

- [ ] Курсы и уроки загружаются из Supabase RAG data (не hardcoded mock)
- [ ] Маппинг lesson_id → категория навыков (analytics, marketing, etc.)
- [ ] AI генерирует вопросы диагностики из RAG chunks (вместо mock)
- [ ] Fallback на mock вопросы если LLM недоступен
- [ ] Мягкое ограничение: "Пройди диагностику чтобы открыть видео"
- [ ] Фильтр "Мой трек" — показывает только рекомендованные уроки
- [ ] Сохранение recommendedPath в профиль пользователя
- [ ] Kinescope видеоплеер интеграция (API, маппинг videoId)
- [ ] Deploy на VPS (PM2 + Nginx + SSL)
- [ ] Критичные E2E тесты: auth flow, diagnostic flow, learning flow
- [ ] Миграция in-memory storage → Prisma + Supabase

### Out of Scope

- Dark mode toggle — CSS variables готовы, переключатель не приоритет для MVP
- Полное QA покрытие (unit, accessibility audit) — следующий milestone
- Mobile app — web-first
- Платёжная система — MVP бесплатный
- Real-time уведомления — не нужны для MVP
- Административная панель — управление через Supabase Dashboard

## Context

**Существующая кодовая база:** 1,865 строк анализа в `.planning/codebase/` (7 документов)

**Ключевые факты:**
- RAG данные: 6 курсов, 80+ уроков, 5,291 chunks с embeddings в Supabase
- Модель генерации: google/gemini-2.5-flash через OpenRouter
- Embeddings: OpenAI text-embedding-3-small (1536 dims)
- Mock данные: `packages/api/src/mocks/` (courses, questions, dashboard)
- In-memory storage: `globalThis` в diagnostic/profile routers — теряется при перезапуске
- Supabase Free Tier: засыпает после 7 дней, есть keep-alive workflow

**VPS (production target):**
- IP: 79.137.197.90, Ubuntu 24.04, Node.js 20, Docker, PM2
- Порты: 22, 80, 443, 3000, 5678

**Kinescope:** iframe embed готов (`apps/web/src/app/(main)/learn/[id]/page.tsx`), нужны videoId и API интеграция для маппинга.

## Constraints

- **Database:** Supabase free tier — 500MB storage, 7-day pause policy
- **LLM Budget:** OpenRouter pay-per-use, нужны rate limits (50 req/hour LLM, 20 msg/hour chat)
- **VPS:** Single server (79.137.197.90), нет автоскейлинга
- **Video:** Kinescope — API и videoId нужно получить/настроить
- **Tech Stack:** Locked — Next.js 14, tRPC, Prisma, Supabase, Turborepo (не менять)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| UI-First development (Sprint 0-2) | Не блокироваться контентом | ✓ Good |
| Supabase Auth + Google OAuth | Простая интеграция, бесплатно | ✓ Good |
| In-memory mock storage | Быстрая разработка Sprint 2 | ⚠️ Revisit — мигрировать на Prisma |
| OpenRouter мульти-модель | Fallback между моделями | ✓ Good |
| RAG vector search threshold 0.3 | Лучший recall для образовательного контента | — Pending |
| QA минимально в этом milestone | Фокус на функциональность, тесты позже | — Pending |

---
*Last updated: 2026-02-16 after project initialization*
