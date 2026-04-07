---
phase: 29-sentry-monitoring
plan: 02
subsystem: monitoring
tags: [sentry, spans, webhooks, llm-tracing, cron-monitoring]
dependency_graph:
  requires: [sentry-sdk]
  provides: [webhook-spans, llm-spans, cron-monitoring]
  affects: [apps/web/src/app/api/webhooks/, packages/ai/src/openrouter.ts]
tech_stack:
  added: ["@sentry/node@^10.47.0"]
  patterns: [Sentry.startSpan-wrapper, captureCheckIn-lifecycle, callWithSpan-helper]
key_files:
  created: []
  modified:
    - apps/web/src/app/api/webhooks/cloudpayments/route.ts
    - apps/web/src/app/api/webhooks/supabase-email/route.ts
    - packages/ai/src/openrouter.ts
    - packages/ai/src/index.ts
    - packages/ai/package.json
    - apps/web/src/app/api/cron/check-subscriptions/route.ts
    - apps/web/package.json
decisions:
  - "callWithSpan as opt-in helper (not wrapping getOpenRouterClient) for minimal coupling"
  - "@sentry/node for packages/ai since it has no @sentry/nextjs dependency"
  - "@sentry/nextjs added to apps/web as blocking dependency (Rule 3)"
metrics:
  duration: ~4min
  completed: 2026-04-07
  tasks_completed: 2
  tasks_total: 2
  status: complete
---

# Phase 29 Plan 02: Custom Sentry Spans Summary

Sentry spans on 4 critical endpoints: CloudPayments webhooks with per-event-type spans and tags, Supabase email webhook with per-action spans, OpenRouter callWithSpan helper for LLM call tracing, check-subscriptions cron with Sentry Crons lifecycle monitoring (in_progress/ok/error).

## Completed Tasks

### Task 1: Add Sentry spans to webhooks and OpenRouter

**Commit:** 0bf1730

- CloudPayments webhook: `Sentry.startSpan` wrapping main dispatch logic, tags for `cp.event_type` and `cp.tx_id`, `captureException` in catch
- Supabase email webhook: `Sentry.startSpan` wrapping switch block per `email_action_type`, `captureException` in outer catch
- OpenRouter: exported `callWithSpan<T>(name, model, fn)` helper with `op: 'ai.chat'` and `ai.model` attribute
- Added `@sentry/node` to `packages/ai/package.json`, re-exported from index.ts

### Task 2: Add Sentry Crons monitoring to check-subscriptions + typecheck

**Commit:** d15a280

- `captureCheckIn` with `in_progress` status at handler start (after auth)
- Monitor config: crontab `0 9 * * *`, checkinMargin 5min, maxRuntime 60s, timezone Europe/Moscow
- Success path: `captureCheckIn` with `ok` status
- Error path: `captureException` + `captureCheckIn` with `error` status
- Added `@sentry/nextjs` to `apps/web/package.json` (Rule 3: blocking dependency from 29-01 lost in worktree reset)
- Typecheck: no Sentry-related errors (pre-existing Prisma/implicit-any errors unchanged)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @sentry/nextjs missing from apps/web/package.json**
- **Found during:** Task 2 (typecheck)
- **Issue:** 29-01 plan installed @sentry/nextjs but the worktree was reset to base commit, losing that dependency
- **Fix:** Added `@sentry/nextjs: ^10.47.0` to apps/web/package.json dependencies
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Commit:** d15a280

## Self-Check: PASSED

All 4 modified files verified on disk. Commits 0bf1730 and d15a280 confirmed in git log.
