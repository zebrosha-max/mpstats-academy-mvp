---
name: Staging Workflow
description: Полный workflow staging-стенда — деплой ветки, добавление feature flags, известные ограничения. Quick-reference в CLAUDE.md.
type: reference
---

# Staging Workflow

**URL:** https://staging.platform.mpstats.academy
**Basic Auth:** `team` / см. `Server auth.md` (локально, не в git)
**VPS:** 89.208.106.208, порт 3001, container `maal-staging-web`
**БД:** Shared с prod (Supabase). Тестовые аккаунты с префиксом `staging-*@mpstats.academy`.

## Деплой ветки на staging

```bash
ssh deploy@89.208.106.208
cd /home/deploy/maal
git fetch origin
git checkout <branch>
docker compose -p maal-staging -f docker-compose.staging.yml up -d --build

# ВАЖНО: вернуть master ДО следующего prod-deploy
git checkout master
```

## Активные feature flags

| Флаг | Что включает | Статус |
|------|-------------|--------|
| `NEXT_PUBLIC_STAGING=true` | Жёлтая плашка STAGING, глушит Yandex Metrika | Постоянный (задан в docker-compose.staging.yml) |
| `NEXT_PUBLIC_SHOW_LIBRARY=true` | Library section на `/learn` | Demo Phase 46 — уберём когда Library выйдет на prod |

## Добавить новый флаг

1. `ARG NEXT_PUBLIC_SHOW_X` + `ENV NEXT_PUBLIC_SHOW_X=$NEXT_PUBLIC_SHOW_X` в `Dockerfile`
2. `NEXT_PUBLIC_SHOW_X: ${NEXT_PUBLIC_SHOW_X:-false}` в `docker-compose.staging.yml` args
3. В коде: `{process.env.NEXT_PUBLIC_SHOW_X === 'true' && <FeatureComponent />}`
4. Добавить флаг в таблицу выше + в `.env.staging` на VPS
5. Rebuild staging: `docker compose -p maal-staging -f docker-compose.staging.yml up -d --build`
6. **При выходе фичи на prod:** удалить флаг из кода + убрать из таблицы + `unset` в `.env.staging`

## Rollback / остановка staging

```bash
docker compose -p maal-staging -f docker-compose.staging.yml down
# Prod не задет (другое project name)
```

## Known limitations

- **Yandex OAuth на staging:** callback URL `https://staging.platform.mpstats.academy/api/auth/yandex/callback` нужно добавить в Yandex OAuth app + Supabase Auth Redirect URLs. Пока не добавили — использовать email/password логин
- **Supabase Site URL** — глобальный, настроен на prod. Email-ссылки (password reset, DOI) со staging будут вести на prod-домен. Не баг, фича shared-DB
- **CarrotQuest events** — летят в prod workspace. Фильтровать по `staging-*` префиксу email. Cleanup: условие `NEXT_PUBLIC_STAGING !== 'true'` у CQ-скрипта в `layout.tsx` если понадобится
- **Git branch на VPS:** после staging deploy **обязательно** `git checkout master` перед prod-deploy, иначе prod соберётся с чужим кодом
- **Публичный роадмеп:** запись о staging в `/roadmap` НЕ делаем (правило из `feedback_public_roadmap.md` — техничка не идёт в публичный changelog)

Детали nginx/certbot/troubleshooting: `.claude/memory/project_staging_environment.md`. Phase 48 5-layer debug post-mortem: `.claude/memory/project_phase48_debug_postmortem.md`.
