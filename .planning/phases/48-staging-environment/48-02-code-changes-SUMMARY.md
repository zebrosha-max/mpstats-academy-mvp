---
phase: 48-staging-environment
plan: 02
subsystem: infra
tags: [staging, docker, feature-flags, next-public-env, yandex-metrika-guard]
dependency-graph:
  requires: []
  provides:
    - StagingBanner component wired to NEXT_PUBLIC_STAGING
    - docker-compose.staging.yml for VPS deploy
    - Feature-flag pattern NEXT_PUBLIC_SHOW_LIBRARY for hidden skill-courses
    - Yandex Metrika guard that excludes staging traffic
  affects:
    - apps/web/src/app/layout.tsx (all routes get banner + analytics guard)
    - apps/web/src/app/(main)/learn/page.tsx (Library hidden on prod)
tech-stack:
  added: []
  patterns:
    - NEXT_PUBLIC_* build-time flag via ARG/ENV in Dockerfile
    - Separate docker-compose project (maal-staging) for isolated stack
    - `process.env.FLAG === 'true'` strict guard pattern
key-files:
  created:
    - apps/web/src/components/shared/StagingBanner.tsx
    - apps/web/tests/unit/StagingBanner.test.tsx
    - docker-compose.staging.yml
    - .claude/memory/project_staging_environment.md
    - .claude/memory/MEMORY.md
    - .planning/phases/48-staging-environment/deferred-items.md
  modified:
    - Dockerfile
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/(main)/learn/page.tsx
    - apps/web/.env.example
    - .gitignore
    - CLAUDE.md
decisions:
  - D-14/D-15/D-16: StagingBanner rendered as first child of <body>, guard NEXT_PUBLIC_STAGING === 'true'
  - D-18/D-21: Feature flag pattern applied to Phase 46 LibrarySection
  - R5: Yandex Metrika condition extended with NEXT_PUBLIC_STAGING !== 'true' so staging traffic never enters prod funnel
  - R1: getLibrary endpoint already filters to `course.isHidden=true AND id like skill_%` — no backend change; client flag is sufficient
metrics:
  duration: ~25 min
  completed: 2026-04-23
  tasks: 3
  commits: 3
---

# Phase 48 Plan 02: Code Changes Summary

Dockerfile + staging compose + StagingBanner + LibrarySection feature flag + Yandex Metrika guard + docs/memory, all additive and prod-safe.

## What shipped

Three atomic commits landed on worktree branch `worktree-agent-af94ff51`:

| Task | Commit  | Scope |
|------|---------|-------|
| 1    | c56ac76 | StagingBanner component + 4 unit tests + Dockerfile ARG/ENV |
| 2    | 366ce60 | layout.tsx integration + Yandex Metrika guard + LibrarySection flag |
| 3    | 0c89d62 | docker-compose.staging.yml + .gitignore + .env.example + CLAUDE.md + memory |

## Verification Results

All acceptance checks passed on the worktree:

| Check | Command | Result |
|-------|---------|--------|
| Unit tests (StagingBanner) | `pnpm --filter @mpstats/web test -- StagingBanner` | 4 passed |
| Typecheck (web) | `pnpm --filter @mpstats/web typecheck` | exit 0 |
| Dockerfile ARG | `grep "ARG NEXT_PUBLIC_STAGING" Dockerfile` | lines 38-39 |
| Dockerfile ENV | `grep "ENV NEXT_PUBLIC_SHOW_LIBRARY" Dockerfile` | line 41 |
| layout import | `grep "import { StagingBanner }" layout.tsx` | line 10 |
| layout render | `grep "<StagingBanner />" layout.tsx` | line 73 |
| Metrika guard | `grep "NEXT_PUBLIC_STAGING !== 'true'" layout.tsx` | line 81 |
| Library flag | `grep "NEXT_PUBLIC_SHOW_LIBRARY === 'true'" learn/page.tsx` | line 876 |
| gitignore | `grep "^\.env\.staging$" .gitignore` | line 15 |
| CLAUDE.md section | `grep "## Staging Workflow" CLAUDE.md` | present |
| Memory entry | `test -f .claude/memory/project_staging_environment.md` | 62 lines |
| MEMORY index | `grep "project_staging_environment.md" .claude/memory/MEMORY.md` | present |
| Compose syntax | `docker compose -f docker-compose.staging.yml config --quiet` (with stub `.env.staging`) | exit 0 |
| gitignore effectiveness | `touch .env.staging && git status` | not listed — ignored |

## Files Changed

### Created
- `apps/web/src/components/shared/StagingBanner.tsx` — 17 lines, server component, `return null` guard on flag mismatch.
- `apps/web/tests/unit/StagingBanner.test.tsx` — 4 test cases (true, undefined, 'false', empty string).
- `docker-compose.staging.yml` — project `maal-staging`, container `maal-staging-web`, port `127.0.0.1:3001:3000`, hard-coded `NEXT_PUBLIC_STAGING="true"` and `NEXT_PUBLIC_SITE_URL=https://staging.platform.mpstats.academy`, reads shared secrets from `.env.staging`.
- `.claude/memory/project_staging_environment.md` — VPS paths, nginx/certbot troubleshooting, NEXT_PUBLIC_* gotcha reminder, cleanup backlog.
- `.claude/memory/MEMORY.md` — new worktree-local index with the staging entry.
- `.planning/phases/48-staging-environment/deferred-items.md` — records pre-existing Yandex OAuth test failures (out of scope, reproduce on master without my changes).

