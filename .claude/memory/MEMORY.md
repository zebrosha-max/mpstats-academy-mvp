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

## Staging Environment — Phase 48 (2026-04-23)
- [project_staging_environment.md](project_staging_environment.md) — второй Docker-стенд `staging.platform.mpstats.academy`, basic auth `team`, порт 3001, shared Supabase DB, feature flags `NEXT_PUBLIC_STAGING` + `NEXT_PUBLIC_SHOW_LIBRARY`. Deploy: `docker compose -p maal-staging -f docker-compose.staging.yml up -d --build`.
