---
phase: 30-content-discovery-smart-search
verified: 2026-03-18T12:00:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Semantic search returns relevant results in production"
    expected: "Typing a pain query returns top-10 lessons with matching snippets and timecodes"
    why_human: "Requires live Supabase pgvector + real embeddings. Cannot verify result quality programmatically."
  - test: "Timecode deep-link seeks to correct video position"
    expected: "Clicking a snippet timecode link opens the lesson and video plays from that second"
    why_human: "Kinescope iframe postMessage seekTo requires a running browser with the actual player loaded."
  - test: "Track badge 'В вашем треке' appears for path lessons in search results"
    expected: "After completing diagnostic, searching shows badge on lessons that are in the recommended path"
    why_human: "Requires a user with completed diagnostic and an active LearningPath in DB."
  - test: "7-filter panel works in both search mode and courses/track mode"
    expected: "Category, status, topics multi-select, difficulty, duration, course, marketplace filters all narrow results correctly"
    why_human: "Filter interaction and correctness of multi-filter chaining requires visual browser verification."
  - test: "Clearing search returns to courses/track view"
    expected: "Clicking X on search bar or backspacing to empty restores the course accordion view"
    why_human: "State transition on clear requires browser interaction to verify."
---

# Phase 30: Content Discovery — Smart Search Verification Report

**Phase Goal:** Пользователь находит нужный контент через семантический поиск по проблеме/боли и расширенную фильтрацию (топики, сложность, длительность, курс, маркетплейс), результаты показывают релевантные фрагменты с таймкодами, уроки из рекомендованного трека маркируются badge "В вашем треке"
**Verified:** 2026-03-18T12:00:00Z
**Status:** human_needed — all automated checks pass; 5 behaviors require human/browser verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Success Criteria in ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User enters a pain query and receives top-10 relevant lessons with 1-2 fragments and timecodes | VERIFIED | `ai.searchLessons` endpoint: limit 30 chunks, groups to top-2 per lesson, .slice(0,10). `SearchResultCard` renders snippets with `formatTimecode`. |
| 2 | 7 filters (category, status, topics, difficulty, duration, course, marketplace) work in search, courses, and track modes | VERIFIED | `FilterPanel` has all 7 filters. `filteredSearchResults` and `filterLesson()` apply unified `FilterState` in all three branches of the conditional render. |
| 3 | Click on snippet timecode opens lesson at that video position | VERIFIED (automated) / UNCERTAIN (runtime) | `SearchResultCard` produces `href="/learn/{id}?t={timecodeStart}"`. Lesson page reads `window.location.search` param `t`, computes `searchTimecode`, and calls `seekTo` via postMessage. Runtime behavior requires human. |
| 4 | Lessons from recommended path show "В вашем треке" badge in results | VERIFIED (logic) / UNCERTAIN (data) | `searchLessons` queries `LearningPath.findUnique`, builds `recommendedLessonIds` Set, sets `inRecommendedPath`. `SearchResultCard` renders badge when true. Requires active LearningPath to verify badge display. |
| 5 | Clearing search returns to normal courses/track view | VERIFIED | `searchQuery` state drives `{searchQuery.length > 0 ? <SearchResults> : <CoursesOrTrack>}`. `SearchBar.onClear` sets `setSearchQuery('')`. Backspace clears via `onChange`. |

**Score:** 5/5 success criteria verified at code level. 5 items need human/browser confirmation for runtime behavior.

---

## Required Artifacts

### Plan 30-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/routers/ai.ts` | `searchLessons` tRPC endpoint | VERIFIED | Contains `searchLessons: protectedProcedure`, `lessonChunksMap`, `slice(0, 10)`, `inRecommendedPath`, `getUserActiveSubscriptions`, `isLessonAccessible` |
| `packages/api/src/routers/learning.ts` | `getCourses` with topics/skillCategories | VERIFIED | Lines 70-71: `topics: (l.topics as string[] | null) ?? []`, `skillCategories: (l.skillCategories as string[] | null) ?? []` |
| `packages/shared/src/types/index.ts` | `SearchLessonResult` and `SearchSnippet` types | VERIFIED | Lines 212-241: full interfaces exported. `LessonWithProgress` extended with `topics?: string[]` and `skillCategories?: string[]` at lines 108-109 |
| `apps/web/src/lib/trpc/provider.tsx` | `ai.searchLessons` in AI_PROCEDURES | VERIFIED | Line 16: `new Set(['ai.getLessonSummary', 'ai.chat', 'ai.searchChunks', 'ai.searchLessons'])` |

