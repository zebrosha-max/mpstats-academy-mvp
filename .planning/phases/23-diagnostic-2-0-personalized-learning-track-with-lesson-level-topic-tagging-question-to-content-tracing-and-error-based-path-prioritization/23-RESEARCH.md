# Phase 23: Diagnostic 2.0 - Research

**Researched:** 2026-03-16
**Domain:** Lesson tagging via LLM, diagnostic question traceability, section-based learning path, dual Radar Chart
**Confidence:** HIGH

## Summary

This phase enhances the learning personalization pipeline in 5 interconnected workstreams: (1) LLM-based tagging of all 405 lessons with multi-categories, topics, and difficulty; (2) tracing diagnostic questions back to source chunks/lessons/timecodes; (3) restructuring the flat learning path into a 4-section accordion prioritized by errors; (4) adding diagnostic hints with clickable timecodes on lesson pages; (5) dual Radar Chart for before/after comparison on repeat diagnostics.

The codebase is well-prepared for this phase. Key infrastructure exists: `TimecodeLink` component, `KinescopePlayer.seekTo()` via postMessage, `formatTimecode()`, `content_chunk` table with 5,291 chunks including timecodes, `DiagnosticAnswer` model, and `LearningPath.lessons` as Json. The main gaps are: `Lesson.skillCategory` is a single enum (needs multi-category), `DiagnosticQuestion` type has no source tracing fields, `generateFullRecommendedPath()` produces a flat list, and `SkillRadarChart` supports only a single `<Radar>` polygon.

**Primary recommendation:** Execute as a data-first pipeline: (Wave 1) schema migrations + tagging script, (Wave 2) question tracing + path generation, (Wave 3) frontend accordion + hints + dual radar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Multi-category tagging: 1-3 skillCategories per lesson (replaces single skillCategory)
- Free-form topics: 2-5 per lesson, two-stage pipeline (LLM free tagging then clustering into canonical dictionary)
- Difficulty: LLM assigns EASY/MEDIUM/HARD in same pass (replaces hardcoded MEDIUM)
- One LLM pass per lesson using first 2-3 chunks from content_chunk
- No manual validation of LLM tags (405 lessons too many)
- FINANCE axis preserved (5 axes unchanged), lessons get FINANCE via multi-category
- Source tracing: save sourceChunkIds, sourceLessonIds, timecodeStart/timecodeEnd with questions
- 4-section accordion track: Errors / Deepening / Growth / Advanced with specific score thresholds
- All sections accessible (recommendation not blocking)
- Hint position: between video player and tabs, with clickable timecodes via existing TimecodeLink
- Hint dismissible permanently (DB or localStorage)
- Hints only on lessons from "Errors" section
- Repeat diagnostic: ask user "Update track?" (not automatic), progress preserved
- Gentle re-diagnostic motivation after completing Errors section
- Dual Radar Chart: "before" (semi-transparent) and "after" polygons

### Claude's Discretion
- Multiple hints per lesson: show first + "still N more" vs all
- Hint design (colors, icon, typography)
- Difficulty detection method (LLM recommended)
- Re-diagnostic CTA placement
- Accordion section design
- Text wording for high-achievers

### Deferred Ideas (OUT OF SCOPE)
- Adaptive difficulty (IRT-lite)
- Spaced repetition
- Full progress visualization history between diagnostics
- Flexible diagnostic (10-100 questions)
- Topic-based search/filtering
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 5.x | Schema migration for new lesson fields | Already in use |
| tRPC | 11.x | New/modified endpoints | Already in use |
| Recharts | 2.x | Dual Radar Chart (multiple `<Radar>` components) | Already in use |
| OpenRouter | - | LLM tagging of 405 lessons | Already configured |
| Supabase | - | content_chunk queries for tagging input | Already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.x | Validation of LLM tagging output | Already in use |
| shadcn/ui Accordion | - | 4-section track UI | May need to add from shadcn registry |

### No New Dependencies Required
This phase requires zero new npm packages. All capabilities exist in the current stack.

## Architecture Patterns

### Pattern 1: LLM Lesson Tagging Pipeline (One-Time Script)

**What:** A script (`scripts/tag-lessons.ts`) that iterates all 405 lessons, fetches first 2-3 chunks per lesson from `content_chunk`, sends them to LLM for categorization, then persists results.

