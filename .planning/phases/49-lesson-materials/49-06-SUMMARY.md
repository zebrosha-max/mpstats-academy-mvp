---
phase: 49-lesson-materials
plan: 06
subsystem: deployment
tags: [playwright, cron, sentry, github-actions, deploy, roadmap]

requires:
  - phase: 49-01-schema-storage
    provides: "Material/LessonMaterial models + bucket — needed for cron orphan-cleanup target"
  - phase: 49-02-trpc-router
    provides: "tRPC API surface — E2E tests exercise via UI"
  - phase: 49-03-ingest
    provides: "62 Material + 97 LessonMaterial in prod — needed for E2E to find content + roadmap to be honest"
  - phase: 49-04-lesson-ui
    provides: "Lesson page section under test"
  - phase: 49-05-admin
    provides: "Admin panel surfaced in E2E + методолог-инструкция"
provides:
  - "E2E Playwright spec (3 scenarios, env-gated to skip cleanly without fixtures)"
  - "Cron handler /api/cron/orphan-materials с Sentry checkin (180m margin)"
  - "GitHub Actions workflow — 03:00 UTC daily, Bearer-auth"
  - "Public /roadmap entry от 27.04.2026 (без техничек, корректное название курса)"
  - "Memory entry .claude/memory/project_lesson_materials.md + индекс"
  - "MAAL/CLAUDE.md Last Session запись"
  - "Methodologist guide docs/admin-guides/lesson-materials.md"
  - "Production deploy на 89.208.106.208 — 22 commits 49-* + 3 spillover-rollback"
affects: [49-followups]

tech-stack:
  added: []
  patterns:
    - "Cron Bearer auth с CRON_SECRET (matches Phase 29 check-subscriptions)"
    - "E2E env-gated skip pattern для unprovisioned environments"
    - "Spillover rollback через targeted Prisma deleteMany после ingest fuzzy-match"

key-files:
  created:
    - apps/web/tests/e2e/lesson-materials.spec.ts
    - apps/web/src/app/api/cron/orphan-materials/route.ts
    - .github/workflows/orphan-materials-cleanup.yml
    - docs/admin-guides/lesson-materials.md
    - .claude/memory/project_lesson_materials.md
    - .planning/phases/49-lesson-materials/49-06-SUMMARY.md
  modified:
    - apps/web/src/app/roadmap/page.tsx (запись 27.04)
    - .claude/memory/MEMORY.md (индексная ссылка)
    - CLAUDE.md (Last Session)
    - .planning/phases/49-lesson-materials/49-03-NOTES.md (rollback-секция)
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Roadmap текст: курс «Аналитика для маркетплейсов», без упоминания методологов и админки (per feedback_public_roadmap.md)"
  - "Spillover rollback: 3 LessonMaterial удалены напрямую через Prisma; Material записи остались как orphan для будущей ручной привязки"
  - "Build с --no-cache (8 мин build + ~3 мин up) — на 8 активных юзерах в момент деплоя приемлемый компромисс надёжности/downtime"
  - "Cron 03:00 UTC = 06:00 MSK — низкая нагрузка, до пика дневного трафика"

patterns-established:
  - "Pattern: ingest-followed-by-rollback. Fuzzy match даёт ложные склейки по общим названиям → manual review через `tail -n +2 matched.tsv | cut -fX | uniq -c` после apply, удалять конкретные LessonMaterial.id через prisma.deleteMany. Material остаётся orphan, методолог делает re-attach через админку."

requirements-completed:
  - "Phase 49 D-13 (cron orphan cleanup)"
  - "Phase 49 D-44 (E2E test coverage)"
  - "Phase 49 D-45 (deployment)"
  - "Phase 49 D-46 (memory entry + Last Session)"
  - "Phase 49 D-47 (methodologist guide)"

duration: ~120min (включая checkpoint итерации и spillover-rollback)
completed: 2026-04-27
---

# Phase 49 · Plan 06: Polish & Deploy Summary

**Lesson Materials feature live на платформе: 94 материала видны юзерам с активной подпиской под видео уроков курса «Аналитика для маркетплейсов», админка готова для догрузки методологом, daily cron подчищает orphan-файлы из Storage.**

## Что сделано

### E2E Playwright (a0ea1df)
`apps/web/tests/e2e/lesson-materials.spec.ts` — 3 сценария:
1. Подписчик на уроке с материалами — секция рендерится, кнопка скачивания работает (signed URL flow).
2. Залоченный урок (без подписки на курс) — секции нет в DOM (`data-testid="lesson-materials"` отсутствует) — D-29.
3. Админ открывает `/admin/content/materials` — список загружается без ошибок (D-32).

Тесты env-gated через `LESSON_MATERIALS_E2E=1` — в неподготовленном окружении skip silently, не валят CI. На запуске в dev/staging нужны fixtures: тестовый юзер с активной подпиской на 01_analytics, lessonId с materials, admin-сессия. Записаны в spec-файле как ENV var hints.

### Cron orphan-cleanup (a0ea1df)
`apps/web/src/app/api/cron/orphan-materials/route.ts` (152 строки):
- Bearer auth через `CRON_SECRET` (тот же токен, что для `check-subscriptions` cron Phase 29)
- Walk Supabase Storage bucket `lesson-materials` page-by-page (`list({ limit: 1000, offset })`)
- Фильтр: файлы старше 24h, `Material.storagePath != X` для каждого X в bucket → batched `remove()`
- Sentry `withMonitor` checkin slug `orphan-materials`, `checkinMargin: 180` мин (компенсирует GitHub Actions schedule drift, как в Phase 28 fix)
- Возвращает `{ scanned, deleted, errors }` JSON

