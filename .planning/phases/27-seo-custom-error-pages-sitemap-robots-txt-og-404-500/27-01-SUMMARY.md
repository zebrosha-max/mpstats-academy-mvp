---
phase: 27-seo-custom-error-pages-sitemap-robots-txt-og-404-500
plan: 01
subsystem: seo
tags: [next.js, metadata, opengraph, sitemap, robots, seo, sharp]

requires:
  - phase: 06-production-deploy
    provides: production domain platform.mpstats.academy
provides:
  - Root metadata with title template and OG defaults
  - sitemap.xml with 4 public URLs
  - robots.txt blocking protected routes
  - Default OG image 1200x630 PNG
affects: [landing, social-sharing, search-indexing]

tech-stack:
  added: [sharp (devDependency)]
  patterns: [Next.js Metadata API for SEO, MetadataRoute.Sitemap, MetadataRoute.Robots]

key-files:
  created:
    - apps/web/src/app/sitemap.ts
    - apps/web/src/app/robots.ts
    - apps/web/public/og-default.png
    - scripts/generate-og-image.cjs
  modified:
    - apps/web/src/app/layout.tsx

key-decisions:
  - "Title template '%s | MPSTATS Academy' for consistent page titles across all routes"
  - "metadataBase set to production URL for correct OG image URL resolution"
  - "OG image generated via sharp from SVG template with LogoIcon path data"

patterns-established:
  - "Next.js Metadata API: root layout sets defaults, pages override with template"
  - "OG image generator script at scripts/generate-og-image.cjs for reproducible builds"

requirements-completed: [SEO-01, SEO-02, SEO-03]

duration: 3min
completed: 2026-03-18
---

# Phase 27 Plan 01: SEO Foundation Summary

**Root metadata with OG tags (ru_RU locale), sitemap.xml (4 public URLs), robots.txt (6 protected route blocks), and 1200x630 OG image with mp-blue gradient branding**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T08:53:18Z
- **Completed:** 2026-03-18T08:56:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Root layout metadata with title template, OpenGraph defaults, ru_RU locale, and metadataBase
- sitemap.ts serving 4 public URLs (/, /pricing, /login, /register) with priority and changeFrequency
- robots.ts blocking /dashboard, /learn, /diagnostic, /profile, /admin, /api with sitemap reference
- OG image (58KB PNG) with mp-blue gradient, white MPSTATS logo icon, title and subtitle

## Task Commits

Each task was committed atomically:

1. **Task 1: Root metadata + sitemap + robots** - `d29036c` (feat)
2. **Task 2: Generate default OG image** - `085035e` (feat)

## Files Created/Modified
- `apps/web/src/app/layout.tsx` - Root metadata with title template, OG defaults, metadataBase
- `apps/web/src/app/sitemap.ts` - Static sitemap with 4 public URLs
- `apps/web/src/app/robots.ts` - robots.txt blocking protected routes, referencing sitemap
- `apps/web/public/og-default.png` - Default OG image 1200x630 with mp-blue gradient
- `scripts/generate-og-image.cjs` - Node.js script to regenerate OG image from SVG via sharp

## Decisions Made
- Title template `%s | MPSTATS Academy` for consistent page titles across all routes
- metadataBase set to production URL so relative OG image paths resolve correctly
- OG image generated programmatically via sharp from SVG template embedding LogoIcon path data from Logo.tsx
- sharp installed as devDependency in web workspace (not needed in production)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `next build` fails at standalone symlink step on Windows (EPERM) - pre-existing issue unrelated to changes, compilation and static generation succeed
- sharp ESM import failed from scripts/ directory - switched to CJS require with explicit path to apps/web/node_modules/sharp

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SEO foundation complete, ready for custom error pages (404/500) in next plan
- OG image can be regenerated with `node scripts/generate-og-image.cjs` if branding changes

## Self-Check: PASSED

All 5 files verified present. Both commits (d29036c, 085035e) confirmed in git log.

---
*Phase: 27-seo-custom-error-pages-sitemap-robots-txt-og-404-500*
*Completed: 2026-03-18*
