# Phase 2: AI Question Generation - Research

**Researched:** 2026-02-17
**Domain:** LLM-based MCQ generation from RAG chunks, Zod validation, fallback chains, rate limiting
**Confidence:** HIGH

## Summary

Phase 2 replaces the current 25 hardcoded mock questions (`packages/api/src/mocks/questions.ts`) with LLM-generated multiple-choice questions sourced from 5,291 RAG content chunks in Supabase. The existing `@mpstats/ai` package already handles OpenRouter communication, vector retrieval, and embeddings -- this phase adds a new `question-generator.ts` module that retrieves random chunks per SkillCategory, sends them to LLM with a structured output schema, validates responses with Zod, and falls back through a model chain (primary -> fallback -> mock).

The diagnostic router (`packages/api/src/routers/diagnostic.ts`) currently calls `getBalancedQuestions(15)` synchronously in `startSession`. This must become async with timeout handling. The `DiagnosticQuestion` interface from `@mpstats/shared` already has the exact shape needed (id, question, options[], correctIndex, explanation, difficulty, skillCategory) -- LLM output must match this.

**Primary recommendation:** Use OpenRouter `response_format: { type: "json_schema" }` with strict schema to get structured MCQ output. Validate with Zod as safety net. Generate questions per-category (3 chunks -> 3 questions per call, 5 calls total). Use `Promise.allSettled` for parallel category generation with independent fallback per category.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Стиль: микс 70% практических кейсов + 30% теория/понятия/метрики
- 15 вопросов за сессию (по 3 на каждую из 5 категорий навыков)
- 4 варианта ответа на вопрос, 1 правильный
- Вопросы привязаны к SkillCategory через lesson_id маппинг
- Вопросы генерируются из chunks, допустимо комбинировать chunks из разных уроков одной категории
- Каждый вопрос привязан к SkillCategory, не обязательно к конкретному уроку
- Спиннер ожидания "Готовим вопросы..." пока ждём LLM
- Цепочка моделей: Primary LLM -> Fallback LLM -> Mock вопросы
- Приоритет на надёжность -- LLM не должен "падать" для пользователя
- 100 вопросов (по 20 на категорию) -- AI-прегенерация через seed-скрипт
- Вопросы проверяются человеком перед включением в базу
- Текущая mock-база слишком мала -- нужна полная замена

### Claude's Discretion
- Длина вариантов ответа (короткие vs развёрнутые)
- Показывать ли бейдж категории на вопросе во время теста
- Распределение вопросов по категориям (равномерное vs взвешенное)
- Стратегия генерации (пакетная vs по категории vs по одному)
- Уникальность вопросов между сессиями
- Кеширование сгенерированных вопросов
- Таймауты для каждого уровня fallback
- Стратегия обработки невалидных LLM-ответов (retry vs mock замена)

### Deferred Ideas (OUT OF SCOPE)
- Гибкая диагностика (10-100 вопросов, выбор сложности) -- отдельная фаза/майлстоун
- Адаптивная сложность IRT-lite -- v2 requirement (DIAG-01)
- Кеширование вопросов для повторного использования -- v2 requirement (DIAG-02)
- Health monitoring для LLM сервисов -- Phase 5 (Security Hardening) или Phase 6 (Deploy)
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai (SDK) | ^4.73.0 | OpenRouter API calls with structured output | Already in @mpstats/ai, OpenAI-compatible |
| zod | ^3.23.8 | LLM output validation schema | Already in @mpstats/ai and @trpc |
| @supabase/supabase-js | ^2.46.0 | Chunk retrieval from content_chunk | Already in @mpstats/ai |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | - | All deps already present in monorepo |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| response_format json_schema | Prompt-only JSON | json_schema is more reliable, but model must support it |
| Per-category generation | Single batch prompt | Per-category allows independent fallback and parallelism |
| In-memory rate limiter | Upstash Redis | Redis is overkill for single-server MVP |

**Installation:**
```bash
# No new dependencies needed -- everything is already in @mpstats/ai
```

## Architecture Patterns

