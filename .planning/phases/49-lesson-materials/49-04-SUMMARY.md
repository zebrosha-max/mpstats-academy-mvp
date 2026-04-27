---
phase: 49-lesson-materials
plan: 04
subsystem: frontend
tags: [ui, lesson-page, materials, metrika, intersection-observer]

requires:
  - phase: 49-02
    provides: "learning.getLesson returns materials[]; material.getSignedUrl protectedProcedure"
  - phase: 49-03
    provides: "62 materials + 97 attachments populated in production DB"
provides:
  - "LessonMaterials section component (Intersection Observer + grid wrapper)"
  - "MaterialCard component (5 type configs: icon + accent, lazy signed URL fetch)"
  - "MATERIAL_OPEN, MATERIAL_SECTION_VIEW Metrika goals wired"
  - "Section rendered between CollapsibleSummary and Lesson info on /learn/[id]"
affects: [49-05-admin-panel, 49-06-polish-deploy]

tech-stack:
  added:
    - "lucide-react icons (FileText, Table, ExternalLink, ListChecks, StickyNote, Loader2) — already in apps/web deps, no new install"
  patterns:
    - "Lazy tRPC query via utils.material.getSignedUrl.fetch on click — defers signed-URL request until user actually clicks (TTL 3600s burns immediately on fetch)"
    - "IntersectionObserver one-shot pattern with sentRef guard — fires Metrika goal only once per page lifecycle"
    - "Type-config record (TYPE_CONFIG) with Icon + accent + label — mirrors LibrarySection AXIS_STYLES pattern"

key-files:
  created:
    - "apps/web/src/components/learning/MaterialCard.tsx (111 lines)"
    - "apps/web/src/components/learning/LessonMaterials.tsx (99 lines)"
    - ".planning/phases/49-lesson-materials/49-04-SUMMARY.md"
  modified:
    - "apps/web/src/lib/analytics/constants.ts (+3: 2 new goals + comment)"
    - "apps/web/src/app/(main)/learn/[id]/page.tsx (+6: import + JSX block)"

key-decisions:
  - "[49-04] utils.material.getSignedUrl.fetch (NOT .query) — plan said .query but createTRPCReact useUtils API exposes .fetch / .invalidate; treated as plan-text typo, fixed inline"
  - "[49-04] data-tour='lesson-materials' attribute added to section — preserves the project pattern (other sections have data-tour for the onboarding tour); no actual tour step yet, but attribute future-proofs"
  - "[49-04] Single insertion point handles both desktop and mobile — the left column is shared between viewports; no mobile-specific dup needed (D-26 actually splits desktop vs mobile placement, but in current page architecture both viewports share the same content column above MobileChatCommentsTabs, so one insertion satisfies both)"
  - "[49-04] disabled = loading || (!externalUrl && !hasFile) — defensive guard for future material types without source; current ingest guarantees XOR, but UI should not render an unclickable button"
  - "[49-04] window.open(signedUrl, '_blank', 'noopener,noreferrer') — same as externalUrl path; consistent UX 'материал открывается в новой вкладке'. Browser handles download disposition based on Storage Content-Disposition header"
  - "[49-04] sentRef.current guard inside observer callback (not just dep) — protects against double-fire if React re-runs the effect before disconnect"

patterns-established:
  - "Lesson-page-section ladder: CollapsibleSummary → LessonMaterials → (Mobile)Chat+Comments → Navigation. Adding new sections in between follows this contract."
  - "Metrika goal pair (interaction + impression): MATERIAL_OPEN on click, MATERIAL_SECTION_VIEW on viewport. Reusable for future sections that need conversion-rate analysis."
  - "Type-config dictionary at module-top with const assertion — keeps render branch flat (no switch/if-chain inside JSX)."

