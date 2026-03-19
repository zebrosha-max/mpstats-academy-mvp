# Phase 32: Custom Track Management - Research

**Researched:** 2026-03-19
**Domain:** Learning path CRUD operations, tRPC mutations, React optimistic UI
**Confidence:** HIGH

## Summary

Phase 32 adds manual track management: users can add/remove lessons from their learning path, with a dedicated "Moi uroki" (custom) section. The existing codebase already has all the infrastructure needed -- `LearningPath.lessons` stores a JSON `SectionedLearningPath`, tRPC learning router handles path CRUD, and the frontend renders sectioned accordion UI. The core work is: (1) extend the `SectionedLearningPath` type to support a `custom` section, (2) add 3 tRPC mutations (addToTrack, removeFromTrack, rebuildTrack), (3) add toggle button to `LessonCard` and remove button to track view.

No new libraries are needed. Everything builds on existing Prisma, tRPC, shadcn/ui, and sonner infrastructure.

**Primary recommendation:** Extend the existing `SectionedLearningPath` JSON format with a `custom` section ID, add tRPC mutations that read-modify-write the JSON field, and add UI toggle buttons to LessonCard.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Button "+" on LessonCard in "Vse kursy" mode -- toggle: "+" (not in track) / "check" (in track)
- Added lessons go into separate section "Moi uroki" (not into AI sections)
- If user has no track (no diagnostic), first add creates LearningPath with only "Moi uroki" section
- After diagnostic, AI sections appear alongside "Moi uroki" which is preserved
- Feedback: toast "Dobavleno v trek" (sonner) + icon change to checkmark
- Locked (paid) lessons can be added to track -- paywall shown on open
- "Ubrat" button appears ONLY in "Moi trek" mode (not in "Vse kursy")
- Can remove from any section (AI or custom)
- In "Vse kursy" the check->+ toggle does NOT work as remove (add-only)
- Toast "Ubrano iz treka" on remove
- "Perestroit trek" button regenerates AI sections from last diagnostic
- "Moi uroki" preserved on rebuild
- Manually removed AI lessons may return after rebuild
- Confirmation dialog: "Perestroit AI-trek? Udalennye vruchnuyu uroki mogut vernutsya. Moi uroki sokhranyatsya."
- "Moi uroki" section displayed ABOVE AI sections (errors -> deepening -> growth -> advanced)
- Order within "Moi uroki" -- by date added (newest at end)
- No drag-and-drop, fixed order
- No custom sections -- only "Moi uroki" + 4 AI sections
- No limit on lessons in "Moi uroki" (max 405 = entire library)
- No duplicates: lesson cannot be in both "Moi uroki" and AI section -- if manually added, stays only in "Moi uroki"

### Claude's Discretion
- Style of "+" / "check" icon on card (size, position, hover state)
- Animation for add/remove
- Storage format for "Moi uroki" in JSON (extending SectionedLearningPath)
- Optimistic updates vs server mutations

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tRPC 11.x | existing | Mutations for add/remove/rebuild | Already powers all API |
| Prisma 5.x | existing | LearningPath.lessons JSON read-modify-write | ORM in use |
| sonner | existing | Toast notifications | Already used in pricing/profile |
| shadcn/ui AlertDialog | existing | Rebuild confirmation dialog | Already in component library |
| lucide-react | existing | Plus/Check/Trash2 icons | Already used throughout |

### No New Dependencies
No `npm install` needed. All required libraries are already in the project.

## Architecture Patterns

### Data Model: Extending SectionedLearningPath

The `LearningPath.lessons` JSON field currently stores either:
- Old format: `string[]` (flat list of lesson IDs)
- New format: `SectionedLearningPath { version: 2, sections: LearningPathSection[] }`

**Extension:** Add `custom` as a valid section ID alongside `errors | deepening | growth | advanced`.

```typescript
// packages/shared/src/types/index.ts
export interface LearningPathSection {
  id: 'errors' | 'deepening' | 'growth' | 'advanced' | 'custom';  // ADD 'custom'
  title: string;
  description: string;
  lessonIds: string[];
  addedAt?: Record<string, string>;  // lessonId -> ISO date (for custom section ordering)
  hints?: Array<{...}>;
}
```

