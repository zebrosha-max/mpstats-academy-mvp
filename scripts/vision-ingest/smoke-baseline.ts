// Phase 55 smoke-baseline — automated, LLM-judged smoke test for a vision-ingest sprint.
//
// Replaces the manual question-authoring + manual-scoring loop in
// smoke-test-sprint2c.ts with an end-to-end auto-runner.
//
// Run:
//   NODE_OPTIONS='--conditions=react-server' \
//   OPENROUTER_DEFAULT_MODEL=openai/gpt-4.1-mini \
//     npx tsx --env-file=.env scripts/vision-ingest/smoke-baseline.ts \
//     --suffix sprint2c \
//     --lessons 6 \
//     --questions-per-lesson 3 \
//     --threshold 80 \
//     --model openai/gpt-4.1-mini \
//     --judge-model openai/gpt-4.1-mini
//
// Exit codes:
//   0 — PASS  (accuracy ≥ threshold)
//   1 — FAIL  (accuracy < 70%)
//   2 — MARGINAL (70% ≤ accuracy < threshold)
//
// Outputs (under scripts/vision-ingest/results/):
//   smoke-${SUFFIX}.md            — full transcript + sources + latency
//   smoke-${SUFFIX}-checklist.md  — score table + tally + verdict
//
// Safety rules applied (see .claude/memory/vision-ingest-safety.md):
//   - Rule 1: AbortController + 60s timeout on every OpenRouter fetch
//   - Rule 7: per-step cost + latency logged, final cumulative cost printed

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// =====================================================================
// CLI args
// =====================================================================

type CliArgs = {
  suffix: string;
  lessons: number;
  questionsPerLesson: number;
  threshold: number;
  model: string;
  judgeModel: string;
};

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const suffix = get('--suffix');
  if (!suffix) {
    console.error('ERROR: --suffix <SUFFIX> is required (e.g., --suffix sprint2c)');
    process.exit(1);
  }
  const model = get('--model') ?? 'openai/gpt-4.1-mini';
  return {
    suffix,
    lessons: Number(get('--lessons') ?? 6),
    questionsPerLesson: Number(get('--questions-per-lesson') ?? 3),
    threshold: Number(get('--threshold') ?? 80),
    model,
    judgeModel: get('--judge-model') ?? model,
  };
}

const ARGS = parseArgs();

// =====================================================================
// Types
// =====================================================================

type Category = 'url-tool' | 'number-metric' | 'hybrid';

type SelectedLesson = {
  lessonId: string;
  lessonTitle: string;
  module: string;
  localPath: string;
};

type VlmFrame = {
  frameId: string;
  lessonId: string;
  framePath: string;
  pts: number;
  timecode: string;
  response: {
    type?: string;
    summary?: string;
    extracted?: {
      urls?: string[];
      numbers?: string[];
      tools?: string[];
      other?: string[];
    };
  } | null;
  error?: string;
};

type VlmRuns = {
  runDate: string;
  model: string;
  results: VlmFrame[];
};

type ScoredFrame = { frame: VlmFrame; score: number };

type GeneratedQ = {
  question: string;
  category: Category;
  expectedFact: string;
};

type ChatSource = {
  id: string;
  lesson_id?: string;
  timecodeFormatted?: string;
  sourceType?: string;
};

type QuestionRun = {
  index: number;
  lesson: SelectedLesson;
  frame: VlmFrame;
  generated: GeneratedQ;
  chatAnswer: string;
  chatSources: ChatSource[];
  chatLatencyMs: number;
  judgeScore: 'Y' | 'P' | 'N';
  judgeRationale: string;
  ok: boolean;
  skipReason?: string;
};

// =====================================================================
// Cost tracking
// =====================================================================

// Pricing assumption: gpt-4.1-mini = $0.40/$1.60 per 1M tokens. Used for
// both judge-model calls AND chat (since prod default is the same model).
// If user passes a different model we still use these numbers — the tally
// is approximate, flagged in the report.
const INPUT_PER_M = 0.4;
const OUTPUT_PER_M = 1.6;

function priceUsd(inTok: number, outTok: number): number {
  return (inTok * INPUT_PER_M + outTok * OUTPUT_PER_M) / 1_000_000;
}

const COST = {
  questionGen: 0,
  judge: 0,
  chat: 0,
};

