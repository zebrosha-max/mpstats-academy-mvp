---
phase: 26-yandex-metrika
plan: 01
subsystem: analytics
tags: [yandex-metrika, analytics, goals, tracking, next-yandex-metrika]

# Dependency graph
requires:
  - phase: 21-domain-migration
    provides: production domain platform.mpstats.academy
provides:
  - Yandex.Metrika counter on all production pages with SPA tracking
  - 8 typed conversion goals (signup, login, diagnostic, lesson, payment, CTA)
  - Typed analytics helper module (reachGoal + METRIKA_GOALS constants)
  - Docker build-time NEXT_PUBLIC_YANDEX_ID inlining
affects: [future analytics phases, A/B testing, conversion optimization]

# Tech tracking
tech-stack:
  added: ["@koiztech/next-yandex-metrika"]
  patterns: [typed analytics goals with safe reachGoal helper, production-only counter rendering]

key-files:
  created:
    - apps/web/src/lib/analytics/constants.ts
    - apps/web/src/lib/analytics/metrika.ts
    - apps/web/src/types/yandex-metrika.d.ts
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/(auth)/register/page.tsx
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(main)/diagnostic/session/page.tsx
    - apps/web/src/app/(main)/diagnostic/results/page.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx
    - apps/web/src/app/pricing/page.tsx
    - apps/web/src/app/page.tsx
    - Dockerfile
    - docker-compose.yml
    - .env.example

key-decisions:
  - "Used @koiztech/next-yandex-metrika for SPA-aware counter (same as mpstats-connect)"
  - "Production-only rendering via process.env.NODE_ENV check"
  - "platform_ prefix for all goal names to distinguish from connect_ goals on shared counter"

patterns-established:
  - "Analytics goal pattern: typed constants + safe reachGoal helper with window/ym/counterId null checks"
  - "Build-time env var pattern: ARG + ENV in Dockerfile, build.args in docker-compose.yml"

requirements-completed: [YM-01, YM-02, YM-03]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 26: Yandex Metrika Summary

**Yandex.Metrika counter (94592073) with 8 typed conversion goals across auth/diagnostic/learning/billing pages, Docker build-time env inlining**

## Performance

- **Duration:** 5 min (continuation from checkpoint)
- **Started:** 2026-03-19T10:00:00Z
- **Completed:** 2026-03-19T10:54:00Z
- **Tasks:** 3 (2 auto + 1 human-action)
- **Files modified:** 14

## Accomplishments
- Yandex.Metrika counter loads on all production pages with webvisor, clickmap, trackLinks, accurateTrackBounce
- 8 typed goals wired into 7 pages: signup, login, diagnostic start/complete, lesson open, pricing view, payment, CTA click
- Safe reachGoal helper with window/ym/counterId null checks prevents errors in SSR/dev
- Docker build config updated for NEXT_PUBLIC_YANDEX_ID build-time inlining
- 8 goals created in Metrika dashboard as JavaScript events (human-verified)
- Counter confirmed loading in production after deploy

## Task Commits

Each task was committed atomically:

1. **Task 1: Install package, create analytics module, add YandexMetrika to layout, update build config** - `d4ce9b3` (feat)
2. **Task 2: Wire reachGoal calls into 7 pages** - `088fec8` (feat)
3. **Task 3: Create 8 goals in Yandex.Metrika dashboard + deploy + verify** - no commit (human-action: dashboard configuration + VPS deploy)

## Files Created/Modified
- `apps/web/src/lib/analytics/constants.ts` - 8 typed goal constants with MetrikaGoal type
- `apps/web/src/lib/analytics/metrika.ts` - Safe reachGoal helper with null checks
- `apps/web/src/types/yandex-metrika.d.ts` - Window.ym global type declaration
- `apps/web/src/app/layout.tsx` - YandexMetrika component (production-only)
- `apps/web/src/app/(auth)/register/page.tsx` - SIGNUP goal on email/yandex registration
- `apps/web/src/app/(auth)/login/page.tsx` - LOGIN goal on email/yandex login
- `apps/web/src/app/(main)/diagnostic/session/page.tsx` - DIAGNOSTIC_START goal
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` - DIAGNOSTIC_COMPLETE goal with avgScore
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - LESSON_OPEN goal with courseId/lessonId
- `apps/web/src/app/pricing/page.tsx` - PRICING_VIEW + PAYMENT goals
- `apps/web/src/app/page.tsx` - CTA_CLICK goal with position param
- `Dockerfile` - ARG + ENV for NEXT_PUBLIC_YANDEX_ID
- `docker-compose.yml` - build arg for NEXT_PUBLIC_YANDEX_ID
- `.env.example` - NEXT_PUBLIC_YANDEX_ID documented (replaced unused PostHog vars)

## Decisions Made
- Used @koiztech/next-yandex-metrika for SPA-aware counter (same package as mpstats-connect project)
- Production-only rendering via process.env.NODE_ENV === 'production' check
- All goal names prefixed with `platform_` to distinguish from `connect_` goals on the shared counter 94592073

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
Task 3 was a human-action checkpoint. User completed:
- Created 8 goals in Yandex.Metrika dashboard (counter 94592073) as JavaScript events
- Added NEXT_PUBLIC_YANDEX_ID=94592073 to VPS .env.production
- Redeployed application on VPS

## Next Phase Readiness
- Analytics foundation complete, conversion data will start flowing into Metrika reports
- Ready for Phase 27 (SEO + Custom Error Pages) or any subsequent phase

## Self-Check: PASSED

All files found, all commits verified.

---
*Phase: 26-yandex-metrika*
*Completed: 2026-03-19*
