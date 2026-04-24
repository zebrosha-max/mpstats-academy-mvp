# Staging Environment — реализация и эксплуатация

**Phase:** 48 (shipped 2026-04-23+)
**Status:** Active

## Что это
Второй Docker-стенд на VPS 89.208.106.208 под поддоменом `staging.platform.mpstats.academy`. Цель — показывать команде WIP-фичи через feature flags без риска для prod.

## Архитектура
- Prod: `docker-compose.yml`, project `maal`, container `maal-web-1`, порт 3000, env `.env.production`
- Staging: `docker-compose.staging.yml`, project `maal-staging`, container `maal-staging-web`, порт 3001, env `.env.staging`
- Shared Supabase DB (D-05). Тестовые юзеры с префиксом `staging-*@mpstats.academy`.

## VPS файлы
| Путь | Содержимое |
|------|-----------|
| `/home/deploy/maal/.env.staging` | Копия `.env.production` + `NEXT_PUBLIC_STAGING=true` + фича-флаги. Не в git. |
| `/etc/nginx/sites-available/staging.platform.mpstats.academy` | vhost (HTTPS + basic auth + noindex + proxy_pass :3001) |
| `/etc/nginx/.htpasswd-staging` | bcrypt hash user `team`, 640 root:www-data |
| `/etc/letsencrypt/live/staging.platform.mpstats.academy/` | SSL cert (auto-renewal через certbot.timer) |

## NEXT_PUBLIC_* build-time gotcha
Эти переменные вшиваются в JS-бандл при `pnpm build`, не runtime. Поэтому:
1. Должны быть переданы как `ARG` в Dockerfile
2. Должны быть переданы через `args:` в docker-compose.staging.yml
3. При смене флага — полный `up -d --build`, рестарта контейнера мало

Известный инцидент: Phase 19 commit `82427f4` (CP public key missing).

## Troubleshooting

### `docker compose up` собирается, но плашка STAGING не видна
- Проверить, что `.env.staging` содержит `NEXT_PUBLIC_STAGING=true`
- Проверить, что `docker-compose.staging.yml` args содержит `NEXT_PUBLIC_STAGING: "true"`
- Убедиться что был `--build`, не только `up -d`
- `docker compose -p maal-staging -f docker-compose.staging.yml logs web | head -50` — искать `NEXT_PUBLIC_STAGING` в build-log

### `nginx -t` падает после reload
- Откатить vhost: `sudo rm /etc/nginx/sites-enabled/staging.platform.mpstats.academy && sudo systemctl reload nginx`
- Разобрать ошибку, починить конфиг, повторить

### curl возвращает 502 с правильным паролем
- Staging-контейнер не стартовал или упал. `docker ps -a | grep maal-staging` + `docker logs maal-staging-web`
- Порт конфликт: `ss -tlnp | grep 3001`

### Library (Phase 46) пустая на staging с флагом
- `packages/api/src/routers/learning.ts:95-146` — endpoint `getLibrary` фильтрует `course: { isHidden: true, id: { startsWith: 'skill_' } }`. Проверить в Supabase: есть ли skill-курсы с таким `isHidden` + `id LIKE 'skill_%'` + уроки с `videoId not null`. Если нет — контент не попадал в БД, надо догнать seed.

### Prod сломался после деплоя staging
- Критично проверить что `docker compose -p maal-staging` использовался, а не default project
- `git status` на VPS — если на VPS активна ветка, отличная от master, сделать `git checkout master && docker compose down && docker compose build --no-cache && docker compose up -d`
- Смотреть логи prod: `docker compose logs --tail=100 -f` (без `-p`, default project)

## Связанные решения
- D-01..D-27 — в `.planning/phases/48-staging-environment/48-CONTEXT.md`
- Research R1..R9 — в `.planning/phases/48-staging-environment/48-RESEARCH.md`

## Cleanup кандидаты (backlog)
- CarrotQuest condition (не грузить на staging) — сейчас CQ events летят в prod workspace
- Supabase OAuth Redirect URLs — добавить staging callback для Yandex OAuth
- Feature flag UI (`/admin/flags`) — если флагов станет >5
- Zero-downtime prod deploy — отдельная фаза после staging