### Plan 30-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/learning/SearchBar.tsx` | Search input with Enter trigger, example queries, clear button | VERIFIED | Contains `role="search"`, `aria-label="Очистить поиск"`, `onKeyDown`, 5 example query strings including "Как снизить рекламные расходы" |
| `apps/web/src/components/learning/FilterPanel.tsx` | 7-filter panel with Popover + CommandInput for topics | VERIFIED | Contains `FilterState` interface, `Popover`, `CommandInput`, "Сбросить все фильтры" reset link |
| `apps/web/src/components/learning/SearchResultCard.tsx` | Result card with snippets, timecodes, badges | VERIFIED | Contains `SearchLessonResult` type, `formatTimecode`, "В вашем треке" badge, "Доступно по подписке" for locked, `?t=` in href |
| `apps/web/src/app/(main)/learn/page.tsx` | Three-mode /learn page with search integration | VERIFIED | Imports `SearchBar`, `FilterPanel`, `SearchResultCard`. Uses `trpc.ai.searchLessons.useQuery`, `searchQuery.length > 0` branching, `filteredSearchResults`, "Ничего не найдено" empty state |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` | Timecode deep-link via ?t= param | VERIFIED | Lines 63-67: reads `window.location.search` param `t`, sets `searchTimecode`. Line 357: `initialTime={hasSearchTimecode ? searchTimecode : watchProgress?.lastPosition}`. PostMessage `seekTo` at line 206. |
| `apps/web/src/components/ui/popover.tsx` | shadcn Popover (Radix) | VERIFIED | File exists, used by FilterPanel |
| `apps/web/src/components/ui/command.tsx` | shadcn Command/cmdk | VERIFIED | File exists, used by FilterPanel |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/app/(main)/learn/page.tsx` | `ai.searchLessons` | `trpc.ai.searchLessons.useQuery` | WIRED | Line 48: `trpc.ai.searchLessons.useQuery({ query: searchQuery }, { enabled: searchQuery.length > 0 })` |
| `apps/web/src/components/learning/SearchResultCard.tsx` | `/learn/{id}?t={seconds}` | `Link href` | WIRED | Line 83: `href={"/learn/" + result.lesson.id + "?t=" + snippet.timecodeStart}` |
| `packages/api/src/routers/ai.ts` | `@mpstats/ai searchChunks` | import and call | WIRED | Line 20 import, line 164 call: `searchChunks({ query, limit: 30, threshold: 0.5 })` |
| `packages/api/src/routers/ai.ts` | `ctx.prisma.lesson.findMany` | Prisma enrichment | WIRED | Lines 187-196: full `findMany` with course and progress includes |
| `packages/ai/src/retrieval.ts` | PostgreSQL via `$queryRawUnsafe` | Prisma raw SQL | WIRED | Switched from Supabase RPC (timed out) to direct SQL at line 76. Returns real vector search results. |

---

## Requirements Coverage

The requirement IDs SEARCH-01 through SEARCH-05 declared in both plans do NOT exist in `.planning/REQUIREMENTS.md`. The file covers AUTH, BILL, PAY, EMAIL, DIAG, ROLE, and SEO requirement families but has no v1.7 or "Content Discovery" section.

This means the SEARCH-* IDs were used as internal task labels within the phase plans only and were never formally added to the REQUIREMENTS.md document.

| Requirement ID | REQUIREMENTS.md Entry | Plan Coverage | Status |
|---------------|-----------------------|---------------|--------|
| SEARCH-01 | NOT IN REQUIREMENTS.md | 30-01 + 30-02: semantic search endpoint + UI | ORPHANED — ID used in plans but absent from requirements document |
| SEARCH-02 | NOT IN REQUIREMENTS.md | 30-01 + 30-02: 7 filters on getCourses data | ORPHANED |
| SEARCH-03 | NOT IN REQUIREMENTS.md | 30-02: timecode deep-link via ?t= param | ORPHANED |
| SEARCH-04 | NOT IN REQUIREMENTS.md | 30-01 + 30-02: inRecommendedPath flag + badge | ORPHANED |
| SEARCH-05 | NOT IN REQUIREMENTS.md | 30-02: clear search returns to browse view | ORPHANED |