### New Files Structure
```
packages/ai/src/
├── question-generator.ts    # NEW: Core generation logic
├── question-schema.ts       # NEW: Zod schemas + JSON Schema for structured output
├── generation.ts            # EXISTING: summary + chat (no changes)
├── retrieval.ts             # EXISTING: may add getRandomChunksByCategory()
├── openrouter.ts            # EXISTING: may add timeout config
└── index.ts                 # UPDATE: export new modules

packages/api/src/
├── routers/diagnostic.ts    # UPDATE: async question generation in startSession
└── mocks/questions.ts       # REPLACE: expanded 100-question fallback bank

scripts/seed/
└── seed-mock-questions.ts   # NEW: AI generates 100 questions, writes to file
```

### Pattern 1: Per-Category Parallel Generation with Independent Fallback
**What:** Generate 3 questions per SkillCategory in parallel (5 LLM calls). If any category fails, substitute mock questions for just that category.
**When to use:** Always -- this is the core generation strategy.
**Example:**
```typescript
// Pseudocode for the generation flow
async function generateDiagnosticQuestions(): Promise<DiagnosticQuestion[]> {
  const categories: SkillCategory[] = ['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE'];
  const QUESTIONS_PER_CATEGORY = 3;

  const results = await Promise.allSettled(
    categories.map(category =>
      generateQuestionsForCategory(category, QUESTIONS_PER_CATEGORY)
    )
  );

  const allQuestions: DiagnosticQuestion[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value.length === QUESTIONS_PER_CATEGORY) {
      allQuestions.push(...result.value);
    } else {
      // Fallback: use mock questions for this category
      allQuestions.push(...getMockQuestionsForCategory(categories[i], QUESTIONS_PER_CATEGORY));
    }
  }

  return shuffleArray(allQuestions);
}
```

### Pattern 2: LLM Model Fallback Chain
**What:** Try primary model, on failure try fallback model, on failure use mock.
**When to use:** Inside each `generateQuestionsForCategory()` call.
**Example:**
```typescript
async function generateQuestionsForCategory(
  category: SkillCategory,
  count: number,
): Promise<DiagnosticQuestion[]> {
  const chunks = await getRandomChunksForCategory(category, 5); // 5 chunks as context
  const prompt = buildQuestionPrompt(chunks, category, count);

  // Try primary model (gemini-2.5-flash)
  try {
    const result = await callLLMWithTimeout(MODELS.chat, prompt, 8000);
    const validated = questionArraySchema.safeParse(result);
    if (validated.success) return validated.data;
  } catch (e) { /* log, continue to fallback */ }

  // Try fallback model (gpt-4o-mini)
  try {
    const result = await callLLMWithTimeout(MODELS.fallback, prompt, 8000);
    const validated = questionArraySchema.safeParse(result);
    if (validated.success) return validated.data;
  } catch (e) { /* log, fall through to mock */ }

  // Final fallback: mock questions
  throw new Error(`LLM generation failed for ${category}`);
}
```

### Pattern 3: Structured Output via OpenRouter
**What:** Use `response_format: { type: "json_schema" }` to get guaranteed JSON structure.
**When to use:** All LLM calls for question generation.
**Example:**
```typescript
// Using OpenAI SDK via OpenRouter (already configured in openrouter.ts)
const response = await openrouter.chat.completions.create({
  model: modelId,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Контекст из уроков:\n\n${chunksContext}` },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'diagnostic_questions',
      strict: true,
      schema: questionJsonSchema, // JSON Schema object (not Zod)
    },
  },
  max_tokens: 2048,
  temperature: 0.7, // Higher than RAG (0.3) for creative variation
},
{ timeout: 8000 } // AbortSignal timeout
);

