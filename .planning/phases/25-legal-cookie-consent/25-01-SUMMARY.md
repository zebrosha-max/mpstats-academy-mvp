---
phase: 25-legal-cookie-consent
plan: 01
subsystem: ui
tags: [legal, next.js, static-pages, 152-fz, cookies, privacy-policy, offer]

# Dependency graph
requires: []
provides:
  - "5 legal pages: /legal/offer, /legal/pdn, /legal/adv, /legal/cookies, /policy"
  - "LegalPageLayout shared component for legal document rendering"
  - "Legal links in landing footer and sidebar"
affects: [registration-checkboxes, cookie-consent-banner]

# Tech tracking
tech-stack:
  added: []
  patterns: [LegalPageLayout wrapper for legal document pages with prose-like styling via Tailwind arbitrary variants]

key-files:
  created:
    - apps/web/src/components/legal/LegalPageLayout.tsx
    - apps/web/src/app/legal/layout.tsx
    - apps/web/src/app/legal/offer/page.tsx
    - apps/web/src/app/legal/pdn/page.tsx
    - apps/web/src/app/legal/adv/page.tsx
    - apps/web/src/app/legal/cookies/page.tsx
    - apps/web/src/app/policy/page.tsx
  modified:
    - apps/web/src/app/page.tsx
    - apps/web/src/components/shared/Sidebar.tsx

key-decisions:
  - "Tailwind arbitrary variants instead of @tailwindcss/typography plugin for prose styling"
  - "Static server components for all legal pages (no 'use client')"
  - "Cross-navigation footer in LegalPageLayout linking all 5 legal pages"

patterns-established:
  - "LegalPageLayout: shared wrapper with back-to-home link, logo, title, lastUpdated, prose styling"

requirements-completed: [LEGAL-01, LEGAL-02, LEGAL-05]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 25 Plan 01: Legal Pages Summary

**5 static legal pages (offer from docx, PD consent, advertising, cookies, privacy policy) with shared LegalPageLayout and footer links**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T15:51:09Z
- **Completed:** 2026-03-25T15:59:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Full offer agreement converted from docx to JSX with all 6 sections and company details
- PD consent (152-FZ), advertising consent (38-FZ), cookie policy, privacy policy pages created
- LegalPageLayout with consistent header, back button, logo, prose-like styling, cross-navigation
- Landing footer updated with 5 legal links + separator from support link
- Sidebar footer added "Правовая информация" link with document icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LegalPageLayout + 5 legal pages** - `a42f49c` (feat)
2. **Task 2: Add legal links to landing footer and sidebar** - `a8bb61c` (feat)

## Files Created/Modified
- `apps/web/src/components/legal/LegalPageLayout.tsx` - Shared layout wrapper for all legal pages
- `apps/web/src/app/legal/layout.tsx` - Metadata template for /legal/* routes
- `apps/web/src/app/legal/offer/page.tsx` - Full offer agreement from docx (280+ lines)
- `apps/web/src/app/legal/pdn/page.tsx` - PD consent with 7 sections
- `apps/web/src/app/legal/adv/page.tsx` - Advertising consent with 4 sections
- `apps/web/src/app/legal/cookies/page.tsx` - Cookie policy with usage table
- `apps/web/src/app/policy/page.tsx` - Privacy policy with 10 sections
- `apps/web/src/app/page.tsx` - Landing footer with legal links
- `apps/web/src/components/shared/Sidebar.tsx` - Sidebar footer with legal link

## Decisions Made
- Used Tailwind arbitrary variants (`[&_h2]:text-lg`, etc.) for prose styling instead of installing `@tailwindcss/typography` plugin -- avoids adding a dependency for static text pages
- All legal pages are server components (no `use client`) since they contain only static content
- Added cross-navigation footer at bottom of LegalPageLayout linking all 5 legal pages for easy navigation between documents
- Offer page `lastUpdated` set to "25 марта 2026" matching deployment date

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing Windows EPERM error on symlink creation during Next.js standalone output step (not related to legal pages)
- Pre-existing Git file casing issue: `sidebar.tsx` vs `Sidebar.tsx` (Windows case-insensitive filesystem)
- Both issues are pre-existing and do not affect code functionality

## Known Stubs
None - all pages contain complete legal text content.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Legal pages ready for registration checkboxes (Plan 02) and cookie consent banner (Plan 03)
- All 5 URLs available: /legal/offer, /legal/pdn, /legal/adv, /legal/cookies, /policy

---
*Phase: 25-legal-cookie-consent*
*Completed: 2026-03-25*