**Conclusion:** All 5 SEARCH-* requirements are implemented in the codebase but are absent from REQUIREMENTS.md. The functionality is real — the IDs are simply undocumented in the requirements register. This is a documentation gap, not a code gap.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/ai/src/retrieval.ts` | 76-90 | `$queryRawUnsafe` with string interpolation for embedding vector | Info | The embedding vector and threshold are derived from controlled server-side inputs (OpenAI embedding output is a float array, threshold is a server constant). The `lessonId` filter at line 74 uses string interpolation which could be SQL-injectable if `lessonId` came from user input unchecked — but it only comes from internal lesson IDs in the existing `getChunksForLesson` function, not from `searchChunks`. In `searchLessons` no `lessonId` is passed. Low actual risk, but worth noting. |

No blocker anti-patterns found. No placeholder implementations, TODO stubs, or empty handlers in any phase 30 files.

---

## Human Verification Required

### 1. Semantic Search Quality

**Test:** Open https://platform.mpstats.academy/learn (logged in). Type "как снизить рекламные расходы" and press Enter.
**Expected:** 1-10 lesson cards appear, each with course name, lesson title, difficulty badge, 1-2 snippet paragraphs with clickable timecode links, and topic tags.
**Why human:** Vector similarity quality and result relevance requires real pgvector execution with live embeddings. Cannot assert "results are relevant" via grep.

### 2. Timecode Deep-Link Video Seek

**Test:** From search results, click a timecode link (e.g., "03:45 - 05:12") in a snippet.
**Expected:** Lesson page opens. Kinescope iframe seeks to 3 minutes 45 seconds and video plays from that position.
**Why human:** postMessage `seekTo` to Kinescope iframe requires a running browser with the player loaded. Cannot verify via static code analysis.

### 3. "В вашем треке" Badge in Search Results

**Test:** With a user who has completed diagnostic and has an active LearningPath, search for a topic. Check if lessons in the recommended path show the "В вашем треке" badge.
**Expected:** At least some search results show the blue bordered badge with checkmark.
**Why human:** Requires a specific DB state (completed diagnostic + LearningPath rows) to be present for the test user.

### 4. Filter Interaction in All View Modes

**Test:** In search mode (after query), apply difficulty "Сложный" + course filter. Then clear search and verify filters still apply to course view.
**Expected:** Filters narrow results in both search and browse modes. "Сбросить все фильтры" resets all 7 filters to defaults.
**Why human:** Multi-filter chaining and state persistence across view mode transitions requires interactive browser testing.

### 5. Mobile Responsiveness of Search UI

**Test:** Open /learn on a 375px viewport (iPhone). Verify SearchBar is full-width, FilterPanel wraps into multiple rows, SearchResultCard stacks vertically.
**Expected:** No horizontal scroll, all UI elements accessible on mobile.
**Why human:** Requires visual verification in a browser dev tools or real device.

---

## Deviation from Plan (Notable)

The SUMMARY documents one significant architectural deviation that was auto-fixed during execution:

**Vector search architecture:** Plan 30-01 specified `searchChunks` using the existing Supabase RPC `match_chunks`. During testing (Plan 30-02), the RPC timed out on the Supabase free tier with even the raised 0.5 threshold. The implementation was switched to `prisma.$queryRawUnsafe` (direct TCP to PostgreSQL), bypassing PostgREST entirely. This is documented in commit `34c38d7` and the retrieval.ts file header.

The switch resolves the timeout but introduces `$queryRawUnsafe` with string interpolation. The risk is documented above.

---

## Gaps Summary

No code gaps. All artifacts exist, are substantive, and are wired.

The only gap is a **documentation gap**: SEARCH-01 through SEARCH-05 requirement IDs are not defined in REQUIREMENTS.md. This does not affect functionality but means the requirements register is incomplete for phase 30.

If the requirements document should be kept consistent with all phases, a v1.7 section should be added to REQUIREMENTS.md with SEARCH-01 through SEARCH-05 definitions and a traceability entry mapping them to Phase 30.

---

_Verified: 2026-03-18T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