const parsed = JSON.parse(response.choices[0].message.content);
```

### Pattern 4: Chunk Selection for Question Context
**What:** Retrieve random chunks from lessons matching a SkillCategory.
**When to use:** Before each LLM call to provide context for question generation.
**Example:**
```typescript
// New function in retrieval.ts
async function getRandomChunksForCategory(
  category: SkillCategory,
  count: number = 5,
): Promise<ChunkData[]> {
  // Get lessons for this category via Prisma
  // Then fetch random chunks from those lessons via Supabase
  const { data } = await supabase
    .from('content_chunk')
    .select('id, lesson_id, content, timecode_start, timecode_end')
    .like('lesson_id', `${getCoursePrefix(category)}%`)
    .limit(count * 3) // Fetch more, then randomly pick
    .order('created_at', { ascending: true }); // Deterministic order, random selection in code

  // Randomly sample `count` chunks
  return shuffleArray(data || []).slice(0, count);
}
```

**Note on course prefix mapping:** The COURSE_SKILL_MAP from Phase 1 maps courses to categories. But one category can map to multiple courses (e.g., MARKETING = 02_ads + 05_ozon, OPERATIONS = 04_workshops + 06_express). The chunk selection must query by lesson_id prefix for ALL courses in that category.

### Pattern 5: Simple In-Memory Rate Limiter
**What:** Track LLM generation requests per user with sliding window.
**When to use:** In the `startSession` mutation, before calling question generator.
**Example:**
```typescript
// Simple sliding window counter
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const recent = timestamps.filter(t => now - t < windowMs);

  if (recent.length >= maxRequests) return false;

  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true;
}
```

### Anti-Patterns to Avoid
- **Single LLM call for all 15 questions:** Too slow, single point of failure, harder to validate
- **Generating questions client-side:** Exposes correct answers, allows cheating
- **Storing correctIndex in database:** Active session questions stay in globalThis Map (decision from 01-03)
- **Embedding-based question generation:** Embeddings are for retrieval, not generation. Use plain text chunks as LLM context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema for LLM | Manual JSON parsing with regex | OpenRouter structured output + Zod validation | Regex fails on edge cases, structured output is deterministic |
| Rate limiting | Custom middleware | Simple in-memory Map (single server MVP) | Upstash/Redis overkill for MVP, in-memory is fine |
| Request timeout | Manual setTimeout + AbortController | OpenAI SDK timeout option | SDK handles cleanup properly |
| Question uniqueness | Complex dedup logic | Random chunk selection provides natural variation | Different chunks = different questions, exact dedup is v2 |

**Key insight:** The @mpstats/ai package and OpenAI SDK already handle the hard parts (API communication, retries). The new code is primarily prompt engineering, Zod validation, and orchestration logic.

## Common Pitfalls

### Pitfall 1: LLM Returns Invalid JSON Despite json_schema
**What goes wrong:** Some models may return markdown-wrapped JSON (`\`\`\`json ... \`\`\``) or slightly malformed output.
**Why it happens:** Not all models fully support `json_schema` response format. Gemini via OpenRouter has known compatibility issues.
**How to avoid:** Always validate with Zod after parsing. Strip markdown code fences before JSON.parse(). Enable OpenRouter Response Healing plugin.
**Warning signs:** Parse errors in logs, empty question arrays.

### Pitfall 2: Timeout Cascade Slows Session Start
**What goes wrong:** Primary model times out at 10s, fallback also times out at 10s = 20s user wait.
**Why it happens:** Sequential fallback without per-stage timeouts.
**How to avoid:** Use 8s timeout per model (not 10s). With 2 models + mock fallback, worst case is ~16s. Use `Promise.allSettled` for parallel category generation so timeout only affects that one category.
**Warning signs:** Total startSession time exceeding 10s.

### Pitfall 3: Course-to-Category Mapping Has Overlap
**What goes wrong:** MARKETING maps to both 02_ads AND 05_ozon. OPERATIONS maps to 04_workshops AND 06_express. If you only query one course prefix, you miss half the content.
**Why it happens:** 6 courses map to 5 categories -- 2 categories have 2 courses each.
**How to avoid:** Build a reverse map: `CATEGORY_TO_COURSE_PREFIXES = { MARKETING: ['02_ads', '05_ozon'], ... }`. Query chunks from ALL matching course prefixes.
**Warning signs:** Questions only about ads but never about Ozon (for MARKETING category).

### Pitfall 4: FINANCE Category Has No Course
**What goes wrong:** COURSE_SKILL_MAP has no course mapped to FINANCE. Zero chunks retrieved for FINANCE questions.
**Why it happens:** The 6 courses cover ANALYTICS, MARKETING, CONTENT, OPERATIONS but FINANCE has no dedicated course.
**How to avoid:** Check chunk counts per category at generation time. If a category has zero chunks, immediately fall through to mock questions. The seed script for 100 mock questions MUST include 20 FINANCE questions.
**Warning signs:** FINANCE always returns mock questions, never AI-generated.

