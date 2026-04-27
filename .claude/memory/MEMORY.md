# MAAL Project Memory Index

Entries referenced by CLAUDE.md and Phase plans.

## Session & Sprint
- [Session History](session-history.md) — Detailed notes for all dev sessions (phases 1-43)
- [Sprint Progress](sprint-progress.md) — Completed sprints 0-5 with task IDs (all done)

## Infra & Platform
- [Supabase Details](supabase-details.md) — RLS strategy, keep-alive, test users, auth gotchas
- [Deploy Details](deploy-details.md) — VPS 89.208.106.208, Docker, Nginx, domain migration
- [CQ Integration](cq-integration.md) — CarrotQuest API gotchas, events, email automation
- [Design Backups](design-backups.md) — Figma sources, v1 backup location, architecture HTML

## Staging Environment — Phase 48 (2026-04-23 … 2026-04-24)
- [project_staging_environment.md](project_staging_environment.md) — второй Docker-стенд `staging.platform.mpstats.academy`, basic auth `team`, порт 3001, shared Supabase DB, feature flags `NEXT_PUBLIC_STAGING` + `NEXT_PUBLIC_SHOW_LIBRARY`. Deploy: `docker compose -p maal-staging -f docker-compose.staging.yml up -d --build`.
- [project_phase48_debug_postmortem.md](project_phase48_debug_postmortem.md) — 5-layer debug инцидент при запуске Library feature-flag: Turbo strict env / compose `${VAR}` / `process is not defined` / API filter vs Phase 46 data drift / UI placement. Чеклист перед каждым новым staging-флагом.

## Phase 49 — Lesson Materials (shipped 2026-04-27)
- [project_lesson_materials.md](project_lesson_materials.md) — schema (Material/LessonMaterial/MaterialType), Storage bucket `lesson-materials` (private, 25 MB, MIME whitelist), 9-procedure tRPC router с XOR source validation и ACL через прикреплённые уроки, ingest скрипт залил 62 материала + 97 привязок из Google Sheet методологов, UI секция «Материалы к уроку» на `/learn/[id]` (5 type configs, locked-lesson защита через empty array), админка `/admin/content/materials` с drag-n-drop upload через signed PUT URL, daily cron на orphan-файлы. Methodologist guide — `docs/admin-guides/lesson-materials.md`.
