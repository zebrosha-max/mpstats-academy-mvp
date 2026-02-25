---
phase: 05-security-hardening
plan: 02
subsystem: ui
tags: [react-markdown, rehype-sanitize, xss-prevention, error-boundary, next.js]

# Dependency graph
requires:
  - phase: 05-security-hardening/01
    provides: "Rate limiting and protectedProcedure on AI endpoints"
provides:
  - "SafeMarkdown component for safe AI output rendering"
  - "Error boundaries at global and section level"
  - "Custom 404 page with branded design"
affects: [lesson-page, ai-chat, ai-summary, error-handling]

# Tech tracking
tech-stack:
  added: [react-markdown, rehype-sanitize, remark-gfm]
  patterns: [SafeMarkdown for all AI-generated content, route-level error boundaries]

key-files:
  created:
    - apps/web/src/components/shared/SafeMarkdown.tsx
    - apps/web/src/app/error.tsx
    - apps/web/src/app/global-error.tsx
    - apps/web/src/app/not-found.tsx
    - apps/web/src/app/(main)/error.tsx
  modified:
    - apps/web/src/app/(main)/learn/[id]/page.tsx

key-decisions:
  - "SafeMarkdown blocks all links, images, scripts via allowlist (not blocklist)"
  - "not-found.tsx uses inline text logo instead of Logo component (server component compatibility)"
  - "global-error.tsx uses inline styles (no Tailwind — catches root layout failures)"

patterns-established:
  - "SafeMarkdown: All AI-generated markdown must use SafeMarkdown component, never dangerouslySetInnerHTML"
  - "Error boundaries: Route-level error.tsx per layout segment, no component-level ErrorBoundary wrappers"

requirements-completed: [SEC-03, SEC-05]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 05 Plan 02: Output Sanitization & Error Boundaries Summary

**SafeMarkdown component with react-markdown + rehype-sanitize replacing dangerouslySetInnerHTML, plus 4 error boundary pages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T13:16:17Z
- **Completed:** 2026-02-25T13:19:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Eliminated XSS vector: AI-generated markdown now rendered through react-markdown AST (not innerHTML)
- Sanitization schema blocks links, images, scripts — only safe elements allowed
- Error boundaries at 3 levels: global, root layout, and main section
- Branded 404 page with MPSTATS Academy branding and navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: SafeMarkdown component + lesson page migration** - `dd33a0e` (feat)
2. **Task 2: Error boundaries and not-found page** - `e23418e` (feat)

## Files Created/Modified
- `apps/web/src/components/shared/SafeMarkdown.tsx` - Safe markdown renderer with rehype-sanitize, remark-gfm, Tailwind-styled components
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Replaced 2x dangerouslySetInnerHTML with SafeMarkdown, removed formatContent
- `apps/web/src/app/error.tsx` - Global error boundary with retry + home navigation
- `apps/web/src/app/global-error.tsx` - Root layout error boundary with self-contained HTML/body
- `apps/web/src/app/not-found.tsx` - Branded 404 page
- `apps/web/src/app/(main)/error.tsx` - Main section error boundary preserving sidebar context

## Decisions Made
- SafeMarkdown uses allowlist approach (only safe tags listed) rather than blocklist — more secure
- not-found.tsx uses inline text logo instead of importing Logo component which is 'use client' — keeps not-found as server component
- global-error.tsx uses inline styles instead of Tailwind — must be self-contained since it catches root layout failures
- TimecodeLink components in sources sections left untouched — they render separately from markdown body

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Prisma EPERM error during typecheck (Windows file locking on query_engine rename) — pre-existing issue, unrelated to changes. Web app typecheck passes clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 05 (Security Hardening) is now complete: Plan 01 (rate limiting + auth) + Plan 02 (sanitization + error boundaries)
- Ready for Phase 07 (Lesson & Course Name Cleanup) or other planned work

## Self-Check: PASSED

- All 6 files exist (SafeMarkdown, 4 error boundaries, SUMMARY)
- Commits dd33a0e and e23418e verified in git log
- No dangerouslySetInnerHTML in lesson page
- TypeScript compilation passes for web app

---
*Phase: 05-security-hardening*
*Completed: 2026-02-25*