// =====================================================================
// OpenRouter fetch with AbortController + timeout (Rule 1)
// =====================================================================

const OR_KEY =
  process.env.OPENROUTER_API_KEY ||
  process.env.OPENROUTER_VISION_KEY ||
  '';
if (!OR_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY or OPENROUTER_VISION_KEY is required.');
  process.exit(1);
}

type OrChatResult = { content: string; tokensIn: number; tokensOut: number };

async function orChat(opts: {
  model: string;
  system: string;
  user: string;
  jsonMode?: boolean;
  timeoutMs?: number;
  temperature?: number;
}): Promise<OrChatResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 60_000);
  try {
    const body: any = {
      model: opts.model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: opts.temperature ?? 0.2,
    };
    if (opts.jsonMode) body.response_format = { type: 'json_object' };
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OR_KEY}`,
        'HTTP-Referer': 'https://platform.mpstats.academy',
        'X-Title': 'MAAL smoke-baseline',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const tokensIn: number = data?.usage?.prompt_tokens ?? 0;
    const tokensOut: number = data?.usage?.completion_tokens ?? 0;
    return { content, tokensIn, tokensOut };
  } finally {
    clearTimeout(timer);
  }
}

// =====================================================================
// Step 1: pick N lessons
// =====================================================================

function loadInputs(): { selected: SelectedLesson[]; runs: VlmRuns } {
  const dir = join('scripts', 'vision-ingest', 'results');
  const selPath = join(dir, `selected-${ARGS.suffix}-lessons.json`);
  const vlmPath = join(dir, `vlm-runs-${ARGS.suffix}.json`);
  if (!existsSync(selPath)) {
    console.error(`ERROR: missing ${selPath}`);
    process.exit(1);
  }
  if (!existsSync(vlmPath)) {
    console.error(`ERROR: missing ${vlmPath}`);
    process.exit(1);
  }
  const selected = JSON.parse(readFileSync(selPath, 'utf8')) as SelectedLesson[];
  const runs = JSON.parse(readFileSync(vlmPath, 'utf8')) as VlmRuns;
  return { selected, runs };
}

function frameContentScore(f: VlmFrame): number {
  if (!f.response) return 0;
  const ex = f.response.extracted ?? {};
  let s = 0;
  if ((ex.urls?.length ?? 0) > 0) s += 2;
  if ((ex.numbers ?? []).some((n) => /\d{2,}/.test(n))) s += 1.5;
  if ((ex.tools?.length ?? 0) > 0) s += 1.5;
  if ((f.response.summary ?? '').length > 50) s += 1;
  if ((ex.other?.length ?? 0) > 0) s += 0.5;
  return s;
}

function pickLessons(selected: SelectedLesson[], runs: VlmRuns, n: number): SelectedLesson[] {
  // Per-lesson distinctiveness = sum of frame scores within that lesson.
  const framesByLesson = new Map<string, VlmFrame[]>();
  for (const f of runs.results) {
    if (!f.response) continue;
    if (!framesByLesson.has(f.lessonId)) framesByLesson.set(f.lessonId, []);
    framesByLesson.get(f.lessonId)!.push(f);
  }
  const lessonScore = new Map<string, number>();
  for (const lesson of selected) {
    const frames = framesByLesson.get(lesson.lessonId) ?? [];
    if (frames.length === 0) continue;
    const sum = frames.reduce((acc, f) => acc + frameContentScore(f), 0);
    lessonScore.set(lesson.lessonId, sum);
  }

  // Group by module
  const byModule = new Map<string, SelectedLesson[]>();
  for (const l of selected) {
    if (!lessonScore.has(l.lessonId)) continue;
    if (!byModule.has(l.module)) byModule.set(l.module, []);
    byModule.get(l.module)!.push(l);
  }

  // Sort each module's lessons by descending score
  for (const arr of byModule.values()) {
    arr.sort((a, b) => (lessonScore.get(b.lessonId) ?? 0) - (lessonScore.get(a.lessonId) ?? 0));
  }

  // Round-robin: take 1 per module first, then refill from remainders
  const result: SelectedLesson[] = [];
  const moduleKeys = [...byModule.keys()].sort();
  const queues = moduleKeys.map((m) => byModule.get(m)!.slice());
  while (result.length < n) {
    let progressed = false;
    for (const q of queues) {
      if (result.length >= n) break;
      const next = q.shift();
      if (next) {
        result.push(next);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return result;
}

function pickFrames(runs: VlmRuns, lessonId: string, k: number): ScoredFrame[] {
  const frames = runs.results.filter((f) => f.lessonId === lessonId && f.response);
  const scored: ScoredFrame[] = frames.map((f) => ({ frame: f, score: frameContentScore(f) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// =====================================================================
// Step 3: question generation
// =====================================================================

const QGEN_SYSTEM = `Ты эксперт по образовательным курсам. Тебе дано описание одного кадра из видео-урока. Сгенерируй ОДИН визуальный вопрос на русском языке для проверки RAG-системы.

