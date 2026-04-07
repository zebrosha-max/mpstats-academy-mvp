---
phase: 29-sentry-monitoring
plan: 01
subsystem: monitoring
tags: [sentry, error-tracking, performance, nextjs]
dependency_graph:
  requires: []
  provides: [sentry-sdk, error-boundary, source-maps, instrumentation]
  affects: [apps/web/next.config.js, apps/web/src/app/global-error.tsx]
tech_stack:
  added: ["@sentry/nextjs@^10.47.0"]
  patterns: [withSentryConfig-wrapper, instrumentation-hook, client-server-edge-configs]
key_files:
  created:
    - apps/web/sentry.client.config.ts
    - apps/web/sentry.server.config.ts
    - apps/web/sentry.edge.config.ts
    - apps/web/src/instrumentation.ts
    - apps/web/.env.example
  modified:
    - apps/web/package.json
    - apps/web/next.config.js
    - apps/web/src/app/global-error.tsx
    - pnpm-lock.yaml
decisions:
  - "@sentry/nextjs v10.47.0 (latest stable with Next.js 14 support)"
  - "Session replay only on errors (replaysOnErrorSampleRate: 1.0, session: 0)"
metrics:
  duration: ~3min
  completed: 2026-04-07
  tasks_completed: 1
  tasks_total: 2
  status: checkpoint-blocked
---

# Phase 29 Plan 01: Sentry SDK Installation Summary

@sentry/nextjs v10.47.0 with three config files (client/server/edge), withSentryConfig wrapper for source maps, global-error.tsx Sentry capture, instrumentation hook for runtime-specific init.

## Completed Tasks

### Task 1: Install SDK, create config files, wrap next.config, update global-error

**Commit:** b5dfe31

Installed @sentry/nextjs and created full monitoring foundation:

- **sentry.client.config.ts** -- Browser SDK: tracesSampleRate 0.3, replaysOnErrorSampleRate 1.0, replaysSessionSampleRate 0, enabled only in production
- **sentry.server.config.ts** -- Server SDK: tracesSampleRate 0.3, production only
- **sentry.edge.config.ts** -- Edge SDK: tracesSampleRate 0.3, production only
- **instrumentation.ts** -- Next.js instrumentation hook: dynamic imports per runtime (nodejs/edge), exports onRequestError for Sentry capture
- **next.config.js** -- Wrapped with withSentryConfig: hideSourceMaps true, silent unless CI, org/project/authToken from env
- **global-error.tsx** -- Added Sentry.captureException(error) before console.error in useEffect
- **.env.example** -- Created with all env var placeholders (Supabase, OpenRouter, CloudPayments, Sentry)

### Task 2: Verify Sentry project setup and env vars

**Status:** CHECKPOINT -- awaiting human verification

User needs to create Sentry project, configure DSN and auth token, verify build succeeds.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all code is wired to env vars. Sentry SDK is disabled when DSN is not set (graceful no-op).

## Self-Check: PASSED

All 5 created files verified on disk. Commit b5dfe31 confirmed in git log.