`.github/workflows/orphan-materials-cleanup.yml` — schedule `0 3 * * *` (03:00 UTC = 06:00 MSK), вызывает `https://platform.mpstats.academy/api/cron/orphan-materials` с `Authorization: Bearer ${{ secrets.CRON_AUTH }}`.

### Public roadmap (5d7f5a8)
`apps/web/src/app/roadmap/page.tsx` — новая запись в начало `changelogEntries`:

> **27.04.2026** — В курсе «Аналитика для маркетплейсов» под уроками появились материалы — презентации, таблицы расчётов, чек-листы и ссылки на сервисы. Скачиваете нужное в один клик, открываете сервисы в новой вкладке. Постепенно добавим и в остальные курсы.

Без техничек, точное название курса (правка от Егора), честная фраза «постепенно добавим в остальные» (сейчас только аналитика).

### Spillover rollback (5d7f5a8)
Fuzzy-матч в 49-03 склеил 3 материала по общим названиям с уроками вне курса аналитики:
- 02_ads_m04_ads_economics_001 «Юнит-экономика» × 2 материала
- 05_ozon_m03_promotion_001 «Воронка продаж» × 1 материал

Удалил 3 `LessonMaterial.id` через `prisma.lessonMaterial.deleteMany`. `Material` записи остались (2 уникальных «Юнит-экономика» материала теперь orphan — методолог при необходимости привяжет к нужным аналитическим урокам через админку, 1 «Воронка продаж» материал остался привязан к 2 другим урокам аналитики).

LessonMaterial: 97 → **94**. Material: 62 (без изменений). Зафиксировано в `49-03-NOTES.md` секция «Rollback spillover-привязок».

### Docs / memory (987194a)
- `docs/admin-guides/lesson-materials.md` — пошаговая инструкция для методолога (создание материала, привязка через combobox, soft-delete) + ссылка на `49-03-NOTES.md` со списком 16 ручных кейсов.
- `.claude/memory/project_lesson_materials.md` — phase memory entry: gotchas, ingest dedup правило `(title, normalizedUrl)`, XOR validation паттерн, ACL pattern для getSignedUrl.
- `.claude/memory/MEMORY.md` — индексная ссылка на `project_lesson_materials.md`.
- `CLAUDE.md` — Last Session 2026-04-27 раздел про Phase 49.

### Production deploy
1. `git push origin master` — 25 commits (49-* + rename-23 + planning).
2. SSH `deploy@89.208.106.208`, `cd /home/deploy/maal`.
3. `git pull --ff-only` → 5d7f5a8.
4. `docker compose down`.
5. `docker compose build --no-cache` — 8 мин build (Turbo cache miss, prisma generate 16s, next build 2m28s).
6. `docker compose up -d` — контейнер healthy через 42s.
7. Smoke: `https://platform.mpstats.academy/` HTTP 200 (92ms), roadmap page содержит «В курсе «Аналитика для маркетплейсов»...», cron-route `/api/cron/orphan-materials` без auth → HTTP 401 (как и ожидалось, Bearer-only).

## Verification

| Critical truth | Evidence |
|---|---|
| E2E spec покрывает 3 сценария | `apps/web/tests/e2e/lesson-materials.spec.ts` 86 строк, 3 тест-кейса |
| Cron handler с Sentry checkin | `route.ts` 152 строки, `Sentry.withMonitor` slug `orphan-materials`, margin 180m |
| GitHub Actions workflow раз в сутки | `.github/workflows/orphan-materials-cleanup.yml` cron `0 3 * * *` |
| Memory entry в MEMORY.md | `grep project_lesson_materials.md .claude/memory/MEMORY.md` → 1 match |
| MAAL/CLAUDE.md Last Session | Секция «Phase 49 — Lesson Materials. SHIPPED.» добавлена в начало |
| Admin guide | `docs/admin-guides/lesson-materials.md` 99 строк, references 49-03-NOTES |
| Production deploy успешен | container `Up 42 seconds (healthy)`, HTTPS smoke 200 OK |

## Issues / Deviations

1. **Спилловер 3 привязки** — fuzzy-match 49-03 склеил материалы аналитики с уроками вне курса по совпадению названий. Откачено вручную. На будущее: после `--apply` всегда делать `tail -n +2 matched.tsv | cut -f1 | awk -F_ '{print $1"_"$2}' | sort -u | uniq -c` чтобы видеть распределение по курсам.
2. **Карьерный коридор для методологов** — 16 unmatched + 2 orphan «Юнит-экономика» = 18 материалов ждут ручной привязки через админку. Все детали в `49-03-NOTES.md` с jaccard-кандидатами на каждый кейс.
3. **Phase usage limit interrupt** — этот план стартовал в одном subagent run, упёрся в org monthly limit на стадии деплоя. Завершён в новой сессии (orchestrator inline-режим): committed staged docs (987194a), сделал spillover rollback (5d7f5a8), задеплоил.
4. **Pre-existing Windows+pnpm node_modules регрессия** (Next 14.2.35) — локальный typecheck/build падает на не-49 файлах (V8Header, auth/actions, middleware, supabase/server) с `Cannot find module 'next/link'`. Production Docker (Linux) работает чисто — это видно по успешному build на VPS. Локальный фикс — `pnpm install --frozen-lockfile`, out of scope phase 49.