requirements-completed:
  - "Phase 49 D-25 (external URL bypasses getSignedUrl, opens directly in new tab)"
  - "Phase 49 D-26 (section between CollapsibleSummary and Lesson info — line 682 vs CollapsibleSummary close at 676 vs MobileChatCommentsTabs at 709)"
  - "Phase 49 D-27 (LessonMaterials component at apps/web/src/components/learning/LessonMaterials.tsx)"
  - "Phase 49 D-28 (5 type configs: PRESENTATION blue / CALCULATION_TABLE purple / EXTERNAL_SERVICE orange / CHECKLIST green / MEMO gray; lucide icons; CTA button)"
  - "Phase 49 D-29 (empty state — no render, hard short-circuit before any DOM)"
  - "Phase 49 D-30 (grid grid-cols-1 sm:grid-cols-2 gap-3)"
  - "Phase 49 D-31 (no skeleton — materials part of getLesson payload)"
  - "Phase 49 D-41 (MATERIAL_OPEN with materialId/materialType/lessonId; MATERIAL_SECTION_VIEW with lessonId/count)"

duration: 8 min
completed: 2026-04-27
---

# Phase 49 Plan 04: Lesson Materials UI Section Summary

**Видимая клиентам ценность фазы 49 готова: на странице урока с привязанными материалами появляется секция «Материалы к уроку» с карточками по типу, кнопками-CTA и аналитикой через Yandex Metrika.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3 (all auto, all green first try)
- **Files:** 2 created, 2 modified
- **LoC added:** ~219 (3 constants + 111 MaterialCard + 99 LessonMaterials + 6 page integration)

## Accomplishments

### Section structure on `/learn/[id]`

```
Breadcrumb
Header (badge + title + description)
[locked? LockOverlay : hasDiagnostic? Content : DiagnosticGateBanner]
  Left column (lg:col-span-2):
    Video player
    [Diagnostic hint?]
    [PaywallBanner?]
    CollapsibleSummary («Ключевые тезисы»)
    ▶ LessonMaterials («Материалы к уроку»)  ← NEW
    Lesson info (duration + status badge)
    MobileChatCommentsTabs (mobile only)
    Navigation (Prev / Complete / Next)
  Right column (desktop):
    AI-Chat
    CommentSection
```

### MaterialCard — type → visual mapping

| Type | Icon (lucide) | Accent class |
|------|---------------|--------------|
| `PRESENTATION` | FileText | blue-50/blue-700/blue-200 |
| `CALCULATION_TABLE` | Table | purple-50/purple-700/purple-200 |
| `EXTERNAL_SERVICE` | ExternalLink | orange-50/orange-700/orange-200 |
| `CHECKLIST` | ListChecks | green-50/green-700/green-200 |
| `MEMO` | StickyNote | gray-50/gray-700/gray-200 |

Card layout: icon-tile (2-padding rounded border) + type label (xs gray) + bold title; optional 2-line description; full-width outline CTA button at bottom (`mt-auto`). Uses existing `Card`/`CardContent`/`Button` shadcn primitives + `shadow-mp-card` token from project design system.

### Click flow

```
User clicks "Скачать таблицу" on MaterialCard
  ↓ reachGoal(MATERIAL_OPEN, { materialId, materialType, lessonId })
  ↓
  ├─ has externalUrl? → window.open(externalUrl, '_blank', 'noopener,noreferrer')
  └─ has file? → setLoading(true)
                 → utils.material.getSignedUrl.fetch({ materialId })
                 → window.open(signedUrl, '_blank', 'noopener,noreferrer')
                 → toast.error on FORBIDDEN/NOT_FOUND/other
                 → setLoading(false) finally
```

### Intersection Observer (MATERIAL_SECTION_VIEW)

- Threshold 0.4 (40% of section visible)
- One-shot via `sentRef.current` guard + `observer.disconnect()`
- Skipped if SSR (`typeof IntersectionObserver === 'undefined'` early-return)
- Skipped if `materials.length === 0` (component returns null before observer setup)
- Re-fires only on real navigation (component remount changes ref)

### Locked-lesson behavior (D-37 verification)