**When to use:** Run once, results stored permanently in DB.

**Key design decisions:**

1. **Input data:** For each lesson, query `content_chunk` WHERE `lesson_id = lesson.id` ORDER BY `timecode_start` LIMIT 3. Concatenate content (~1500-3000 tokens).

2. **LLM output schema (single pass):**
```typescript
// Zod schema for LLM response
const lessonTagSchema = z.object({
  skillCategories: z.array(z.enum(['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE'])).min(1).max(3),
  topics: z.array(z.string().min(2).max(50)).min(2).max(5),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
});
```

3. **Two-stage topic pipeline:**
   - Stage 1: LLM freely generates topics per lesson (raw_topics)
   - Stage 2: Cluster similar topics into canonical dictionary. Use LLM again with all unique raw topics (~500-1000) to produce canonical mapping. E.g., "маржа" + "маржинальность" + "маржинальная прибыль" -> "Маржинальность"

4. **Rate limiting & cost:** 405 LLM calls at ~500 tokens input + ~200 tokens output each. With gemini-2.5-flash at ~$0.15/M tokens: ~$0.05 total. Negligible. Add 1-second delay between calls to avoid rate limits.

5. **Idempotency:** Script should be re-runnable (upsert, not insert).

### Pattern 2: Schema Migration for Multi-Category Lessons

**What:** Migrate `Lesson.skillCategory` from single enum to multi-value.

**Current state:**
```prisma
model Lesson {
  skillCategory SkillCategory  // single enum
  skillLevel    Difficulty @default(MEDIUM)
}
```

**Target state:**
```prisma
model Lesson {
  skillCategory  SkillCategory  // keep for backward compat (primary category)
  skillCategories Json           // ["ANALYTICS", "FINANCE"] — multi-category
  topics          Json           // ["unit economics", "margin"] — free-form tags
  skillLevel      Difficulty     @default(MEDIUM) // now LLM-assigned
}
```

**Why keep both `skillCategory` (single) and `skillCategories` (array):**
- `skillCategory` is used in 8+ places (seed script, question generator, diagnostic router, learning router, shared types, UI filters). Changing it is high-risk.
- `skillCategories` (Json) holds the rich multi-category data for path generation.
- The primary category remains the first/strongest one from LLM tagging.
- Gradual migration: new code reads `skillCategories`, old code still works via `skillCategory`.

### Pattern 3: Question Source Tracing

**What:** Extend `DiagnosticQuestion` type and `DiagnosticAnswer` model to include source chunk/lesson IDs and timecodes.

**Current `DiagnosticQuestion` interface:**
```typescript
export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: Difficulty;
  skillCategory: SkillCategory;
}
```

**Extended:**
```typescript
export interface DiagnosticQuestion {
  // ... existing fields ...
  sourceChunkIds?: string[];    // chunks used to generate this question
  sourceLessonIds?: string[];   // lessons those chunks belong to
  sourceTimecodes?: Array<{ lessonId: string; start: number; end: number }>;
}
```

**Where source data comes from:** In `question-generator.ts`, `fetchRandomChunks()` already returns `{ id, content, lesson_id }`. Need to also fetch `timecode_start`, `timecode_end` and pass them through to `toDiagnosticQuestion()`.

**Storage:** Source info is saved in `DiagnosticSession.questions` (Json field) and optionally in `DiagnosticAnswer` (new Json column `sourceData`).

### Pattern 4: Section-Based Path Generation

**What:** Replace `generateFullRecommendedPath()` flat list with structured 4-section output.

**Algorithm:**
```
Input: skillProfile, diagnosticAnswers (with sourceLessonIds), allLessons (with skillCategories + difficulty)

Section 1 - "Errors" (Проработка ошибок):
  - wrongAnswers = answers WHERE isCorrect = false
  - errorLessonIds = UNIQUE(wrongAnswers.flatMap(a => a.sourceLessonIds))
  - Sort by: category weakness (lowest score first), then lesson.order within category

Section 2 - "Deepening" (Углубление):
  - weakCategories = categories WHERE score < 70%
  - lessons WHERE skillCategories OVERLAPS weakCategories AND NOT IN errorLessonIds
  - Sort by: category weakness, then lesson.order

Section 3 - "Growth" (Развитие):
  - midCategories = categories WHERE score 70-85%
  - lessons WHERE skillCategories OVERLAPS midCategories AND NOT IN Section1+2
  - Sort by: lesson.order

Section 4 - "Advanced" (Продвинутый уровень):
  - strongCategories = categories WHERE score > 85%
  - lessons WHERE difficulty = HARD AND skillCategories OVERLAPS strongCategories AND NOT IN Section1+2+3
  - Sort by: lesson.order
```

