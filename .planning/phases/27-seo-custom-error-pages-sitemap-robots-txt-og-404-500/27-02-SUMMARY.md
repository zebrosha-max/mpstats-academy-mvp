---
phase: 27-seo-custom-error-pages-sitemap-robots-txt-og-404-500
plan: 02
subsystem: ui
tags: [seo, metadata, error-pages, yandex-webmaster, next-metadata]

requires:
  - phase: 27-01
    provides: Root metadata with OG tags, title template, metadataBase
provides:
  - Branded 404/500 error pages with MPSTATS Academy Logo
  - Per-page metadata (auth, main, pricing) via layout files
  - Yandex Webmaster verification meta tag
affects: [seo, landing, auth, pricing]

tech-stack:
  added: []
  patterns: [next-metadata-verification, per-layout-metadata-inheritance]

key-files:
  created:
    - apps/web/src/app/pricing/layout.tsx
  modified:
    - apps/web/src/app/not-found.tsx
    - apps/web/src/app/error.tsx
    - apps/web/src/app/global-error.tsx
    - apps/web/src/app/(main)/error.tsx
    - apps/web/src/app/(auth)/layout.tsx
    - apps/web/src/app/(main)/layout.tsx
    - apps/web/src/app/layout.tsx

key-decisions:
  - "Next.js Metadata API verification.yandex field for Yandex Webmaster (not manual meta tag)"
  - "Main layout has robots noindex/nofollow to block protected pages from indexing"
  - "Pricing layout has custom OG overrides as public-facing page"

patterns-established:
  - "Per-layout metadata: each route group exports Metadata with title that inherits root template"
  - "Error page branding: Logo component on styled errors, inline SVG on global-error (no Tailwind)"

requirements-completed: [SEO-04, SEO-05, SEO-06]

duration: 5min
completed: 2026-03-18
---

# Phase 27 Plan 02: Error Page Branding + Per-page Metadata Summary

**Branded 404/500 pages with MPSTATS Logo, per-route metadata inheritance, Yandex Webmaster verification via Next.js Metadata API**

## Performance

- **Duration:** 5 min (across 2 sessions with checkpoint)
- **Started:** 2026-03-18T08:50:00Z
- **Completed:** 2026-03-18T09:05:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- All 4 error pages (not-found, error, global-error, main/error) branded with MPSTATS Academy Logo
- 404 page links to / (not /dashboard), main/error keeps /dashboard for authenticated users
- Auth pages titled "Avtorizatsiya | MPSTATS Academy", main pages with noindex, pricing with custom OG
- Yandex Webmaster verification meta tag (ca2450fe5fe87a68) added via Next.js verification field

## Task Commits

Each task was committed atomically:

1. **Task 1: Polish error pages with Logo + correct links** - `b7d5d41` (feat)
2. **Task 2: Per-page metadata via layout files** - `406fcca` (feat)
3. **Task 3: Yandex Webmaster verification meta tag** - `5f5af7d` (feat)

## Files Created/Modified
- `apps/web/src/app/not-found.tsx` - Branded 404 with Logo component, link to /
- `apps/web/src/app/error.tsx` - Branded error with Logo component
- `apps/web/src/app/global-error.tsx` - Inline MPSTATS SVG logo (no Tailwind)
- `apps/web/src/app/(main)/error.tsx` - Branded error with Logo, link to /dashboard
- `apps/web/src/app/(auth)/layout.tsx` - Metadata: "Avtorizatsiya | MPSTATS Academy"
- `apps/web/src/app/(main)/layout.tsx` - Metadata: "Lichnyy kabinet" with noindex
- `apps/web/src/app/pricing/layout.tsx` - Metadata: "Tarify i tseny" with OG overrides
- `apps/web/src/app/layout.tsx` - Yandex Webmaster verification.yandex field

## Decisions Made
- Used Next.js Metadata API `verification.yandex` field (renders `<meta name="yandex-verification">` automatically)
- Protected pages (main layout) get `robots: { index: false, follow: false }` to prevent indexing
- Pricing page gets its own OG overrides since it's a public marketing page

## Deviations from Plan

None - plan executed exactly as written. Yandex verification was provided by user at checkpoint.

## Issues Encountered
- Windows symlink EPERM error during `next build` (standalone output mode) - pre-existing Windows issue, verified via `tsc --noEmit` instead

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 27 SEO fully complete (sitemap, robots.txt, OG, metadata, error pages, Yandex verification)
- Ready for Phase 28 (CloudPayments production credentials)

---
*Phase: 27-seo-custom-error-pages-sitemap-robots-txt-og-404-500*
*Completed: 2026-03-18*