Backend (Phase 49-02) returns `materials: []` for locked lessons — verified earlier. Frontend has belt-and-suspenders defence:
1. `apps/web/src/app/(main)/learn/[id]/page.tsx:681` — `data?.materials &&` guards against undefined.
2. `LessonMaterials.tsx:57` — `if (materials.length === 0) return null;` short-circuits before any DOM/observer setup.

So locked lessons:
- Don't render `<section>` at all
- Don't fire MATERIAL_SECTION_VIEW
- Don't expose material titles in the HTML stream

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1: Analytics goals | `c211d6e` | `feat(49-04): add MATERIAL_OPEN and MATERIAL_SECTION_VIEW Metrika goals` |
| 2: Components | `05a3c9a` | `feat(49-04): add MaterialCard and LessonMaterials components` |
| 3: Page integration | `096a5e9` | `feat(49-04): render LessonMaterials section on lesson page` |

## Decisions Made

- **`utils.material.getSignedUrl.fetch` instead of `.query`.** Plan said `.query()` but `createTRPCReact` `useUtils()` exposes `.fetch` / `.invalidate` (no `.query`). Treated as plan-text typo — used the real API. Documented inline.
- **Single insertion point for desktop+mobile.** Plan D-26 originally split by viewport (mobile above `MobileChatCommentsTabs`, desktop between summary and navigation). In the current page architecture the left content column is shared between viewports — both viewports flow through the same JSX above `MobileChatCommentsTabs`. One insertion satisfies both. Mobile users see the section above the tabs and navigation; desktop users see it below summary and above the lesson-info row. No layout split needed.
- **`disabled` guard on CTA button.** `loading || (!externalUrl && !hasFile)` — defensive against future material types or data shape changes. Current XOR enforcement at backend prevents both being null, but UI should never render an enabled button with no action.
- **`data-tour="lesson-materials"` attribute.** Preserves project pattern for future onboarding tour additions. No tour step exists yet but the hook is in place.
- **`shadow-mp-card` reuse.** Same elevation as Card-wrapped sections elsewhere on the lesson page (`Card data-tour="lesson-video"`, `Card data-tour="lesson-chat"`). Visual consistency over uniqueness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan used `utils.client.material.getSignedUrl.query`**
- **Found during:** Task 2 (writing MaterialCard)
- **Issue:** `utils.client.X.query()` is from vanilla tRPC client; `createTRPCReact` exposes only `.fetch` / `.invalidate` / `.cancel` / etc. Using the planned API would give a runtime error (`is not a function`).
- **Fix:** Replaced with `utils.material.getSignedUrl.fetch({ materialId: id })`. Same semantics — one-shot imperative fetch outside of useQuery.
- **Files modified:** `apps/web/src/components/learning/MaterialCard.tsx`
- **Commit:** Included in `05a3c9a`

**2. [Rule 2 — Defensive] Added `disabled = loading || (!externalUrl && !hasFile)` to CTA**
- **Found during:** Task 2
- **Issue:** Plan only disabled on `loading`. If a material somehow has neither URL nor file (XOR violation, data corruption), button would render clickable with no-op handler.
- **Fix:** Disable when neither source present.
- **Files modified:** `apps/web/src/components/learning/MaterialCard.tsx`
- **Commit:** Included in `05a3c9a`

**3. [Rule 2 — Defensive] SSR guard in IntersectionObserver effect**
- **Found during:** Task 2
- **Issue:** `IntersectionObserver` is undefined on server but Next.js doesn't run effects on server, so this is a Jest-DOM/older-browser edge case. Added `typeof IntersectionObserver === 'undefined'` early-return for safety.
- **Fix:** One-line guard before observer setup.
- **Files modified:** `apps/web/src/components/learning/LessonMaterials.tsx`
- **Commit:** Included in `05a3c9a`

### Plan-text discrepancies (not deviations, ok)

- Plan referenced `packages/shared/src/types.ts` — actual path is `packages/shared/src/types/index.ts` (already noted in 49-02 SUMMARY).
- Plan import `import { trpc } from '@/lib/trpc/client'` is correct; matches actual file at `apps/web/src/lib/trpc/client.ts`.