**Storage in LearningPath.lessons (Json):**
```typescript
interface SectionedPath {
  sections: Array<{
    id: 'errors' | 'deepening' | 'growth' | 'advanced';
    title: string;
    description: string;
    lessonIds: string[];
  }>;
  generatedFromSessionId: string;
  previousSkillProfile?: SkillProfile; // for dual radar
}
```

### Pattern 5: Dual Radar Chart

**What:** Recharts `<RadarChart>` natively supports multiple `<Radar>` components. Add a second polygon for "before" scores.

**Implementation:**
```typescript
// In RadarChart component, add optional previousData prop
interface SkillRadarChartProps {
  data: SkillProfile;
  previousData?: SkillProfile;  // NEW: for before/after comparison
  className?: string;
  showLabels?: boolean;
}

// Then render two <Radar> components:
<Radar name="Было" dataKey="previous" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.15} strokeDasharray="5 5" />
<Radar name="Стало" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} strokeWidth={2} />
```

**Data source:** When completing a repeat diagnostic, load the PREVIOUS `SkillProfile` before overwriting it. Store it in `LearningPath.lessons` Json as `previousSkillProfile`, or query the second-to-last completed session's answers and recalculate.

**Confidence:** HIGH -- Recharts documentation and shadcn/ui examples confirm multiple `<Radar>` components work natively within a single `<RadarChart>`.

### Pattern 6: Diagnostic Hint on Lesson Page

**What:** A dismissible banner between video player and AI tabs showing the diagnostic question that led the user to this lesson.

**Data flow:**
1. On lesson page load, query: "Does this lesson appear in the user's Errors section?"
2. If yes, fetch the diagnostic answer(s) that reference this lesson's ID
3. Display: question text + clickable timecode (TimecodeLink component)

**Dismissal persistence:** Use `localStorage` key `hint-dismissed-{lessonId}` (simpler than DB column, works immediately, no migration needed). If user clears localStorage, hints reappear -- acceptable tradeoff.

**Multiple hints:** Show the first hint with a collapsed "Ещё N подсказок" toggle if multiple errors map to the same lesson. Keeps UI clean.

### Anti-Patterns to Avoid

- **Breaking `skillCategory` single field:** Do NOT remove or change the type of `Lesson.skillCategory`. Add `skillCategories` alongside it. Too many consumers depend on the single enum.
- **Blocking question generation on source tracking:** If source data is missing (mock questions, old cached questions), questions must still work. Source fields are optional.
- **Auto-replacing track on repeat diagnostic:** User explicitly chooses whether to update. Never auto-replace.
- **Storing hint dismissal in DB:** Over-engineering for a UI preference. localStorage is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-polygon radar | Custom SVG overlay | Recharts multiple `<Radar>` components | Native support, zero custom code |
| Accordion sections | Custom expand/collapse logic | shadcn/ui `<Accordion>` or `<Collapsible>` | Accessible, animated, battle-tested |
| Topic clustering | String similarity algorithms | LLM second pass with all raw topics | 500-1000 topics is trivial for LLM, produces better canonical forms |
| Lesson tagging parallelism | Custom queue/worker | Simple sequential loop with delay | Only 405 calls, takes ~7 minutes, one-time operation |

## Common Pitfalls

### Pitfall 1: FINANCE Lessons Still Empty After Tagging
**What goes wrong:** If no lessons get tagged with FINANCE, the axis remains empty.
**Why it happens:** LLM might not tag lessons as FINANCE if the content focuses on general marketplace operations rather than financial skills.
**How to avoid:** Include explicit guidance in the LLM prompt: "Lessons about unit economics, margin, ROI, pricing strategy, cost calculations, profitability analysis should include FINANCE category."
**Warning signs:** After tagging, count lessons per category. If FINANCE < 10, review the prompt.