### Modified
- `Dockerfile` — added `ARG NEXT_PUBLIC_STAGING`, `ARG NEXT_PUBLIC_SHOW_LIBRARY` and corresponding `ENV` pairs after the existing NEXT_PUBLIC block, before server-side ARG block. Prod build stays safe: if args not passed, env vars resolve to empty string, `=== 'true'` is false.
- `apps/web/src/app/layout.tsx` — imported `StagingBanner`, rendered as first child of `<body>`; Yandex Metrika condition now also requires `NEXT_PUBLIC_STAGING !== 'true'`.
- `apps/web/src/app/(main)/learn/page.tsx` — wrapped `<LibrarySection />` in `process.env.NEXT_PUBLIC_SHOW_LIBRARY === 'true'` guard; added comment pointing to CLAUDE.md Staging Workflow.
- `apps/web/.env.example` — appended staging-only flag hints (commented, both `NEXT_PUBLIC_STAGING` and `NEXT_PUBLIC_SHOW_LIBRARY`).
- `.gitignore` — explicit `.env.production` and `.env.staging` lines.
- `CLAUDE.md` (project-root) — new `## Staging Workflow` section inserted before `## QA`: deploy commands, active feature-flags table, "add new flag" recipe, rollback, known limitations (Yandex OAuth, Supabase Site URL, CarrotQuest, git-branch hygiene, no public roadmap entry).

## Risk Disposition

| ID | Status | Note |
|----|--------|------|
| R1 (Library endpoint needs change) | resolved | `packages/api/src/routers/learning.ts:95-146` already filters `course: { isHidden: true, id: { startsWith: 'skill_' } }`. Client flag alone is enough. |
| R5 (Yandex Metrika on staging) | resolved | Guard added: `NEXT_PUBLIC_STAGING !== 'true'` combined with existing `NODE_ENV === 'production'` check. |
| T-48-07 (.env.staging leak) | mitigated | Explicit `.gitignore` entry verified with `git status` after `touch .env.staging`. |
| T-48-08 (prod build breaks) | safe | Accepted as safe: new ARGs default to empty string, prod compose untouched. |

## Deviations from Plan

### Scope-boundary deferrals (out of scope)

**Pre-existing test failures in Yandex OAuth suite.** During Task 2 verification `pnpm --filter @mpstats/web test` reported 3/61 failures in `tests/auth/oauth-provider.test.ts` and `tests/auth/yandex-oauth.test.ts`. Verified on clean master (via `git stash`) — failures reproduce without any of my changes, so this is unrelated tech debt from Phase 44 OAuth hardening. Logged in `.planning/phases/48-staging-environment/deferred-items.md`. Not a blocker for Phase 48: StagingBanner tests (the thing this plan added) are all green.

### Infrastructure quirks worth noting

**`.claude/memory/` directory did not exist in the git worktree.** Had to create it with `mkdir -p .claude/memory` before adding the memory entry + MEMORY index. This is expected behavior for worktrees (that directory lives outside git-tracked content on the main checkout too — it is tracked only via its file contents). Both files now committed to the worktree branch.

**`docker db:generate` needed before typecheck** in a fresh worktree because `node_modules/@prisma/client` is not hydrated by `pnpm install`. Unrelated to staging work but documented here so the orchestrator knows subsequent worktree agents must `pnpm db:generate` post-install.

## Open cleanup items (for Plan 48-03 or backlog)

- **CarrotQuest guard for staging** — currently CQ events from staging leak into prod workspace. Team decided to filter by `staging-*` email prefix for now; if it becomes noisy, add `NEXT_PUBLIC_STAGING !== 'true'` around the CQ script block in layout.tsx.
- **Yandex OAuth callback URL on staging** — needs admin action in Yandex OAuth app + Supabase Auth allowed redirect URLs. Covered in Plan 48-03's manual verifications.
- **Public roadmap entry** — explicitly skipped per `feedback_public_roadmap.md` (techincal infra stays out of client-facing changelog).

## Ready for Plan 48-03

All code-wave acceptance criteria (SC-2, SC-3, SC-4, SC-7) met. Prod invariants preserved: no changes to `docker-compose.yml`, no schema changes, empty-default ARGs keep prod build byte-compatible. Worktree ready for `git pull && docker compose -p maal-staging -f docker-compose.staging.yml up -d --build` on the VPS once DNS/nginx/basic auth from Plan 48-01 are live.

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: `apps/web/src/components/shared/StagingBanner.tsx`
- FOUND: `apps/web/tests/unit/StagingBanner.test.tsx`
- FOUND: `docker-compose.staging.yml`
- FOUND: `.claude/memory/project_staging_environment.md`
- FOUND: `.claude/memory/MEMORY.md`
- FOUND: `.planning/phases/48-staging-environment/deferred-items.md`

**Commits verified in `git log`:**
- FOUND: c56ac76 — feat(48-02): add StagingBanner component + Dockerfile ARGs
- FOUND: 366ce60 — feat(48-02): wire StagingBanner + Library feature flag + Yandex Metrika guard
- FOUND: 0c89d62 — chore(48-02): add staging compose + .env.example + docs + memory
