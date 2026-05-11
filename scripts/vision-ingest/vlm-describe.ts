// scripts/vision-ingest/vlm-describe.ts
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { INGEST_CONFIG } from './config';

interface FrameMeta { seq: number; timecode: string; pts: number; path: string; }
interface VideoExtraction { lessonId: string; frames: FrameMeta[]; }

interface VlmExtracted {
  urls?: string[];
  numbers?: string[];
  tools?: string[];
  other?: string[];
}
interface VlmResponse {
  type?: string;
  summary?: string;
  extracted?: VlmExtracted;
}

interface VlmRunResult {
  frameId: string;
  lessonId: string;
  framePath: string;
  pts: number;
  timecode: string;
  response: VlmResponse | null;
  rawContent: string;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  latencyMs: number;
  error?: string;
}

const PRICING_GPT41_MINI = { in: 0.40 / 1_000_000, out: 1.60 / 1_000_000 };
const REQUEST_TIMEOUT_MS = 60_000;
const CONCURRENCY = 5;

function imageToDataUrl(path: string): string {
  return `data:image/jpeg;base64,${readFileSync(path).toString('base64')}`;
}

function tryParseJson(raw: string): VlmResponse | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try { return JSON.parse(candidate); } catch { return null; }
}

async function callVlm(prompt: string, imagePath: string, apiKey: string, model: string): Promise<{ raw: string; tokensIn: number; tokensOut: number; latencyMs: number }> {
  const dataUrl = imageToDataUrl(imagePath);
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://platform.mpstats.academy',
        'X-Title': 'MAAL Vision Ingest',
      },
      body: JSON.stringify({
        model,
        max_tokens: INGEST_CONFIG.vlm_max_tokens,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const raw = typeof data.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content : JSON.stringify(data.choices?.[0]?.message?.content);
    return {
      raw,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      latencyMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function processOne(job: { lessonId: string; frame: FrameMeta }, prompt: string, apiKey: string, jsonlPath: string): Promise<VlmRunResult> {
  const framePath = join(INGEST_CONFIG.results_dir, job.frame.path);
  const frameId = `${job.lessonId}_frame_${String(job.frame.seq).padStart(3, '0')}`;
  let result: VlmRunResult;
  try {
    let res = await callVlm(prompt, framePath, apiKey, INGEST_CONFIG.vlm_model);
    let parsed = tryParseJson(res.raw);
    if (!parsed) {
      const retryPrompt = prompt + '\n\nВНИМАНИЕ: верни СТРОГО JSON, без markdown-блоков, без пояснений.';
      const res2 = await callVlm(retryPrompt, framePath, apiKey, INGEST_CONFIG.vlm_model);
      parsed = tryParseJson(res2.raw);
      res = { ...res2, tokensIn: res.tokensIn + res2.tokensIn, tokensOut: res.tokensOut + res2.tokensOut };
    }
    const cost = res.tokensIn * PRICING_GPT41_MINI.in + res.tokensOut * PRICING_GPT41_MINI.out;
    result = {
      frameId, lessonId: job.lessonId, framePath: job.frame.path,
      pts: job.frame.pts, timecode: job.frame.timecode,
      response: parsed, rawContent: res.raw,
      tokensIn: res.tokensIn, tokensOut: res.tokensOut,
      costUSD: cost, latencyMs: res.latencyMs,
    };
  } catch (e: any) {
    result = {
      frameId, lessonId: job.lessonId, framePath: job.frame.path,
      pts: job.frame.pts, timecode: job.frame.timecode,
      response: null, rawContent: '',
      tokensIn: 0, tokensOut: 0, costUSD: 0, latencyMs: 0,
      error: e?.message ?? String(e),
    };
  }
  appendFileSync(jsonlPath, JSON.stringify(result) + '\n', 'utf8');
  return result;
}

async function main() {
  const apiKey = process.env.OPENROUTER_VISION_KEY;
  if (!apiKey) throw new Error('OPENROUTER_VISION_KEY required');
  const SUFFIX = process.env.INGEST_SUFFIX?.trim() || '';
  const manifestFile = SUFFIX ? `frames-manifest-${SUFFIX}.json` : 'frames-manifest.json';
  const vlmRunsFile = SUFFIX ? `vlm-runs-${SUFFIX}.json` : 'vlm-runs.json';
  const jsonlFile = SUFFIX ? `vlm-runs-${SUFFIX}.jsonl` : 'vlm-runs.jsonl';
  const manifest = JSON.parse(readFileSync(join(INGEST_CONFIG.results_dir, manifestFile), 'utf8')) as { videos: VideoExtraction[] };
  const prompt = readFileSync(join('scripts/vision-ingest/prompts/frame-describe.txt'), 'utf8');
  const jsonlPath = join(INGEST_CONFIG.results_dir, jsonlFile);

  type Job = { lessonId: string; frame: FrameMeta };
  const allJobs: Job[] = [];
  for (const v of manifest.videos) for (const f of v.frames) allJobs.push({ lessonId: v.lessonId, frame: f });

  // Resume: read existing JSONL, build set of done frameIds
  const doneIds = new Set<string>();
  const existingResults: VlmRunResult[] = [];
  if (existsSync(jsonlPath)) {
    const lines = readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const r = JSON.parse(line) as VlmRunResult;
        // Only treat successful results as "done"; errored ones get retried
        if (!r.error && r.response) {
          doneIds.add(r.frameId);
          existingResults.push(r);
        }
      } catch { /* skip malformed line */ }
    }
    console.log(`Resume: ${doneIds.size} frames already complete from previous run`);
  }

  const todo = allJobs.filter(j => {
    const fid = `${j.lessonId}_frame_${String(j.frame.seq).padStart(3, '0')}`;
    return !doneIds.has(fid);
  });
  console.log(`Total frames: ${allJobs.length}, todo: ${todo.length}, concurrency: ${CONCURRENCY}`);

  let nextIdx = 0;
  let completed = 0;
  const newResults: VlmRunResult[] = [];
  const t0 = Date.now();
  async function worker(wid: number) {
    while (true) {
      const idx = nextIdx++;
      if (idx >= todo.length) return;
      const job = todo[idx];
      const fid = `${job.lessonId}_frame_${String(job.frame.seq).padStart(3, '0')}`;
      const r = await processOne(job, prompt, apiKey, jsonlPath);
      newResults.push(r);
      completed++;
      const elapsed = (Date.now() - t0) / 1000;
      const rate = completed / Math.max(elapsed, 0.001);
      const eta = (todo.length - completed) / Math.max(rate, 0.001);
      const tag = r.error ? `FAIL ${r.error?.slice(0, 60)}` : r.response ? `ok ${r.latencyMs}ms $${r.costUSD.toFixed(5)}` : `parse-fail`;
      console.log(`[w${wid} ${completed}/${todo.length} eta=${Math.round(eta)}s] ${fid}: ${tag}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  // Assemble final JSON from existingResults + newResults
  const allResults = [...existingResults, ...newResults];
  const totalCost = allResults.reduce((s, r) => s + r.costUSD, 0);
  writeFileSync(
    join(INGEST_CONFIG.results_dir, vlmRunsFile),
    JSON.stringify({ runDate: new Date().toISOString(), model: INGEST_CONFIG.vlm_model, totalCostUSD: totalCost, results: allResults }, null, 2),
    'utf8',
  );
  const errors = allResults.filter(r => r.error).length;
  const parseFails = allResults.filter(r => !r.error && !r.response).length;
  console.log(`\nDone: ${allResults.length} total (${newResults.length} new + ${existingResults.length} resumed), $${totalCost.toFixed(4)}, ${errors} errors, ${parseFails} parse-fails`);
}

main().catch((e) => { console.error(e); process.exit(1); });