### Pitfall 2: Topic Explosion Without Clustering
**What goes wrong:** 405 lessons x 3 topics = 1200+ raw topics, many synonyms and near-duplicates.
**Why it happens:** LLM generates slightly different phrasings each time.
**How to avoid:** Two-stage pipeline is mandatory. Stage 2 clusters raw topics into canonical dictionary (~50-100 canonical topics).
**Warning signs:** More than 200 unique topics after stage 1 -- normal, that's why stage 2 exists.

### Pitfall 3: Breaking Existing Learning Path on Schema Change
**What goes wrong:** `LearningPath.lessons` currently stores `string[]` (flat lesson IDs). Changing to sectioned format breaks existing paths.
**Why it happens:** Json field has no schema enforcement at DB level.
**How to avoid:** Read code must handle BOTH formats -- detect if `lessons` is `string[]` (old) or `SectionedPath` (new). Old format = show as flat list. New format = show sections.
**Warning signs:** Existing users see empty/broken track after deploy.

### Pitfall 4: Source Data Missing for Cached/Mock Questions
**What goes wrong:** Questions from QuestionBank cache or mock fallback have no sourceChunkIds/sourceLessonIds.
**Why it happens:** Cache was populated before source tracking was added. Mock questions have no real source.
**How to avoid:** All source fields are OPTIONAL (`?`). Path generation for "Errors" section works without source data -- fall back to category-based lesson selection (current behavior).
**Warning signs:** Errors section is empty when user had wrong answers from mock questions.

### Pitfall 5: N+1 Queries in Hint Loading
**What goes wrong:** Loading diagnostic hints on the lesson page triggers per-question queries.
**Why it happens:** Each hint needs to join DiagnosticAnswer -> DiagnosticSession -> questions (Json) -> find source match.
**How to avoid:** Pre-compute hints during path generation. Store hint data directly in the sectioned path Json: `{ lessonId, questionText, timecodeStart }`. One query to load path, hints included.
**Warning signs:** Lesson page load time increases by >500ms.

### Pitfall 6: Recharts Dual Radar Tooltip Confusion
**What goes wrong:** Tooltip shows both "before" and "after" values but formatting is unclear.
**Why it happens:** Default Recharts tooltip for multiple Radar components lists all values without clear distinction.
**How to avoid:** Custom tooltip component that shows "Было: X% -> Стало: Y% (+Z%)" with color coding.

## Code Examples

### Dual Radar Chart Extension
```typescript
// Source: Recharts API docs + existing RadarChart.tsx
// Add to SkillRadarChartProps: previousData?: SkillProfile

const chartData = SKILL_CONFIG.map((skill) => ({
  subject: skill.label,
  value: data[skill.key as keyof SkillProfile],
  previous: previousData?.[skill.key as keyof SkillProfile] ?? undefined,
  fullMark: skill.fullMark,
}));

// In JSX, conditionally render second Radar:
{previousData && (
  <Radar
    name="Было"
    dataKey="previous"
    stroke="#9ca3af"
    fill="#9ca3af"
    fillOpacity={0.1}
    strokeWidth={1.5}
    strokeDasharray="4 4"
  />
)}
<Radar
  name="Стало"
  dataKey="value"
  stroke="#3b82f6"
  fill="#3b82f6"
  fillOpacity={0.3}
  strokeWidth={2}
/>
```

### LLM Tagging Prompt
```typescript
const TAGGING_SYSTEM_PROMPT = `You are a content classification expert for MPSTATS Academy (marketplace seller education: Ozon, Wildberries).

Given lesson content chunks, classify the lesson:

1. skillCategories (1-3): Choose from ANALYTICS, MARKETING, CONTENT, OPERATIONS, FINANCE
   - ANALYTICS: data analysis, metrics, A/B testing, dashboards, unit economics analysis
   - MARKETING: advertising, promotion, SEO, PPC, traffic, campaigns
   - CONTENT: product cards, photos, descriptions, AI tools for content
   - OPERATIONS: logistics, warehousing, fulfillment, processes, tools setup
   - FINANCE: pricing, margins, ROI, cost calculation, profitability, budgeting, unit economics calculations

2. topics (2-5): Free-form Russian tags describing specific topics covered. Be specific: "ABC-анализ", "Юнит-экономика", "Настройка рекламы Ozon" not generic "Аналитика".

