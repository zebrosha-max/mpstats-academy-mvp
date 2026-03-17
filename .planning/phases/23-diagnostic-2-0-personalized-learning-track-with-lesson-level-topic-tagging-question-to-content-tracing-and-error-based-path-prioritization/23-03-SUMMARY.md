---
phase: 23-diagnostic-2-0
plan: 03
subsystem: ui
tags: [recharts, radar-chart, accordion, timecodes, kinescope, react]

requires:
  - phase: 23-02
    provides: getRecommendedPath with isSectioned flag + sections array + hints with timecodes
provides:
  - Dual Radar Chart (before/after comparison) on diagnostic results page
  - 4-section accordion track view on learn page (Errors/Deepening/Growth/Advanced)
  - DiagnosticHint component with clickable timecodes on lesson pages
affects: [diagnostic, learning, lesson-page]

tech-stack:
  added: []
  patterns:
    - "Accordion sections with expand/collapse state via Set<string>"
    - "localStorage-based permanent dismissal for UI hints"
    - "Dual Radar overlay with dashed previous + solid current polygons"

key-files:
  created:
    - apps/web/src/components/diagnostic/DiagnosticHint.tsx
  modified:
    - apps/web/src/components/charts/RadarChart.tsx
    - apps/web/src/app/(main)/diagnostic/results/page.tsx
    - apps/web/src/app/(main)/learn/page.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx
    - packages/api/src/routers/diagnostic.ts

key-decisions:
  - "Errors section open by default, other sections collapsed"
  - "Hints dismissed permanently via localStorage key per lesson"
  - "Previous session fetched from getHistory[1] for dual radar comparison"

patterns-established:
  - "SECTION_STYLES mapping for section-specific colors/icons/badges"
  - "postMessage seekTo for Kinescope iframe from external components"

requirements-completed: [DIAG-07, DIAG-08, DIAG-09]

duration: 5min
completed: 2026-03-17
---

# Phase 23 Plan 03: Frontend UI Summary

**Accordion-based 4-section track view, diagnostic hint banners with clickable timecodes, and dual Radar Chart for before/after skill comparison**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T08:00:00Z
- **Completed:** 2026-03-17T08:05:00Z
- **Tasks:** 3 (+ 1 human-verify checkpoint, approved)
- **Files modified:** 6

## Accomplishments

- Dual Radar Chart shows dashed "before" polygon overlaid with solid "after" polygon on repeat diagnostics, with delta tooltip (+/- %)
- Learn page "My Track" view renders 4 collapsible accordion sections (Errors, Deepening, Growth, Advanced) with per-section colors, icons, and completion counts
- DiagnosticHint component displays between video player and AI tabs on lesson pages from the Errors section, with clickable timecodes that seek the Kinescope player
- All features degrade gracefully: old flat paths show flat list, single diagnostic shows single radar, no hints = no component

## Task Commits

Each task was committed atomically:

1. **Task 1: Dual Radar Chart + results page update** - `222c020` (feat)
2. **Task 2: Accordion track sections on learn page** - `81828d3` (feat)
3. **Task 3: Diagnostic hint component on lesson page** - `dcfd9a7` (feat)

Additional fix commit: `c383be0` - fix(23): include all strong-category lessons in Advanced section

## Files Created/Modified

- `apps/web/src/components/charts/RadarChart.tsx` - Extended with previousData prop, dual Radar polygons, Legend, delta tooltip
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` - Fetches previous session from history, passes previousData to RadarChart
- `apps/web/src/app/(main)/learn/page.tsx` - Accordion sections with SECTION_STYLES, expand/collapse, re-diagnostic CTA
- `apps/web/src/components/diagnostic/DiagnosticHint.tsx` - New dismissible hint with timecode seek buttons
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Integrates DiagnosticHint between video and tabs
- `packages/api/src/routers/diagnostic.ts` - Minor fix for Advanced section lesson inclusion

## Decisions Made

- Errors section open by default in accordion, other sections collapsed -- prioritizes error remediation
- Hints dismissed permanently via localStorage (`hint-dismissed-{lessonId}`) -- avoids annoying returning users
- Previous session for dual radar fetched from diagnostic history index [1] (second-to-last)
- postMessage used for Kinescope iframe seekTo from DiagnosticHint -- same pattern as existing TimecodeLink

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Advanced section missing strong-category lessons**
- **Found during:** Task 2 (accordion sections)
- **Issue:** Advanced section did not include lessons where the user's strong categories matched
- **Fix:** Updated section generation to include all strong-category lessons in Advanced
- **Files modified:** packages/api/src/routers/diagnostic.ts
- **Committed in:** `c383be0`

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential correctness fix for section content. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 3 plans of Phase 23 (Diagnostic 2.0) are now complete
- Phase 22 (Email Notifications) remains paused waiting for CQ credentials
- Production deploy of Phase 23 changes pending

## Self-Check: PASSED

All 5 created/modified files verified on disk. All 4 commit hashes (222c020, 81828d3, dcfd9a7, c383be0) verified in git log.

---
*Phase: 23-diagnostic-2-0*
*Completed: 2026-03-17*
