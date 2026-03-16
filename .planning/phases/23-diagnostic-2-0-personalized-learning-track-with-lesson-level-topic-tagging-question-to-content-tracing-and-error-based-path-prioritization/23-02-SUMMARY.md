---
phase: 23-diagnostic-2-0
plan: 02
subsystem: api, ai
tags: [trpc, prisma, rag, source-tracing, learning-path, sectioned-path, diagnostic]

# Dependency graph
requires:
  - phase: 23-diagnostic-2-0 plan 01
    provides: Extended schema (sourceData, skillCategories, topics), shared types (SectionedLearningPath, parseLearningPath)
provides:
  - Question generator with source tracing (chunkIds, lessonIds, timecodes)
  - DiagnosticAnswer records with sourceData linking errors to specific lessons
  - generateSectionedPath producing 4-section learning path from skill profile + errors
  - getRecommendedPath handling both old flat and new sectioned formats
affects: [23-03 frontend accordion, 23-04 polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [sectioned-path-generation, source-tracing-flow, backward-compat-path-format]

key-files:
  created: []
  modified:
    - packages/ai/src/question-generator.ts
    - packages/api/src/routers/diagnostic.ts
    - packages/api/src/routers/learning.ts

key-decisions:
  - "Source tracing fields optional on DiagnosticQuestion — mock/FINANCE questions gracefully omit them"
  - "generateSectionedPath with try/catch fallback to flat generateFullRecommendedPath"
  - "getRecommendedPath returns isSectioned flag for frontend format detection"

patterns-established:
  - "Source tracing flow: question-generator -> session.questions Json -> diagnosticAnswer.sourceData -> sectioned path hints"
  - "Backward-compat path format: parseLearningPath detects version, getRecommendedPath returns appropriate shape"
  - "Sectioned path thresholds: < 70 weak, 70-85 mid, > 85 strong"

requirements-completed: [DIAG-04, DIAG-05, DIAG-06]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 23 Plan 02: Question Source Tracing + Sectioned Path Summary

**Question generator enriched with RAG source tracing, diagnostic answers save sourceData, learning path generated as 4-section structure (Errors/Deepening/Growth/Advanced) with pre-computed hints**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T14:49:45Z
- **Completed:** 2026-03-16T14:53:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- fetchRandomChunks now returns timecode_start/timecode_end, toDiagnosticQuestion populates sourceChunkIds, sourceLessonIds, sourceTimecodes
- submitAnswer saves sourceData in DiagnosticAnswer linking wrong answers to specific lessons and timecodes
- generateSectionedPath produces 4-section learning path: Errors (with pre-computed hints), Deepening (score < 70), Growth (70-85), Advanced (> 85 + HARD)
- getRecommendedPath detects format via parseLearningPath and returns sectioned or flat data with isSectioned flag

## Task Commits

Each task was committed atomically:

1. **Task 1: Question generator source tracing** - `7b17337` (feat)
2. **Task 2: Section-based path generation + sourceData in answers** - `098581d` (feat)

## Files Created/Modified
- `packages/ai/src/question-generator.ts` - fetchRandomChunks selects timecodes, toDiagnosticQuestion populates source fields
- `packages/api/src/routers/diagnostic.ts` - sourceData in answer creation, generateSectionedPath with 4-section algorithm
- `packages/api/src/routers/learning.ts` - getRecommendedPath handles both SectionedLearningPath and string[] formats

## Decisions Made
- Source tracing fields are optional on DiagnosticQuestion — mock questions and FINANCE category (no courses) gracefully omit them
- generateSectionedPath wrapped in try/catch with fallback to flat generateFullRecommendedPath for resilience
- getRecommendedPath returns `isSectioned: true/false` flag so frontend can detect format without parsing
- Hints pre-computed at path generation time (no N+1 queries on lesson page)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript `.filter()` widened the section `id` literal type to `string` — fixed by using `as const` on each section id literal and separate typed array variable

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Source tracing flows end-to-end: question generation -> answer storage -> path generation -> path retrieval
- Frontend (Plan 23-03) can now render sectioned accordion with hints, errors section, and section-based progress
- Old flat learning paths from previous diagnostics still render correctly

---
*Phase: 23-diagnostic-2-0*
*Completed: 2026-03-16*
