---
phase: 30-content-discovery-smart-search
plan: 02
subsystem: ui
tags: [react, search, filters, shadcn, popover, command, timecode, semantic-search]

requires:
  - phase: 30-content-discovery-smart-search
    provides: "ai.searchLessons tRPC endpoint, SearchLessonResult types, getCourses with topics"
provides:
  - "SearchBar component with example queries and Enter-to-search"
  - "FilterPanel with 7 filters (category, status, topics, difficulty, duration, course, marketplace)"
  - "SearchResultCard with snippets, timecodes, and recommended path badge"
  - "Timecode deep-link on lesson page via ?t= query param"
  - "Three view modes on /learn: search results, courses, track"
affects: []

tech-stack:
  added: ["cmdk (shadcn command)", "@radix-ui/react-popover", "@radix-ui/react-dialog"]
  patterns: ["Client-side filter chaining over server search results", "Timecode deep-link via postMessage seekTo"]

key-files:
  created:
    - apps/web/src/components/learning/SearchBar.tsx
    - apps/web/src/components/learning/FilterPanel.tsx
    - apps/web/src/components/learning/SearchResultCard.tsx
    - apps/web/src/components/ui/popover.tsx
    - apps/web/src/components/ui/command.tsx
  modified:
    - apps/web/src/app/(main)/learn/page.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx
    - packages/api/src/routers/ai.ts
    - packages/ai/src/retrieval.ts

key-decisions:
  - "Switched vector search from Supabase RPC to Prisma raw SQL (RPC timeout on 0.3 threshold)"
  - "Raised vector similarity threshold from 0.3 to 0.5 to reduce noise and avoid timeouts"
  - "Redesigned FilterPanel with labeled sections and hierarchy instead of flat pill row"
  - "Timecode deep-link only applies when ?t= present, preserving saved watch position otherwise"

patterns-established:
  - "FilterPanel with unified FilterState object for 7+ filters"
  - "Conditional search/browse view toggle based on searchQuery state"

requirements-completed: [SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05]

duration: 25min
completed: 2026-03-18
---

# Phase 30 Plan 02: Content Discovery Frontend Summary

**Search bar with 5 example queries, 7-filter panel (category/status/topics/difficulty/duration/course/marketplace), search result cards with snippets and timecodes, and timecode deep-linking on lesson page**

## Performance

- **Duration:** ~25 min (including 9 bugfix iterations post-checkpoint)
- **Started:** 2026-03-18T10:00:00Z
- **Completed:** 2026-03-18T10:25:00Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 14

## Accomplishments
- Full search UI on /learn page: SearchBar with placeholder + 5 example query chips
- FilterPanel with 7 filters (category pills, status pills, topics multi-select via cmdk, difficulty/duration/course dropdowns, WB/OZON marketplace pills)
- SearchResultCard showing course name, lesson title, difficulty badge, topic tags, "В вашем треке" badge, and snippets with clickable timecodes
- Timecode deep-link: clicking snippet opens lesson at exact video position via ?t= param + postMessage seekTo
- Empty state "Ничего не найдено" with popular topic suggestions
- 9 post-implementation bugfixes: type mismatch, vector search timeout, search clear, filter redesign, focus ring removal, timecode/watch-position conflict

## Task Commits

Each task was committed atomically:

1. **Task 1: SearchBar, FilterPanel, SearchResultCard components** - `59c3718` (feat)
2. **Task 2: Integrate search + filters into /learn + timecode deep-link** - `6c94b77` (feat)
3. **Task 3: Human verification** - approved (all 11 items passed)

**Post-implementation bugfixes:**
- `fc82e77` - fix type mismatch in track filter
- `804c66d` - raise vector search threshold 0.3 to 0.5
- `34c38d7` - switch vector search from Supabase RPC to Prisma raw SQL
- `5b4cce8` - fix search clear on backspace
- `08b0272` - redesign FilterPanel + fix WB/OZON marketplace filter
- `84b0d77` - remove blue focus ring from dropdowns
- `f196508` - remove blue focus ring from globals.css override
- `bf21bdb` - remove blue focus ring from CommandInput
- `b979925` - fix timecode deep-link overrides saved watch position