**Key insight:** The `custom` section has `addedAt` timestamps for ordering (newest at end), while AI sections use lesson order. This is a single optional field on the section, not a schema change.

### Mutation Pattern: Read-Modify-Write JSON

All three mutations follow the same pattern since `lessons` is a JSON field:

```typescript
// 1. Read current LearningPath
const path = await prisma.learningPath.findUnique({ where: { userId } });

// 2. Parse JSON
const parsed = parseLearningPath(path?.lessons);

// 3. Modify sections
// ... add/remove lesson from sections ...

// 4. Write back
await prisma.learningPath.update({
  where: { id: path.id },
  data: { lessons: newSections as any },
});
```

**No Prisma schema migration needed** -- `lessons` is already `Json` type.

### New tRPC Mutations

Three mutations in `learning.ts` router:

1. **`addToTrack`** -- input: `{ lessonId: string }`
   - If no LearningPath exists, create one with `custom` section only
   - If path exists (sectioned), remove lessonId from any AI section, add to `custom` section
   - If path exists (flat/old format), convert to sectioned with custom section
   - Return updated section data

2. **`removeFromTrack`** -- input: `{ lessonId: string }`
   - Remove lessonId from any section (custom or AI)
   - If custom section becomes empty and no AI sections, keep path (don't delete)
   - Return updated section data

3. **`rebuildTrack`** -- no input
   - Requires completed diagnostic (check last session)
   - Re-run `generateSectionedPath` with latest skill profile
   - Preserve `custom` section from current path
   - Exclude custom lesson IDs from `usedLessonIds` in generateSectionedPath
   - Write new sections + preserved custom section

### Frontend Changes

**LessonCard.tsx** -- add optional `onToggleTrack` prop:
```typescript
interface LessonCardProps {
  lesson: LessonWithProgress;
  // ... existing props
  inTrack?: boolean;           // Is this lesson in user's track?
  onToggleTrack?: () => void;  // Click handler for +/check button
}
```

The toggle button renders conditionally based on context (courses view vs track view).

**learn/page.tsx** changes:
- "Vse kursy" mode: LessonCard gets `inTrack` + `onToggleTrack` (add only)
- "Moi trek" mode: each lesson gets "Ubrat" button
- New "Perestroit trek" button in track header
- New `custom` section style in `SECTION_STYLES`
- "Moi uroki" section rendered FIRST (before errors)

### Optimistic Updates vs Server-First

**Recommendation: Use optimistic updates with tRPC `useMutation` + `onMutate`.**

Rationale:
- Add/remove is a simple toggle -- low risk of conflict
- User expects instant feedback (icon change + toast)
- Server errors are rare (only possible: lesson doesn't exist, concurrent modification)
- Pattern: `utils.learning.getRecommendedPath.setData()` in `onMutate`, revert in `onError`

```typescript
const addMutation = trpc.learning.addToTrack.useMutation({
  onMutate: async ({ lessonId }) => {
    await utils.learning.getRecommendedPath.cancel();
    const prev = utils.learning.getRecommendedPath.getData();
    // Optimistically add to custom section
    utils.learning.getRecommendedPath.setData(undefined, (old) => {
      // ... modify sections ...
    });
    return { prev };
  },
  onError: (err, vars, ctx) => {
    utils.learning.getRecommendedPath.setData(undefined, ctx?.prev);
    toast.error('Не удалось добавить урок');
  },
  onSuccess: () => toast.success('Добавлено в трек'),
  onSettled: () => utils.learning.getRecommendedPath.invalidate(),
});
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom notification system | sonner (already imported) | Already used in pricing/profile |
| Confirmation dialog | Custom modal | AlertDialog from shadcn/ui | Already in component library |
| Icons | Custom SVG | lucide-react Plus, Check, X, RefreshCw | Consistent with existing icons |
| Optimistic cache updates | Manual state management | tRPC onMutate/onError/onSettled | Built into tRPC React Query |

## Common Pitfalls

### Pitfall 1: Duplicate Lessons Across Sections
**What goes wrong:** Lesson appears in both "Moi uroki" and an AI section after add.
**Why it happens:** Add mutation doesn't remove from AI sections before inserting into custom.
**How to avoid:** Every `addToTrack` mutation MUST scan all sections and remove the lessonId before adding to custom.
**Warning signs:** Same lesson card appearing twice in track view.

### Pitfall 2: Race Condition on JSON Read-Modify-Write
**What goes wrong:** Two concurrent mutations read the same JSON, both write back, one's changes are lost.
**Why it happens:** No row-level locking on JSON field update.
**How to avoid:** Low risk for single-user operations. If concerned, use `$transaction` with serializable isolation. For MVP, invalidation on `onSettled` is sufficient.
**Warning signs:** Lesson mysteriously disappears from track after rapid add/remove clicks.

### Pitfall 3: Custom Section Lost on Diagnostic Completion
**What goes wrong:** User adds custom lessons, then runs diagnostic -- `generateSectionedPath` overwrites entire `lessons` JSON.
**Why it happens:** Diagnostic completion in `diagnostic.ts` does `upsert` with full `lessons` replacement.
**How to avoid:** Modify the diagnostic completion flow to: (1) read existing custom section before generating, (2) exclude custom lessonIds from AI section generation, (3) prepend custom section to new AI sections.
**Warning signs:** "Moi uroki" disappearing after re-diagnosis.

### Pitfall 4: Old Flat Format Paths
**What goes wrong:** User with old flat `string[]` path tries to add lesson -- mutation crashes parsing.
**Why it happens:** `parseLearningPath` returns `string[]` for old format.
**How to avoid:** `addToTrack` must handle both formats: if flat, convert to sectioned format (custom section only, AI sections empty until next diagnostic).

### Pitfall 5: Stale Cache After Mutation
**What goes wrong:** After add/remove, track view still shows old data.
**Why it happens:** `getRecommendedPath` query not invalidated.
**How to avoid:** Always call `utils.learning.getRecommendedPath.invalidate()` in `onSettled`. Also invalidate `getCourses` if it shows "in track" badges.

## Code Examples

### Custom Section Style
```typescript
// Extend SECTION_STYLES in learn/page.tsx
const SECTION_STYLES = {
  custom: {
    icon: '\u2764',  // heart or bookmark
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  errors: { ... },
  // ... existing styles
};
```

### Toggle Button on LessonCard
```typescript
// Small button in top-right corner of LessonCard
{onToggleTrack && (
  <button
    onClick={(e) => {
      e.preventDefault();  // Prevent Link navigation
      e.stopPropagation();
      onToggleTrack();
    }}
    className={cn(
      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all',
      inTrack
        ? 'bg-mp-green-100 text-mp-green-600 hover:bg-mp-green-200'
        : 'bg-mp-gray-100 text-mp-gray-400 hover:bg-mp-gray-200 hover:text-mp-gray-600'
    )}
    title={inTrack ? 'В треке' : 'Добавить в трек'}
  >
    {inTrack ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
  </button>
)}
```

### addToTrack Mutation
```typescript
addToTrack: protectedProcedure
  .input(z.object({ lessonId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Verify lesson exists
    const lesson = await ctx.prisma.lesson.findUnique({ where: { id: input.lessonId } });
    if (!lesson) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });

    // Get or create learning path
    let path = await ctx.prisma.learningPath.findUnique({ where: { userId: ctx.user.id } });

    if (!path) {
      // Create new path with custom section only
      const newPath: SectionedLearningPath = {
        version: 2,
        sections: [{
          id: 'custom',
          title: 'Мои уроки',
          description: '1 урок',
          lessonIds: [input.lessonId],
          addedAt: { [input.lessonId]: new Date().toISOString() },
        }],
        generatedFromSessionId: '',
      };
      await ctx.prisma.learningPath.create({
        data: { userId: ctx.user.id, lessons: newPath as any },
      });
      return { added: true };
    }

    // Parse and modify
    const parsed = parseLearningPath(path.lessons);
    let sections: LearningPathSection[];

    if (Array.isArray(parsed)) {
      // Convert old flat format
      sections = [{ id: 'custom', title: 'Мои уроки', description: '', lessonIds: [input.lessonId], addedAt: { [input.lessonId]: new Date().toISOString() } }];
    } else {
      sections = [...parsed.sections];
      // Remove from AI sections
      sections = sections.map(s => s.id === 'custom' ? s : { ...s, lessonIds: s.lessonIds.filter(id => id !== input.lessonId) });
      // Add to custom section (create if missing)
      const customIdx = sections.findIndex(s => s.id === 'custom');
      if (customIdx >= 0) {
        if (!sections[customIdx].lessonIds.includes(input.lessonId)) {
          sections[customIdx] = {
            ...sections[customIdx],
            lessonIds: [...sections[customIdx].lessonIds, input.lessonId],
            addedAt: { ...sections[customIdx].addedAt, [input.lessonId]: new Date().toISOString() },
          };
        }
      } else {
        sections.unshift({ id: 'custom', title: 'Мои уроки', description: '', lessonIds: [input.lessonId], addedAt: { [input.lessonId]: new Date().toISOString() } });
      }
    }

    // Update descriptions
    const custom = sections.find(s => s.id === 'custom');
    if (custom) custom.description = `${custom.lessonIds.length} ${custom.lessonIds.length === 1 ? 'урок' : 'уроков'}`;

    // Filter empty AI sections
    const finalSections = sections.filter(s => s.id === 'custom' || s.lessonIds.length > 0);

    await ctx.prisma.learningPath.update({
      where: { id: path.id },
      data: { lessons: { ...parsed, version: 2, sections: finalSections } as any },
    });
    return { added: true };
  }),
```

### Rebuild Track Integration Point
```typescript
// In diagnostic.ts, modify the completion flow (around line 747):
// Before:
//   await ctx.prisma.learningPath.upsert({ ... lessons: pathData ... });
// After:
//   1. Read existing custom section
const existingPath = await ctx.prisma.learningPath.findUnique({ where: { userId: ctx.user.id } });
let customSection: LearningPathSection | undefined;
if (existingPath?.lessons) {
  const parsed = parseLearningPath(existingPath.lessons);
  if (!Array.isArray(parsed)) {
    customSection = parsed.sections.find(s => s.id === 'custom');
  }
}
//   2. Exclude custom lesson IDs from generation
//   Pass customLessonIds to generateSectionedPath as exclusion set
//   3. Prepend custom section to result
if (customSection && customSection.lessonIds.length > 0) {
  (pathData as SectionedLearningPath).sections.unshift(customSection);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat string[] path | SectionedLearningPath v2 | Phase 23 (2026-03-17) | Must support both formats in mutations |
| Server-only mutations | Optimistic updates | Phase 32 | Better UX for add/remove toggle |

## Open Questions

1. **Custom section ordering in getRecommendedPath response**
   - What we know: getRecommendedPath builds section data from lessonIds. Custom section needs same treatment.
   - What's unclear: Should `addedAt` timestamps be exposed to frontend or just used for internal ordering?
   - Recommendation: Sort by `addedAt` on server, don't expose timestamps to frontend.

2. **inTrack computation for "Vse kursy" view**
   - What we know: Need O(1) lookup to show check/plus on each LessonCard.
   - What's unclear: Should this be a separate query or derived from getRecommendedPath?
   - Recommendation: Derive from existing `recommendedPath` data. Build `Set<string>` from all sections' lessonIds. Already have `recommendedLessonIds` pattern in learn/page.tsx.

## Sources

### Primary (HIGH confidence)
- `packages/shared/src/types/index.ts` -- SectionedLearningPath type definition, parseLearningPath
- `packages/api/src/routers/learning.ts` -- existing CRUD, getRecommendedPath query
- `packages/api/src/routers/diagnostic.ts` -- generateSectionedPath, completion flow (line 747)
- `packages/db/prisma/schema.prisma` -- LearningPath model (lessons: Json)
- `apps/web/src/app/(main)/learn/page.tsx` -- SECTION_STYLES, accordion rendering, viewMode toggle
- `apps/web/src/components/learning/LessonCard.tsx` -- current card interface
- `.planning/phases/32-custom-track-management/32-CONTEXT.md` -- all user decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- clear extension of existing SectionedLearningPath pattern
- Pitfalls: HIGH -- identified from direct code reading of mutation patterns and data flow

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable, no external dependencies)