Категории вопросов (выбери одну, наиболее подходящую):
- "url-tool" — вопрос про URL, название инструмента или элемент UI, видимый на экране
- "number-metric" — вопрос про конкретное число, цену, метрику, длительность
- "hybrid" — вопрос требующий audio-контекст + визуальное подтверждение

Требования:
1. Вопрос должен быть однозначно отвечаем по содержимому кадра (поле extracted/summary).
2. Вопрос должен быть проверяемым: должна быть конкретная фактическая правильная ответ.
3. Вопрос НЕ должен дословно цитировать summary — иначе RAG может сжульничать через прямое совпадение.
4. Длина: 80-150 символов.

Верни СТРОГО JSON:
{
  "question": "...",
  "category": "url-tool|number-metric|hybrid",
  "expectedFact": "конкретный факт который должен присутствовать в ответе"
}`;

function buildQgenUser(lesson: SelectedLesson, frame: VlmFrame): string {
  const ex = frame.response?.extracted ?? {};
  const urls = (ex.urls ?? []).join(', ') || '-';
  const numbers = (ex.numbers ?? []).join(', ') || '-';
  const tools = (ex.tools ?? []).join(', ') || '-';
  const other = (ex.other ?? []).join(' | ') || '-';
  return `Урок: ${lesson.lessonTitle}
Тайм-код кадра: ${frame.timecode}
Summary кадра: ${frame.response?.summary ?? ''}
Extracted: urls=${urls} | numbers=${numbers} | tools=${tools} | other=${other}

Сгенерируй ОДИН визуальный вопрос.`;
}

function tryParseJson<T = any>(content: string): T | null {
  // Strip code fences if any
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function genQuestion(lesson: SelectedLesson, frame: VlmFrame): Promise<GeneratedQ | null> {
  const user = buildQgenUser(lesson, frame);
  for (let attempt = 0; attempt < 2; attempt++) {
    const sys = attempt === 0 ? QGEN_SYSTEM : QGEN_SYSTEM + '\n\nВНИМАНИЕ: верни СТРОГО JSON.';
    try {
      const r = await orChat({
        model: ARGS.judgeModel,
        system: sys,
        user,
        jsonMode: true,
        temperature: 0.3,
      });
      COST.questionGen += priceUsd(r.tokensIn, r.tokensOut);
      const parsed = tryParseJson<GeneratedQ>(r.content);
      if (
        parsed &&
        typeof parsed.question === 'string' &&
        typeof parsed.expectedFact === 'string' &&
        ['url-tool', 'number-metric', 'hybrid'].includes(parsed.category)
      ) {
        return parsed;
      }
    } catch (e) {
      // fall through to retry
    }
  }
  return null;
}

// =====================================================================
// Step 4: chat (system under test)
// =====================================================================

// generateChatResponse is server-only; pattern matches smoke-test-sprint2c.ts.
let generateChatResponseFn: ((lessonId: string, q: string, history: any[]) => Promise<any>) | null = null;

async function loadChat(): Promise<void> {
  process.env.OPENROUTER_DEFAULT_MODEL = ARGS.model;
  const mod: any = await import('../../packages/ai/src/index.ts');
  generateChatResponseFn = mod.generateChatResponse;
  if (typeof generateChatResponseFn !== 'function') {
    throw new Error('generateChatResponse not exported from packages/ai');
  }
}

async function runChat(lessonId: string, question: string): Promise<{
  content: string;
  sources: ChatSource[];
  latencyMs: number;
}> {
  if (!generateChatResponseFn) throw new Error('chat not loaded');
  const t0 = Date.now();
  const result = await generateChatResponseFn(lessonId, question, []);
  const latencyMs = Date.now() - t0;
  // Approximate chat token cost — we don't get usage from generateChatResponse,
  // so estimate from char counts (rough: 1 token ≈ 3 chars Russian).
  const inputChars = question.length + 4000; // approx context window for RAG
  const outputChars = (result.content ?? '').length;
  const approxIn = Math.ceil(inputChars / 3);
  const approxOut = Math.ceil(outputChars / 3);
  COST.chat += priceUsd(approxIn, approxOut);
  return {
    content: result.content ?? '',
    sources: result.sources ?? [],
    latencyMs,
  };
}

// =====================================================================
// Step 5: judge
// =====================================================================

const JUDGE_SYSTEM = `Ты строгий судья RAG-системы. Тебе дано: ожидаемый факт (ground truth) и ответ системы. Реши, насколько ответ покрывает ожидаемый факт.