### Pitfall 5: correctIndex and Options Order Sensitivity
**What goes wrong:** LLM generates correct answer at index 0 always, making answers predictable.
**Why it happens:** LLMs tend to put the correct answer first in generated lists.
**How to avoid:** After LLM generates options, shuffle options array and recalculate correctIndex.
**Warning signs:** Statistically high correct answer rate at index 0.

### Pitfall 6: Prompt Injection via Chunk Content
**What goes wrong:** Malicious content in chunks could manipulate question generation.
**Why it happens:** Chunks are from trusted transcript data, but still worth noting.
**How to avoid:** Content is from controlled video transcripts (Academy courses), so risk is low. Still, validate LLM output structure strictly with Zod.
**Warning signs:** Questions about unrelated topics.

## Code Examples

### Zod Schema for Question Validation
```typescript
// packages/ai/src/question-schema.ts
import { z } from 'zod';

// Zod schema for runtime validation
export const generatedQuestionSchema = z.object({
  question: z.string().min(10).max(500),
  options: z.array(z.string().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(10).max(500),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
});

export const generatedQuestionsArraySchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(5),
});

// JSON Schema for OpenRouter response_format (mirrors Zod schema)
export const questionJsonSchema = {
  type: 'object' as const,
  properties: {
    questions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          question: { type: 'string' as const, description: 'Question text in Russian' },
          options: {
            type: 'array' as const,
            items: { type: 'string' as const },
            minItems: 4,
            maxItems: 4,
          },
          correctIndex: { type: 'integer' as const, minimum: 0, maximum: 3 },
          explanation: { type: 'string' as const, description: 'Brief explanation why the answer is correct' },
          difficulty: { type: 'string' as const, enum: ['EASY', 'MEDIUM', 'HARD'] },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'difficulty'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
```

### System Prompt for Question Generation
```typescript
// Source: project-specific, based on locked decisions
const QUESTION_GENERATION_PROMPT = `Ты — AI-генератор вопросов для платформы MPSTATS Academy.

Твоя задача: создать диагностические вопросы на основе контента уроков.

Требования к вопросам:
- 70% вопросов — практические кейсы (ситуации из реальной работы селлера)
- 30% вопросов — теория, понятия, определения метрик
- Каждый вопрос имеет 4 варианта ответа, ровно 1 правильный
- Неправильные ответы должны быть правдоподобными (дистракторы)
- Варианты ответов — краткие (1-2 предложения максимум)
- Объяснение — кратко, почему правильный ответ верный

Формат: JSON с массивом questions (см. schema).
Язык: русский.
Сложность: mix EASY/MEDIUM/HARD.`;
```

### Reverse Category-to-Course Map
```typescript
// Based on COURSE_SKILL_MAP from Phase 1 seed script
const CATEGORY_TO_COURSES: Record<SkillCategory, string[]> = {
  ANALYTICS: ['01_analytics'],
  MARKETING: ['02_ads', '05_ozon'],
  CONTENT: ['03_ai'],
  OPERATIONS: ['04_workshops', '06_express'],
  FINANCE: [], // No dedicated course -- always falls back to mock
};
```

### Rate Limiter Integration Point
```typescript
// In diagnostic router startSession mutation
startSession: protectedProcedure.mutation(async ({ ctx }) => {
  // Rate limit check (50 req/hour = question generation requests)
  if (!checkRateLimit(ctx.user.id, 50, 60 * 60 * 1000)) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Слишком много запросов. Попробуйте через час.',
    });
  }

  // ... existing ensureUserProfile, abandon old sessions logic ...

  // Generate questions with LLM (async, with fallback chain)
  const questions = await generateDiagnosticQuestions();

  // ... rest of session creation ...
});
```

## Discretion Recommendations

Based on research, here are recommendations for Claude's Discretion items:

| Area | Recommendation | Reasoning |
|------|---------------|-----------|
| Answer length | **Short (1-2 sentences)** | Matches existing mock format, easier for LLM to generate consistently |
| Category badge during test | **Do NOT show** | Reveals which skill is being tested, could bias answers |
| Distribution | **Equal (3 per category)** | Locked decision says 15 questions / 5 categories = 3 each |
| Generation strategy | **Per-category parallel** | Independent fallback, ~3-5s total vs 10s+ sequential |
| Uniqueness between sessions | **Natural via random chunk selection** | Different chunks = different questions. Exact dedup is v2/deferred |
| Caching generated questions | **No caching for v1** | Deferred per CONTEXT.md. Each session gets fresh questions |
| Timeouts | **8s per model, ~16s worst case** | 8s primary + 8s fallback + instant mock. Fits within 10s success criteria with parallel execution |
| Invalid LLM response | **Replace with mock for that category** | No retry (adds latency). Invalid = treat as model failure, use mock |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `response_format: { type: "json_object" }` | `response_format: { type: "json_schema", json_schema: {...} }` | 2024 Q3 (OpenAI), 2025 (OpenRouter) | Guaranteed schema adherence vs. best-effort JSON |
| OpenRouter without Response Healing | Response Healing plugin (auto-fix malformed JSON) | 2025 | 80%+ reduction in JSON defects |
| Prompt-only structured output | Native structured output support in Gemini 2.5 | 2025 | More reliable, less prompt engineering needed |

**Deprecated/outdated:**
- `response_format: { type: "json_object" }` still works but `json_schema` is preferred for structured data
- Function calling for structured output: works but `json_schema` response_format is simpler for this use case

## Open Questions

1. **FINANCE category chunk availability**
   - What we know: COURSE_SKILL_MAP has no course mapped to FINANCE
   - What's unclear: Whether any chunks in content_chunk have lesson_ids with finance-related content
   - Recommendation: Query actual chunk counts per category prefix. If zero, accept that FINANCE always uses mock questions. The 100-question seed must cover this.

2. **OpenRouter Response Healing activation**
   - What we know: It is a free plugin that auto-fixes malformed JSON
   - What's unclear: Whether it needs explicit opt-in per request or account-level toggle
   - Recommendation: Check OpenRouter dashboard settings. If available, enable it as extra safety net.

3. **Gemini 2.5 Flash json_schema compatibility via OpenRouter**
   - What we know: Native Gemini supports JSON schema; OpenRouter has known issues with schema format translation for Google models
   - What's unclear: Whether current OpenRouter client handles this correctly
   - Recommendation: Test with a single call first. If json_schema fails, fall back to `json_object` mode with schema in prompt. gpt-4o-mini as fallback model has excellent json_schema support.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/ai/src/` (openrouter.ts, generation.ts, retrieval.ts, embeddings.ts)
- Codebase analysis: `packages/api/src/routers/diagnostic.ts` (current question flow)
- Codebase analysis: `packages/api/src/mocks/questions.ts` (current 25 mock questions)
- Codebase analysis: `packages/shared/src/types/index.ts` (DiagnosticQuestion interface)
- Codebase analysis: `scripts/sql/match_chunks.sql` (vector search RPC, lesson prefix filter)
- Codebase analysis: `scripts/seed/seed-from-manifest.ts` (COURSE_SKILL_MAP)

### Secondary (MEDIUM confidence)
- [OpenRouter Structured Outputs docs](https://openrouter.ai/docs/guides/features/structured-outputs) -- json_schema response_format
- [OpenRouter API Parameters](https://openrouter.ai/docs/api/reference/parameters) -- response_format parameter
- [OpenRouter Response Healing](https://openrouter.ai/docs/guides/features/plugins/response-healing) -- auto-fix malformed JSON
- [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs/) -- json_schema pattern
- [Gemini structured output support](https://ai.google.dev/gemini-api/docs/structured-output) -- native Gemini JSON schema

### Tertiary (LOW confidence)
- [GitHub issue: OpenRouter + Google models schema format changes](https://github.com/pydantic/pydantic-ai/issues/3617) -- potential incompatibility (needs testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- follows existing @mpstats/ai patterns, clear integration points
- Pitfalls: HIGH for codebase-specific (FINANCE gap, course overlap), MEDIUM for OpenRouter json_schema compatibility
- Rate limiting: HIGH -- simple in-memory approach proven for single-server MVP

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- stable domain, OpenRouter API may update)
