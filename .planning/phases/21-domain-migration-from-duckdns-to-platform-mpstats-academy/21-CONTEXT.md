# Phase 21: Domain Migration from DuckDNS to platform.mpstats.academy - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Перевод production-приложения с временного `academyal.duckdns.org` на постоянный домен `platform.mpstats.academy`. Включает: настройку DNS на Рег.ру, SSL-сертификат, обновление всех конфигов (Nginx, env, OAuth, Supabase), ребилд Docker-контейнера и верификацию работоспособности.

</domain>

<decisions>
## Implementation Decisions

### DNS-настройка на Рег.ру
- Домен `mpstats.academy` уже куплен на Рег.ру
- Нужно добавить A-запись `platform` → `89.208.106.208` (VPS IP)
- TTL: 300 (5 минут) на время миграции, потом можно увеличить до 3600
- Если DNS-зона не создана — создать через панель Рег.ру

### SSL-сертификат
- Let's Encrypt через certbot (как для DuckDNS)
- Команда: `certbot --nginx -d platform.mpstats.academy`
- Certbot авторенью уже настроен на VPS

### Nginx
- Обновить `server_name` с `academyal.duckdns.org` на `platform.mpstats.academy`
- Сохранить `proxy_buffer_size 128k` (обязателен для Supabase auth cookies)
- Все остальные настройки (proxy_pass, headers) без изменений

### Environment & Docker
- Обновить `.env.production` на VPS: `NEXT_PUBLIC_SITE_URL=https://platform.mpstats.academy`
- `NEXT_PUBLIC_*` вшиваются при build time — обязателен docker compose build --no-cache
- Symlink `.env` → `.env.production` сохраняется

### OAuth & Auth
- Supabase Dashboard: обновить Site URL + Redirect URLs на `https://platform.mpstats.academy`
- Yandex OAuth (oauth.yandex.ru): обновить Redirect URI на `https://platform.mpstats.academy/api/auth/yandex/callback`
- Auth callback в коде использует `NEXT_PUBLIC_SITE_URL` — не требует изменений в коде

### Старый домен
- `academyal.duckdns.org` — просто выключить, без редиректа
- DuckDNS бесплатный, временный — нет причин поддерживать
- Удалить старый SSL-сертификат для DuckDNS из certbot

### Стратегия переключения
- Одноэтапная: настроить DNS → подождать propagation → обновить всё на VPS разом → проверить
- Downtime минимальный (5-10 мин на ребилд контейнера)
- Пользователей мало — координация не нужна

### Claude's Discretion
- Порядок шагов на VPS (nginx reload vs docker rebuild)
- Нужна ли временная страница maintenance
- Формат верификации (ручная проверка vs curl-скрипт)

</decisions>

<specifics>
## Specific Ideas

- В CLAUDE.md уже есть готовый "Domain Migration Checklist" — использовать как чеклист
- После миграции обновить все упоминания `academyal.duckdns.org` в CLAUDE.md и документации
- Обновить MEMORY.md (migration checklist → отметить выполненные пункты)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Существующий Nginx конфиг на VPS (`/etc/nginx/sites-available/`)
- Docker Compose конфиг (`docker-compose.yml`) с `NEXT_PUBLIC_SITE_URL` build arg
- Let's Encrypt certbot уже установлен и настроен
- `.env.production` на VPS уже содержит все переменные

### Established Patterns
- `NEXT_PUBLIC_SITE_URL` используется в auth callback redirect (`apps/web/src/lib/auth/actions.ts`)
- Auth callback route: `apps/web/src/app/auth/callback/route.ts`
- Docker build: 5-stage multi-stage build с turbo prune

### Integration Points
- Supabase Dashboard (Authentication > URL Configuration)
- Yandex OAuth app (oauth.yandex.ru)
- VPS Nginx config
- VPS `.env.production`
- Docker Compose build args

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-domain-migration-from-duckdns-to-platform-mpstats-academy*
*Context gathered: 2026-03-11*