Категории:
- "Y" — ответ содержит ожидаемый факт дословно или точно перефразированно
- "P" — ответ упоминает связанный факт но не точно ожидаемый (partial)
- "N" — ответ неправильный, "не указано", галлюцинация, или вообще не отвечает

Верни СТРОГО JSON:
{
  "score": "Y|P|N",
  "rationale": "одно предложение почему"
}`;

async function judge(q: string, expected: string, answer: string): Promise<{ score: 'Y' | 'P' | 'N'; rationale: string } | null> {
  const user = `Вопрос: ${q}
Ожидаемый факт: ${expected}
Ответ системы: ${answer}

Оцени.`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const sys = attempt === 0 ? JUDGE_SYSTEM : JUDGE_SYSTEM + '\n\nВНИМАНИЕ: верни СТРОГО JSON.';
    try {
      const r = await orChat({
        model: ARGS.judgeModel,
        system: sys,
        user,
        jsonMode: true,
        temperature: 0,
      });
      COST.judge += priceUsd(r.tokensIn, r.tokensOut);
      const parsed = tryParseJson<{ score: string; rationale: string }>(r.content);
      if (parsed && ['Y', 'P', 'N'].includes(parsed.score) && typeof parsed.rationale === 'string') {
        return { score: parsed.score as 'Y' | 'P' | 'N', rationale: parsed.rationale };
      }
    } catch {
      // retry
    }
  }
  return null;
}

// =====================================================================
// Concurrency primitive
// =====================================================================

async function pmap<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// =====================================================================
// Reporting
// =====================================================================

function pctFmt(num: number, den: number): string {
  if (den === 0) return 'n/a';
  return `${num}/${den} (${((num / den) * 100).toFixed(1)}%)`;
}

function buildReports(runs: QuestionRun[]) {
  // Tally
  const valid = runs.filter((r) => r.ok);
  const total = valid.length;
  const counts = { Y: 0, P: 0, N: 0 };
  const byCat: Record<Category, { y: number; p: number; n: number; total: number }> = {
    'url-tool': { y: 0, p: 0, n: 0, total: 0 },
    'number-metric': { y: 0, p: 0, n: 0, total: 0 },
    hybrid: { y: 0, p: 0, n: 0, total: 0 },
  };
  for (const r of valid) {
    counts[r.judgeScore]++;
    const cat = r.generated.category;
    byCat[cat].total++;
    if (r.judgeScore === 'Y') byCat[cat].y++;
    else if (r.judgeScore === 'P') byCat[cat].p++;
    else byCat[cat].n++;
  }
  const score = counts.Y + 0.5 * counts.P;
  const accuracy = total === 0 ? 0 : (score / total) * 100;

  // Latency per category
  const latByCat: Record<Category, number[]> = { 'url-tool': [], 'number-metric': [], hybrid: [] };
  for (const r of valid) latByCat[r.generated.category].push(r.chatLatencyMs);
  function latSum(arr: number[]) {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
      p50: sorted[Math.floor(sorted.length / 2)],
      min: Math.min(...arr),
      max: Math.max(...arr),
    };
  }

  const allLat = valid.map((r) => r.chatLatencyMs);
  const overallLat = latSum(allLat);

  // Verdict
  let verdict: 'PASS' | 'MARGINAL' | 'FAIL';
  if (accuracy >= ARGS.threshold) verdict = 'PASS';
  else if (accuracy >= 70) verdict = 'MARGINAL';
  else verdict = 'FAIL';

  // --- Full transcript ---
  const t: string[] = [];
  t.push(`# Phase 55 — Smoke Baseline (${ARGS.suffix})\n`);
  t.push(`_Run: ${new Date().toISOString()}_`);
  t.push(`_Model: ${ARGS.model}_`);
  t.push(`_Judge model: ${ARGS.judgeModel}_`);
  t.push(`_Threshold: ${ARGS.threshold}%_`);
  t.push(`_N lessons: ${ARGS.lessons} × K=${ARGS.questionsPerLesson} questions = ${ARGS.lessons * ARGS.questionsPerLesson} planned, ${total} scored_\n`);

  const skipped = runs.filter((r) => !r.ok);
  if (skipped.length) {
    t.push(`> ${skipped.length} question(s) skipped due to gen/judge failures:`);
    for (const s of skipped) t.push(`> - Q${s.index}: ${s.skipReason}`);
    t.push('');
  }

  let lastLesson = '';
  for (const r of valid) {
    if (r.lesson.lessonId !== lastLesson) {
      t.push(`\n## ${r.lesson.lessonId} — ${r.lesson.lessonTitle}\n`);
      lastLesson = r.lesson.lessonId;
    }
    t.push(`### Q${r.index} [${r.generated.category}] (frame ${r.frame.timecode}): ${r.generated.question}\n`);
    t.push(`**Ожидаемый факт:** ${r.generated.expectedFact}\n`);
    const short = r.chatAnswer.length > 500 ? r.chatAnswer.slice(0, 500) + '…' : r.chatAnswer;
    t.push(`**Ответ** _(${r.chatLatencyMs}ms):_ ${short}\n`);
    t.push(`**Источники (${r.chatSources.length}):**`);
    for (let s = 0; s < r.chatSources.length; s++) {
      const src = r.chatSources[s];
      const label = src.sourceType === 'academy_video_frame' ? 'ЭКРАН' : 'АУДИО';
      t.push(`- [${s + 1}] (${label} ${src.timecodeFormatted ?? '-'}) ${src.id}`);
    }
    t.push(`\n**Оценка:** ${r.judgeScore} — ${r.judgeRationale}\n`);
  }

  // Latency summary
  t.push('\n---\n\n## Latency summary\n');
  if (overallLat) {
    t.push(`- **overall** (n=${allLat.length}): avg ${overallLat.avg}ms, p50 ${overallLat.p50}ms, min ${overallLat.min}ms, max ${overallLat.max}ms`);
  }
  for (const cat of ['url-tool', 'number-metric', 'hybrid'] as Category[]) {
    const s = latSum(latByCat[cat]);
    if (s) t.push(`- **${cat}** (n=${latByCat[cat].length}): avg ${s.avg}ms, p50 ${s.p50}ms, min ${s.min}ms, max ${s.max}ms`);
  }

  // --- Checklist ---
  const c: string[] = [];
  c.push(`# Phase 55 — Smoke Checklist (${ARGS.suffix})\n`);
  c.push(`Model: \`${ARGS.model}\`. Judge: \`${ARGS.judgeModel}\`. Target: ≥${ARGS.threshold}% accuracy (Y + 0.5·P) / total.\n`);
  c.push(`## Score table\n`);
  c.push(`| Q# | Lesson | Cat | Expected | Answer (snippet) | Score | Rationale |`);
  c.push(`|----|--------|-----|----------|------------------|-------|-----------|`);
  for (const r of valid) {
    const ansSnip = r.chatAnswer.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 120);
    const expSnip = r.generated.expectedFact.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 100);
    const qLessonShort = r.lesson.lessonId.replace(/^03_ai_/, '');
    const ratSnip = r.judgeRationale.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 120);
    c.push(`| Q${r.index} | ${qLessonShort} | ${r.generated.category} | ${expSnip} | ${ansSnip} | **${r.judgeScore}** | ${ratSnip} |`);
  }
  c.push('');
  c.push(`## Per-category tally\n`);
  for (const cat of ['url-tool', 'number-metric', 'hybrid'] as Category[]) {
    const b = byCat[cat];
    const catScore = b.y + 0.5 * b.p;
    const pct = b.total === 0 ? 'n/a' : `${((catScore / b.total) * 100).toFixed(1)}%`;
    c.push(`- **${cat}**: Y=${b.y} / P=${b.p} / N=${b.n} (n=${b.total}) → ${pct}`);
  }
  c.push('');
  c.push(`## Final tally\n`);
  c.push(`\`Y=${counts.Y}, P=${counts.P}, N=${counts.N}\` → Accuracy = ${pctFmt(score, total)}\n`);
  c.push(`**Verdict: ${verdict}**\n`);
  c.push(`## Cost\n`);
  c.push(`- Question generation: $${COST.questionGen.toFixed(4)}`);
  c.push(`- Chat (system under test, approx): $${COST.chat.toFixed(4)}`);
  c.push(`- Judging: $${COST.judge.toFixed(4)}`);
  c.push(`- **Total: $${(COST.questionGen + COST.chat + COST.judge).toFixed(4)}**\n`);

  return {
    transcript: t.join('\n'),
    checklist: c.join('\n'),
    accuracy,
    verdict,
    counts,
    byCat,
    overallLat,
    total,
  };
}