3. difficulty: EASY (introductory, definitions), MEDIUM (applied skills, standard practice), HARD (advanced strategy, complex calculations, expert-level)

Respond as JSON: { "skillCategories": [...], "topics": [...], "difficulty": "..." }`;
```

### Sectioned Path Structure
```typescript
interface SectionedLearningPath {
  version: 2; // distinguishes from old string[] format
  sections: Array<{
    id: 'errors' | 'deepening' | 'growth' | 'advanced';
    title: string;
    lessonIds: string[];
    // Pre-computed hints for "errors" section only
    hints?: Array<{
      lessonId: string;
      questionText: string;
      timecodes: Array<{ start: number; end: number }>;
    }>;
  }>;
  generatedFromSessionId: string;
  previousSkillProfile?: SkillProfile;
}

// Backward-compat reader
function parseLearningPath(lessons: unknown): string[] | SectionedLearningPath {
  if (Array.isArray(lessons)) return lessons; // old format
  if (typeof lessons === 'object' && lessons !== null && 'version' in lessons) {
    return lessons as SectionedLearningPath;
  }
  return []; // fallback
}
```

### DiagnosticAnswer Source Extension
```prisma
model DiagnosticAnswer {
  // ... existing fields ...
  sourceData Json?  // { chunkIds: string[], lessonIds: string[], timecodes: [{lessonId, start, end}] }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single skillCategory per lesson (1 course = 1 category) | Multi-category via Json field | This phase | Lessons like "Unit economics on WB" now tagged [ANALYTICS, FINANCE] |
| All 405 lessons = MEDIUM difficulty | LLM-assigned EASY/MEDIUM/HARD | This phase | Advanced section can filter genuinely hard lessons |
| Flat recommended path (weakest category first) | 4-section accordion (Errors -> Deepening -> Growth -> Advanced) | This phase | Direct error-to-lesson causality visible to user |
| No question-to-content tracing | sourceChunkIds + sourceLessonIds + timecodes | This phase | Diagnostic hints with clickable timecodes |
| Single radar polygon | Dual radar (before/after) | This phase | Visual progress confirmation on repeat diagnostics |

## Open Questions

1. **Topic Clustering Threshold**
   - What we know: Stage 1 will produce ~1000 raw topics, stage 2 clusters them
   - What's unclear: How many canonical topics is optimal? 50? 100? 200?
   - Recommendation: Let LLM decide during clustering pass. Aim for 50-100 canonical topics. Review output manually after first run.

2. **Hint Dismissal Scope**
   - What we know: User decision says "dismiss permanently"
   - What's unclear: Per-lesson permanent or per-diagnostic? If user retakes diagnostic and same lesson appears in errors, should hint reappear?
   - Recommendation: Per-lesson permanent via localStorage. New diagnostic doesn't reset dismissed state. User explicitly dismissed it = respect that.

3. **Empty Sections Handling**
   - What we know: A user scoring 90%+ may have empty Deepening and Growth sections
   - What's unclear: Show empty section headers or hide them entirely?
   - Recommendation: Hide empty sections. Only show sections that have lessons. For 90%+ users, show primarily "Errors" (few lessons) and "Advanced" (HARD lessons from strong categories).

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/api/src/routers/diagnostic.ts`, `learning.ts`, `packages/ai/src/question-generator.ts` -- full code analysis
- Project schema: `packages/db/prisma/schema.prisma` -- current model structure
- Project types: `packages/shared/src/types/index.ts` -- all type interfaces
- [Recharts Radar API](https://recharts.github.io/en-US/api/Radar/) -- multiple Radar components in single RadarChart
- [shadcn/ui Radar Multiple](https://ui.shadcn.com/charts/radar) -- examples of multi-polygon radar charts

### Secondary (MEDIUM confidence)
- [shadcn.io Radar Multiple pattern](https://www.shadcn.io/charts/radar-multiple) -- community examples confirming dual polygon pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all tools already in project
- Architecture: HIGH -- full codebase analysis, clear integration points
- Pitfalls: HIGH -- based on actual code reading, identified real migration risks
- LLM tagging: MEDIUM -- prompt quality and topic clustering results need validation after first run

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, no external dependency changes expected)