## Files Created/Modified
- `apps/web/src/components/learning/SearchBar.tsx` - Search input with Enter trigger, loading spinner, clear button, 5 example query chips
- `apps/web/src/components/learning/FilterPanel.tsx` - 7-filter panel with labeled sections, pills, dropdowns, topic multi-select
- `apps/web/src/components/learning/SearchResultCard.tsx` - Result card with snippets, timecodes, badges
- `apps/web/src/components/ui/popover.tsx` - shadcn popover (Radix)
- `apps/web/src/components/ui/command.tsx` - shadcn command/cmdk for topic multi-select
- `apps/web/src/app/(main)/learn/page.tsx` - Search/filter/results integration, three view modes
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Timecode deep-link via ?t= param
- `packages/api/src/routers/ai.ts` - Vector search threshold fix
- `packages/ai/src/retrieval.ts` - Switch from Supabase RPC to Prisma raw SQL
- `apps/web/src/styles/globals.css` - Focus ring override removal

## Decisions Made
- Switched vector search from Supabase RPC (`match_chunks`) to Prisma `$queryRaw` -- RPC was timing out at similarity threshold 0.3
- Raised similarity threshold to 0.5 to reduce noise and improve performance
- Redesigned FilterPanel from flat pills to labeled hierarchical sections (better UX for 7 filters)
- Timecode deep-link checks for `?t=` param presence and only overrides watch position when explicitly linked from search

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type mismatch in track filter**
- **Found during:** Task 2 integration
- **Issue:** `LessonWithProgress` type didn't match `filterLesson` expectations for track view
- **Fix:** Adjusted type casting in filter function
- **Files modified:** apps/web/src/app/(main)/learn/page.tsx
- **Committed in:** fc82e77

**2. [Rule 1 - Bug] Vector search timeout on Supabase RPC**
- **Found during:** Testing search functionality
- **Issue:** Supabase RPC `match_chunks` timed out with similarity threshold 0.3 (too many results)
- **Fix:** Raised threshold to 0.5, then switched from Supabase RPC to Prisma `$queryRaw` for direct SQL
- **Files modified:** packages/ai/src/retrieval.ts, packages/api/src/routers/ai.ts
- **Committed in:** 804c66d, 34c38d7

**3. [Rule 1 - Bug] Search not clearing on backspace**
- **Found during:** Testing search UX
- **Issue:** Clearing search input via backspace didn't reset search state
- **Fix:** Added onChange handler to detect empty input and call onClear
- **Files modified:** apps/web/src/components/learning/SearchBar.tsx
- **Committed in:** 5b4cce8

**4. [Rule 1 - Bug] WB/OZON marketplace filter not working**
- **Found during:** Testing filters
- **Issue:** Marketplace filter logic wasn't matching lesson topics correctly
- **Fix:** Redesigned FilterPanel with proper marketplace keyword matching + hierarchical layout
- **Files modified:** apps/web/src/components/learning/FilterPanel.tsx
- **Committed in:** 08b0272

**5. [Rule 1 - Bug] Blue focus ring on dropdowns and CommandInput**
- **Found during:** Visual testing
- **Issue:** Default browser focus ring showed blue outline on filter controls
- **Fix:** Removed focus ring via component-level className overrides
- **Files modified:** FilterPanel.tsx, globals.css, command.tsx
- **Committed in:** 84b0d77, f196508, bf21bdb

**6. [Rule 1 - Bug] Timecode deep-link overrides saved watch position**
- **Found during:** Testing timecode navigation
- **Issue:** Opening lesson without ?t= param was seeking to 0 instead of saved position
- **Fix:** Conditional seek only when ?t= param is present
- **Files modified:** apps/web/src/app/(main)/learn/[id]/page.tsx
- **Committed in:** b979925

---

**Total deviations:** 6 auto-fixed (all bugs)
**Impact on plan:** All fixes were necessary for correct UX. Vector search architecture improved (RPC -> raw SQL). No scope creep.

## Issues Encountered
- Supabase RPC `match_chunks` function timed out with low similarity threshold (0.3) -- switched to Prisma raw SQL for better control and performance
- cmdk/shadcn command component has aggressive focus ring styling requiring multiple override points

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 30 (Content Discovery) fully complete -- both backend and frontend shipped
- Search, filters, and timecode linking verified by human across 11 test cases
- Ready for next phase in roadmap

## Self-Check: PASSED

- All 7 key files: FOUND
- All 11 commits: FOUND

---
*Phase: 30-content-discovery-smart-search*
*Completed: 2026-03-18*