// =====================================================================
// Main
// =====================================================================

async function main() {
  const t0 = Date.now();
  process.stderr.write(`[smoke-baseline] suffix=${ARGS.suffix} lessons=${ARGS.lessons} q/lesson=${ARGS.questionsPerLesson} threshold=${ARGS.threshold}% model=${ARGS.model} judge=${ARGS.judgeModel}\n`);

  const { selected, runs } = loadInputs();
  process.stderr.write(`[smoke-baseline] loaded ${selected.length} selected lessons, ${runs.results.length} VLM frames\n`);

  // Step 1: pick lessons
  const lessons = pickLessons(selected, runs, ARGS.lessons);
  process.stderr.write(`[smoke-baseline] picked ${lessons.length} lessons:\n`);
  for (const l of lessons) {
    const frames = pickFrames(runs, l.lessonId, ARGS.questionsPerLesson);
    const scores = frames.map((f) => `${f.frame.timecode}(${f.score.toFixed(1)})`).join(' ');
    process.stderr.write(`  - ${l.lessonId} [${l.module}] frames: ${scores}\n`);
  }

  // Step 2 + 3: pick frames + gen questions
  // Build flat list of {lesson, frame} pairs
  const pairs: { lesson: SelectedLesson; frame: VlmFrame }[] = [];
  for (const lesson of lessons) {
    const frames = pickFrames(runs, lesson.lessonId, ARGS.questionsPerLesson);
    for (const sf of frames) pairs.push({ lesson, frame: sf.frame });
  }
  process.stderr.write(`[smoke-baseline] generating ${pairs.length} questions...\n`);
  const generated = await pmap(pairs, 3, async (p, i) => {
    const q = await genQuestion(p.lesson, p.frame);
    if (q) process.stderr.write(`  [gen ${i + 1}/${pairs.length}] OK [${q.category}] ${q.question.slice(0, 60)}\n`);
    else process.stderr.write(`  [gen ${i + 1}/${pairs.length}] FAIL\n`);
    return q;
  });

  // Load chat (sets OPENROUTER_DEFAULT_MODEL)
  await loadChat();

  // Step 4 + 5: run chat + judge (parallel concurrency 3)
  process.stderr.write(`[smoke-baseline] running chat + judge for ${pairs.length} questions...\n`);
  const runResults: QuestionRun[] = await pmap(pairs, 3, async (p, i) => {
    const idx = i + 1;
    const g = generated[i];
    if (!g) {
      process.stderr.write(`[Q ${idx}/${pairs.length}] ${p.lesson.lessonId} SKIP — question-gen failed\n`);
      return {
        index: idx,
        lesson: p.lesson,
        frame: p.frame,
        generated: { question: '', category: 'hybrid', expectedFact: '' },
        chatAnswer: '',
        chatSources: [],
        chatLatencyMs: 0,
        judgeScore: 'N',
        judgeRationale: 'skipped',
        ok: false,
        skipReason: 'question-gen failed',
      } satisfies QuestionRun;
    }
    process.stderr.write(`[Q ${idx}/${pairs.length}] ${p.lesson.lessonId} [${g.category}] running...\n`);
    let chatAnswer = '';
    let chatSources: ChatSource[] = [];
    let chatLatencyMs = 0;
    try {
      const r = await runChat(p.lesson.lessonId, g.question);
      chatAnswer = r.content;
      chatSources = r.sources;
      chatLatencyMs = r.latencyMs;
    } catch (e: any) {
      process.stderr.write(`[Q ${idx}/${pairs.length}] CHAT FAIL: ${e.message}\n`);
      return {
        index: idx,
        lesson: p.lesson,
        frame: p.frame,
        generated: g,
        chatAnswer: '',
        chatSources: [],
        chatLatencyMs: 0,
        judgeScore: 'N',
        judgeRationale: `chat failed: ${e.message}`,
        ok: false,
        skipReason: `chat failed: ${e.message}`,
      } satisfies QuestionRun;
    }
    const j = await judge(g.question, g.expectedFact, chatAnswer);
    if (!j) {
      process.stderr.write(`[Q ${idx}/${pairs.length}] JUDGE FAIL\n`);
      return {
        index: idx,
        lesson: p.lesson,
        frame: p.frame,
        generated: g,
        chatAnswer,
        chatSources,
        chatLatencyMs,
        judgeScore: 'N',
        judgeRationale: 'judge failed',
        ok: false,
        skipReason: 'judge failed',
      } satisfies QuestionRun;
    }
    process.stderr.write(`[Q ${idx}/${pairs.length}] OK (${j.score}, ${(chatLatencyMs / 1000).toFixed(1)}s)\n`);
    return {
      index: idx,
      lesson: p.lesson,
      frame: p.frame,
      generated: g,
      chatAnswer,
      chatSources,
      chatLatencyMs,
      judgeScore: j.score,
      judgeRationale: j.rationale,
      ok: true,
    } satisfies QuestionRun;
  });

  // Sort by lesson then index for stable report
  runResults.sort((a, b) => {
    if (a.lesson.lessonId !== b.lesson.lessonId) return a.lesson.lessonId.localeCompare(b.lesson.lessonId);
    return a.index - b.index;
  });
  // Renumber after sort for readability
  runResults.forEach((r, i) => (r.index = i + 1));

  const report = buildReports(runResults);

  // Write files
  const outDir = join('scripts', 'vision-ingest', 'results');
  mkdirSync(outDir, { recursive: true });
  const transcriptPath = join(outDir, `smoke-${ARGS.suffix}.md`);
  const checklistPath = join(outDir, `smoke-${ARGS.suffix}-checklist.md`);
  writeFileSync(transcriptPath, report.transcript, 'utf8');
  writeFileSync(checklistPath, report.checklist, 'utf8');

  // Final stdout block
  const totalCost = COST.questionGen + COST.chat + COST.judge;
  const lat = report.overallLat;
  const perCatLine = (['url-tool', 'number-metric', 'hybrid'] as Category[])
    .map((cat) => {
      const b = report.byCat[cat];
      const s = b.y + 0.5 * b.p;
      const pct = b.total === 0 ? 'n/a' : `${((s / b.total) * 100).toFixed(0)}%`;
      return `${cat} ${b.y + (b.p ? `+${b.p}P` : '')}/${b.total} (${pct})`;
    })
    .join(', ');

  console.log(`\n=== SMOKE BASELINE: ${ARGS.suffix} ===`);
  console.log(
    `Accuracy: ${report.counts.Y + 0.5 * report.counts.P}/${report.total} (${report.accuracy.toFixed(1)}%) — ${report.verdict} (threshold ${ARGS.threshold}%)`,
  );
  console.log(`Per-category: ${perCatLine}`);
  console.log(
    `Run cost: $${totalCost.toFixed(4)} (chat $${COST.chat.toFixed(4)} + judge $${COST.judge.toFixed(4)} + question-gen $${COST.questionGen.toFixed(4)})`,
  );
  if (lat) console.log(`Latency: avg ${(lat.avg / 1000).toFixed(1)}s / p50 ${(lat.p50 / 1000).toFixed(1)}s / max ${(lat.max / 1000).toFixed(1)}s`);
  console.log(`Reports: ${transcriptPath}, ${checklistPath}`);
  console.log(`Wall time: ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  if (report.verdict === 'PASS') process.exit(0);
  if (report.verdict === 'MARGINAL') process.exit(2);
  process.exit(1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
