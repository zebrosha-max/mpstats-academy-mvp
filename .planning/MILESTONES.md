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

