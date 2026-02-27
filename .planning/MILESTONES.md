# Milestones

## v1.0 MVP (Shipped: 2026-02-26)

**Phases:** 10 (Phase 1-9 + 5.1) | **Plans:** 20 | **Requirements:** 42/42
**Timeline:** 49 days (2026-01-08 → 2026-02-26)
**Lines of code:** 15,043 TypeScript
**Production:** https://academyal.duckdns.org

**Delivered:** Образовательная платформа с AI-диагностикой навыков, персонализированным треком обучения, RAG-чатом по 405 видеоурокам на Kinescope, и production deploy на VPS с HTTPS.

**Key accomplishments:**
1. Миграция всех роутеров (learning, diagnostic, profile) с mock на Prisma + Supabase
2. AI генерация диагностических вопросов из RAG chunks с triple fallback chain
3. Kinescope видеоинтеграция: 405 видео (209 GB), iframe player с seekTo по таймкодам
4. Access control с персонализированным треком обучения ("Мой трек")
5. Security hardening: rate limiting, protectedProcedure, SafeMarkdown, error boundaries
6. Production deploy: Docker + Nginx + Let's Encrypt SSL на VPS, CI/CD pipeline

**Known tech debt (9 items):**
- Kinescope React player broken — iframe workaround
- Only 1 E2E test (landing) — auth/diagnostic/learning deferred
- UX spinner timing during AI question generation
- In-memory activeSessionQuestions (globalThis)
- Hardcoded Prisma version in Dockerfile

**Archives:** `milestones/v1.0-ROADMAP.md`, `milestones/v1.0-REQUIREMENTS.md`, `milestones/v1.0-MILESTONE-AUDIT.md`

---


## v1.1 Admin & Polish (Shipped: 2026-02-28)

**Phases:** 6 (Phase 10-15) | **Plans:** 11 | **Requirements:** 25/25
**Timeline:** 2 days (2026-02-26 → 2026-02-27)
**Commits:** 81 | **Files modified:** 92 | **Changes:** +11,366 / -950 lines
**Lines of code:** 18,017 TypeScript (total codebase)
**Production:** https://academyal.duckdns.org

**Delivered:** Админ-панель с управлением пользователями и контентом, улучшенный UX источников с seekTo, lazy video loading, watch progress tracking, миграция in-memory данных в DB, landing redesign с dark/light theme toggle.

**Key accomplishments:**
1. Админ-панель — dashboard KPIs, управление пользователями (is_admin/is_active toggles), аналитика, inline-редактирование курсов/уроков
2. Summary & Sources UX — интерактивные [N] бейджи с тултипами и seekTo по видео, collapsible summary
3. Производительность — lazy video loading (click-to-play), tRPC кеширование 30min, consolidated DB queries
4. Watch Progress Tracking — сохранение позиции видео в БД, прогресс-бары на карточках, автовозобновление
5. Tech Debt Cleanup — in-memory → Prisma, QuestionBank с TTL 7 дней, progressive loading UX, dynamic Prisma в Dockerfile
6. Landing Redesign — unified лендинг с dark/light theme toggle, CSS variables, FOUC prevention

**v1.0 tech debt resolved:**
- ~~UX spinner timing~~ — progressive loading UX (Phase 14)
- ~~In-memory activeSessionQuestions~~ — Prisma DB persistence (Phase 14)
- ~~Hardcoded Prisma version in Dockerfile~~ — dynamic engine copy (Phase 14)

**Remaining tech debt:**
- Kinescope React player broken — iframe workaround (не критично)
- Only 1 E2E test (landing) — auth/diagnostic/learning deferred
- Rate limiter в globalThis Map — нужен Redis для production scale

**Archives:** `milestones/v1.1-ROADMAP.md`, `milestones/v1.1-REQUIREMENTS.md`
**Git range:** feat(10-01)..feat(15-02)

---

