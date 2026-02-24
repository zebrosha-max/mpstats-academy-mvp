# Phase 6: Production Deploy - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Довести production deploy до полностью рабочего состояния. Приложение на VPS (89.208.106.208) должно работать E2E: регистрация -> диагностика -> результаты -> курсы -> урок -> RAG chat. Все страницы отображают реальные данные, ни одна не пустая.

**Уже сделано (Phase 05.1 + ручной деплой):**
- Docker container собран и запущен (healthy)
- Nginx reverse proxy + Let's Encrypt SSL (academyal.duckdns.org)
- Google OAuth redirect исправлен
- Landing page доступна по HTTPS

**Нужно доделать:**
- Пустые страницы (Dashboard, Learn) — вероятно не засижена БД или Prisma/SSL баг
- Prisma libssl.so.1.1 warning — может блокировать DB-роуты
- CI/CD pipeline для автодеплоя
- Health check endpoint
- E2E верификация полного flow

</domain>

<decisions>
## Implementation Decisions

### Scope (что считаем готовностью)
- Полный E2E flow работает на проде: регистрация -> диагностика -> результаты -> обучение -> RAG chat
- Все страницы показывают реальные данные (не пустые экраны)
- PM2 и ngrok из оригинального плана НЕ нужны (Docker + DuckDNS уже есть)

### Seeding подход
- Claude's Discretion: выбрать оптимальный подход (seed в Docker или с локального PC через Supabase cloud)
- Таблицы Course/Lesson должны быть заполнены реальными данными

### Prisma SSL
- Исследовать и починить libssl.so.1.1 warning
- Проверить работают ли DB-роуты в продакшене, если нет — добавить openssl в Docker image

### Deploy workflow
- GitHub Actions CD pipeline
- Триггер: push в master (удобно для Claude Code, который делает 99% пушей)
- SSH доступ: проверить существующий deploy key от vps-ops-manager агента, если нет — создать новый
- Секреты: SSH key + VPS host/user в GitHub Secrets

### Claude's Discretion
- Health check: минимальный /api/health endpoint (app + DB status), Docker restart policy
- Мониторинг: разумный минимум для MVP (можно добавить алерты позже)
- CD pipeline: конкретная реализация (ssh action, docker compose rebuild)

</decisions>

<specifics>
## Specific Ideas

- E2E проверка через Chrome браузер (Claude-in-Chrome) после деплоя — пройти полный flow
- Автоматические smoke tests (curl/Playwright) после каждого деплоя
- Ручная проверка: открыть каждую страницу, убедиться что данные отображаются

</specifics>

<deferred>
## Deferred Ideas

- Phase 4: Access Control & Personalization — мягкое ограничение доступа, персонализированный трек
- Phase 5: Security Hardening — protected endpoints, rate limiting, XSS sanitization
- Telegram алерты при падении контейнера — можно добавить после MVP

</deferred>

---

*Phase: 06-production-deploy*
*Context gathered: 2026-02-24*
