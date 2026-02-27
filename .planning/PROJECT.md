# MPSTATS Academy Adaptive Learning (MAAL)

## What This Is

Образовательная платформа для селлеров маркетплейсов с AI-диагностикой навыков и адаптивным обучением. Платформа оценивает уровень знаний пользователя по 5 осям (Аналитика, Маркетинг, Контент, Операции, Финансы), генерирует AI-вопросы из реального контента уроков, строит персонализированный трек обучения и предоставляет RAG-чат с цитированием таймкодов по 405 видеоурокам на Kinescope. Включает админ-панель с управлением пользователями и контентом, watch progress tracking и dark/light theme toggle.

## Core Value

Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения — без лишнего контента, только то, что нужно именно ему.

## Requirements

### Validated

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
- ✓ Курсы и уроки из Supabase RAG data (DATA-01..08) — v1.0
- ✓ AI генерация вопросов из RAG chunks с fallback (AIGEN-01..05) — v1.0
- ✓ Kinescope видеоплеер с seekTo по таймкодам (VIDEO-01..04) — v1.0
- ✓ Access control + персонализированный трек "Мой трек" (ACCESS-01..04) — v1.0
- ✓ Security: rate limiting, protectedProcedure, SafeMarkdown (SEC-01..05) — v1.0
- ✓ VPS Infrastructure: Docker, Nginx, UFW, SSL (INFRA-01..04) — v1.0
- ✓ Production deploy с CI/CD и E2E верификацией (DEPLOY-01..07) — v1.0
- ✓ Чистые названия уроков и курсов (NAMING-01..05) — v1.0
- ✓ Админ-панель: dashboard KPIs, управление пользователями, аналитика, контент-менеджмент (ADMIN-01..07) — v1.1
- ✓ Summary & Sources UX: collapsible, [N] тултипы, seekTo (UX-01..04) — v1.1
- ✓ Lesson Page Performance: lazy video, tRPC cache 30min (PERF-01..03) — v1.1
- ✓ Watch Progress Tracking: сохранение позиции, прогресс-бары, автовозобновление (WATCH-01..04) — v1.1
- ✓ Tech Debt: in-memory → DB, QuestionBank с TTL, progressive loading, dynamic Prisma (DEBT-01..04) — v1.1
- ✓ Landing Redesign: dark/light theme toggle, CSS variables, FOUC prevention (LANDING-01..03) — v1.1

### Active

**Deferred to future milestones:**
- [ ] Адаптивная сложность вопросов (IRT-lite) на основе предыдущих ответов
- [ ] Визуализация прогресса навыков между диагностиками
- [ ] Полное accessibility audit (WCAG 2.1 AA)
- [ ] Полное QA покрытие (unit tests, component tests, E2E)
- [ ] Full-app dark mode (не только лендинг)

### Out of Scope

- Mobile app — web-first, PWA достаточен
- Платёжная система — MVP бесплатный
- Real-time уведомления — не нужны для образовательного контента
- SCORM/xAPI — over-engineering для MVP
- Gamification (бейджи, очки) — усложняет без доказанной ценности
- Multi-language — только русский
- Microservices — monolith достаточен при текущей нагрузке

## Context

Shipped v1.1 Admin & Polish с 18,017 LOC TypeScript.
Tech stack: Next.js 14, tRPC, Prisma, Supabase (pgvector), Turborepo, shadcn/ui.
Production: https://academyal.duckdns.org (VPS 89.208.106.208, Docker + Nginx + Let's Encrypt).
RAG данные: 6 курсов, 80+ уроков, 5,291 chunks с embeddings, 405 видео на Kinescope (209 GB).
Модель генерации: google/gemini-2.5-flash через OpenRouter.
Embeddings: OpenAI text-embedding-3-small (1536 dims).
Админ-панель: (admin) route group, adminProcedure, dashboard/users/analytics/content pages.
Watch progress: Kinescope postMessage time tracking, 15s debounced save, auto-resume.

**Remaining tech debt (3 items):**
- Kinescope React player broken — iframe workaround (не критично)
- Only 1 E2E test (landing) — auth/diagnostic/learning deferred
- Rate limiter в globalThis Map — нужен Redis для production scale

## Constraints

- **Database:** Supabase free tier — 500MB storage, 7-day pause policy (keep-alive workflow active)
- **LLM Budget:** OpenRouter pay-per-use, rate limits (50 req/hour LLM, 20 msg/hour chat)
- **VPS:** Single server (89.208.106.208), нет автоскейлинга
- **Video:** Kinescope iframe embed (React player broken)
- **Tech Stack:** Locked — Next.js 14, tRPC, Prisma, Supabase, Turborepo (не менять)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| UI-First development (Sprint 0-2) | Не блокироваться контентом | ✓ Good |
| Supabase Auth + Google OAuth | Простая интеграция, бесплатно | ✓ Good |
| In-memory mock → Prisma migration | Strangler Fig pattern, fallback на mock | ✓ Good |
| OpenRouter мульти-модель | Fallback между моделями | ✓ Good |
| RAG vector search threshold 0.3 | Лучший recall для образовательного контента | ✓ Good |
| Triple fallback для AI вопросов | AI → mock per-category → full mock | ✓ Good |
| Kinescope iframe вместо React player | React player v0.5.4 broken | ✓ Good (workaround) |
| Docker + Nginx + Let's Encrypt | Full control, DuckDNS для бесплатного домена | ✓ Good |
| SafeMarkdown (react-markdown + rehype-sanitize) | XSS prevention для AI output | ✓ Good |
| Rate limiter в globalThis Map | HMR persistence, простота | ⚠️ Revisit для production scale |
| QA минимально в v1.0 | Фокус на функциональность | ⚠️ Revisit — нужны тесты |

| Admin panel по паттерну MPSTATS Connect | Двойной guard + adminProcedure в tRPC | ✓ Good |
| SourceContext pattern для interactive tooltips | React context injection в markdown tree | ✓ Good |
| Lazy video loading (click-to-play) | Не блокировать рендер страницы Kinescope JS | ✓ Good |
| Kinescope postMessage time tracking | Event API broken → fallback timer 10s | ✓ Good (workaround) |
| QuestionBank с TTL 7 дней | Instant diagnostic start, экономия LLM calls | ✓ Good |
| CSS variables для landing theme | Независимый theme scope через data-landing-theme | ✓ Good |
| FOUC prevention inline script | localStorage read before React hydration | ✓ Good |

---
*Last updated: 2026-02-28 after v1.1 milestone*