## Issues Encountered

- **None blocking.** Typecheck and build both clean on first try after components written. The `.query` → `.fetch` substitution caught at write-time, not at typecheck (TS would have flagged `Property 'query' does not exist on type ...`), so deviation found early.

## User Setup Required

None — pure frontend work. All env vars and external services already configured.

**Smoke test path on dev:**
1. `pnpm dev`
2. Log in as user with active subscription (or admin bypass)
3. Open any lesson with attached material — e.g. `/learn/<lesson-with-presentation>`
4. Verify section «Материалы к уроку» appears between summary and navigation
5. Click CTA on a card with `externalUrl` → opens Google Drive / external in new tab, no API request
6. Click CTA on a card with `hasFile=true` → tRPC `material.getSignedUrl` fires → signed URL opens in new tab
7. Open a locked lesson (e.g. order > 2 without subscription) → section absent from DOM (devtools search for `data-testid="lesson-materials"` returns 0)
8. Yandex Metrika Webvisor / log: confirm `MATERIAL_SECTION_VIEW` fires on view, `MATERIAL_OPEN` on click

## Next Phase Readiness

- **Wave 5 (49-05 admin panel)** — unblocked. Backend ready since 49-02; UI patterns from this wave (TYPE_CONFIG, lucide icon mapping) can be reused in admin material list / preview.
- **Wave 6 (49-06 polish + deploy)** — partially unblocked. E2E tests can be written against the `data-testid="lesson-materials"` and `data-testid="material-cta-{id}"` selectors added here.
- **Blockers:** none.
- **Concerns:** none on UI side. Production deploy of this wave needs all 3 commits (`c211d6e`, `05a3c9a`, `096a5e9`) + Wave 5 admin (when ready) before VPS rebuild.

## Verification (final)

- `pnpm --filter @mpstats/web typecheck` → exit 0
- `pnpm --filter @mpstats/web build` → success (no new warnings, route table clean)
- `wc -l apps/web/src/components/learning/MaterialCard.tsx` → 111 (≥80 required)
- `wc -l apps/web/src/components/learning/LessonMaterials.tsx` → 99 (≥60 required)
- `grep -c "MATERIAL_OPEN" apps/web/src/components/learning/MaterialCard.tsx` → 1
- `grep -c "MATERIAL_SECTION_VIEW" apps/web/src/components/learning/LessonMaterials.tsx` → 2
- `grep -c "IntersectionObserver" apps/web/src/components/learning/LessonMaterials.tsx` → 2
- `grep -c "if (materials.length === 0) return null" apps/web/src/components/learning/LessonMaterials.tsx` → 1
- `grep -c "material.getSignedUrl" apps/web/src/components/learning/MaterialCard.tsx` → 1
- `grep -c "import { LessonMaterials }" "apps/web/src/app/(main)/learn/[id]/page.tsx"` → 1
- `grep -c "<LessonMaterials" "apps/web/src/app/(main)/learn/[id]/page.tsx"` → 1
- Insertion check: LessonMaterials at line 682, after CollapsibleSummary close at 676, before MobileChatCommentsTabs at 709 ✓

## Self-Check: PASSED

- File checks:
  - `apps/web/src/components/learning/MaterialCard.tsx` → FOUND (111 lines)
  - `apps/web/src/components/learning/LessonMaterials.tsx` → FOUND (99 lines)
  - `apps/web/src/lib/analytics/constants.ts` → modified (2 goals added)
  - `apps/web/src/app/(main)/learn/[id]/page.tsx` → modified (import + JSX)
- Commit checks:
  - `c211d6e` → FOUND (Task 1)
  - `05a3c9a` → FOUND (Task 2)
  - `096a5e9` → FOUND (Task 3)
- Acceptance criteria:
  - All `<acceptance_criteria>` from plan met (verification block above)
  - typecheck + build green
  - section renders below summary and above navigation
  - locked lesson defensively short-circuits before DOM

---
*Phase: 49-lesson-materials*
*Completed: 2026-04-27*
