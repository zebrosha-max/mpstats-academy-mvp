---
phase: 11-summary-sources-ux
plan: 01
subsystem: ui
tags: [react, markdown, tooltip, collapsible, kinescope, seekTo, ux]

# Dependency graph
requires:
  - phase: 03-video-integration
    provides: KinescopePlayer with seekTo API
  - phase: 02-ai-question-gen
    provides: AI summary with sources and timecodes
provides:
  - CollapsibleSummary component with gradient fade expand/collapse
  - SourceTooltip component for interactive [N] citation badges
  - SafeMarkdown with source-aware rendering via React Context
  - Lesson page with summary under video and chat-only sidebar
affects: [12-lazy-video, 14-diagnostic-v2]

# Tech tracking
tech-stack:
  added: []
  patterns: [React Context for passing source data into markdown tree, ResizeObserver for content height measurement]

key-files:
  created:
    - apps/web/src/components/learning/SourceTooltip.tsx
    - apps/web/src/components/learning/CollapsibleSummary.tsx
  modified:
    - apps/web/src/components/shared/SafeMarkdown.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx

key-decisions:
  - "SourceContext + SourceAwareWrapper pattern to inject tooltips deep into markdown tree without prop drilling"
  - "Summary always loads on lesson page (removed tab gating)"
  - "Chat messages also get interactive source badges for consistency"

patterns-established:
  - "React Context for cross-cutting concerns in markdown rendering"
  - "CollapsibleSummary with ResizeObserver for auto-detecting need for collapse"

requirements-completed: [UX-01, UX-02, UX-03, UX-04]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 11 Plan 01: Summary & Sources UX Summary

**Collapsible summary under video with interactive [N] superscript badges, hover tooltips with source preview, and seekTo on click via SourceContext pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T07:28:24Z
- **Completed:** 2026-02-27T07:31:50Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Summary moved from narrow sidebar to full-width area under video with CollapsibleSummary (gradient fade, expand/collapse)
- [N] references in markdown text rendered as interactive superscript badges via SourceContext pattern
- Hover tooltips with 200ms delay showing source snippet and timecode; click seeks video
- Sidebar simplified to chat-only (tab switcher removed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SourceTooltip and CollapsibleSummary components** - `ae97fd5` (feat)
2. **Task 2: Update SafeMarkdown to render [N] as interactive SourceTooltip badges** - `18c6f0b` (feat)
3. **Task 3: Restructure lesson page — summary under video, sidebar chat-only** - `575ba18` (feat)

## Files Created/Modified
- `apps/web/src/components/learning/SourceTooltip.tsx` - Superscript badge with delayed hover tooltip and seekTo on click
- `apps/web/src/components/learning/CollapsibleSummary.tsx` - Collapsible container with gradient fade, ResizeObserver height detection
- `apps/web/src/components/shared/SafeMarkdown.tsx` - Added SourceContext, processTextWithSources, SourceAwareWrapper for [N] badge rendering
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Summary under video, footnotes block, chat-only sidebar

## Decisions Made
- Used React Context (SourceContext) to pass sources/onSeek deep into markdown component tree without prop drilling through every element
- Summary query no longer gated by activeTab — always loads when lesson loads
- Chat messages also get interactive source badges (consistency with summary)
- Tooltip positions above badge by default, flips below when not enough viewport space

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Summary UX complete, ready for any phase that builds on lesson page
- CollapsibleSummary and SourceTooltip are reusable for other contexts

---
*Phase: 11-summary-sources-ux*
*Completed: 2026-02-27*
