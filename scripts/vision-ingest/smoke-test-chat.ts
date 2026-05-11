// Headless smoke test for Phase 55 Sprint 2 chat retrieval.
// Calls generateChatResponse() directly, no browser/auth needed.
//
// Run:
//   NODE_OPTIONS='--conditions=react-server' \
//   OPENROUTER_API_KEY=$(cat /e/Academy\ Courses/OpenRouter_Api_key.txt) \
//   DATABASE_URL="$(grep ^DATABASE_URL= .env | cut -d= -f2- | tr -d '\"')" \
//   npx tsx scripts/vision-ingest/smoke-test-chat.ts > scripts/vision-ingest/results/test-headless.md

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

type Category = 'original' | 'visual-only' | 'hybrid';
const QUESTIONS: Array<{ lessonId: string; question: string; category: Category }> = [
  // === ORIGINAL 10 ===
  { lessonId: '03_ai_m04_neurovideo_009', question: 'Какие два онлайн-сервиса показаны в этом уроке?', category: 'original' },
  { lessonId: '03_ai_m04_neurovideo_009', question: 'Какие два онлайн-сервиса показаны на экране в этом уроке?', category: 'original' },
  { lessonId: '03_ai_m04_neurovideo_009', question: 'Какая длительность ролика выставлена при генерации видео в KlingAI?', category: 'original' },
  { lessonId: '03_ai_m04_neurovideo_009', question: 'На каком тайм-коде спикер переключается с Runway на KlingAI?', category: 'original' },
  { lessonId: '03_ai_m07_neuroscout_004', question: 'Какая ссылка на товар MPSTATS показана в уроке и за какой период данные?', category: 'original' },
  { lessonId: '03_ai_m07_neuroscout_004', question: 'Какая выручка показана для ниши «Держатели для украшений»?', category: 'original' },
  { lessonId: '03_ai_m07_neuroscout_004', question: 'Какие три инструмента используются для анализа ниши помимо MPSTATS?', category: 'original' },
  { lessonId: '03_ai_m08_neurointegrator_001', question: 'В чём разница между проектом и агентом в ChatGPT по этому уроку?', category: 'original' },
  { lessonId: '03_ai_m08_neurointegrator_001', question: 'Какие ограничения у GPT-ассистента упоминаются на слайдах?', category: 'original' },
  { lessonId: '03_ai_m08_neurointegrator_001', question: 'Какой инструмент создания кастомного GPT показан на экране?', category: 'original' },

  // === NEW: VISUAL-ONLY (3) ===
  { lessonId: '03_ai_m04_neurovideo_009', question: 'Какие три числовых параметра видны в настройках KlingAI Image-to-Video на экране?', category: 'visual-only' },
  { lessonId: '03_ai_m07_neuroscout_004', question: 'Какие 4 ключевые метрики показаны на экране сводки по предмету в MPSTATS (выручка/доля рынка/объёмы)?', category: 'visual-only' },
  { lessonId: '03_ai_m08_neurointegrator_001', question: 'По какому URL открыт редактор кастомного GPT в ChatGPT?', category: 'visual-only' },

  // === NEW: HYBRID audio + video (3) ===
  { lessonId: '03_ai_m04_neurovideo_009', question: 'Спикер демонстрирует генерацию видео из изображения — какой сервис он использует и какие конкретные настройки выставляет на экране?', category: 'hybrid' },
  { lessonId: '03_ai_m07_neuroscout_004', question: 'Зачем спикер рекомендует анализировать ценовые сегменты и какие конкретные диапазоны цен показаны на экране в MPSTATS?', category: 'hybrid' },
  { lessonId: '03_ai_m08_neurointegrator_001', question: 'Спикер объясняет создание кастомного GPT для конкретной задачи — какую задачу он выбирает и какие настройки демонстрирует в редакторе на экране?', category: 'hybrid' },
];

async function main() {
  // Use relative path — workspace alias '@mpstats/ai' isn't resolvable from project root in tsx
  const { generateChatResponse } = await import('../../packages/ai/src/index.ts');

  const lines: string[] = ['# Phase 55 Sprint 2 — Headless Smoke (B2 few-shot)\n'];
  lines.push(`_Run: ${new Date().toISOString()}_`);
  lines.push(`_Model: ${process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4.1-nano (default)'}_\n`);

  let lastLesson = '';
  const latencyByCategory: Record<string, number[]> = { original: [], 'visual-only': [], hybrid: [] };
  for (let i = 0; i < QUESTIONS.length; i++) {
    const { lessonId, question, category } = QUESTIONS[i];
    if (lessonId !== lastLesson) {
      lines.push(`\n## ${lessonId}\n`);
      lastLesson = lessonId;
    }
    process.stderr.write(`[${i + 1}/${QUESTIONS.length}] [${category}] ${lessonId} — ${question.slice(0, 50)}...\n`);
    const t0 = Date.now();
    try {
      const result = await generateChatResponse(lessonId, question, []);
      const ms = Date.now() - t0;
      latencyByCategory[category].push(ms);
      lines.push(`### Q${i + 1} [${category}]: ${question}\n`);
      lines.push(`**Ответ** _(${ms}ms):_ ${result.content}\n`);
      lines.push(`**Источники (${result.sources.length}):**`);
      for (let s = 0; s < result.sources.length; s++) {
        const src = result.sources[s];
        const label = src.sourceType === 'academy_video_frame' ? 'ЭКРАН' : 'АУДИО';
        lines.push(`- [${s + 1}] (${label} ${src.timecodeFormatted}) ${src.id}`);
      }
      lines.push('');
    } catch (e: any) {
      lines.push(`### Q${i + 1}: ${question}\n`);
      lines.push(`**Ошибка:** ${e.message}\n`);
      process.stderr.write(`  FAIL: ${e.message}\n`);
    }
  }

  // Latency summary
  lines.push('\n---\n\n## Latency summary\n');
  for (const cat of ['original', 'visual-only', 'hybrid']) {
    const arr = latencyByCategory[cat];
    if (arr.length === 0) continue;
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const sorted = [...arr].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length / 2)];
    lines.push(`- **${cat}** (n=${arr.length}): avg ${avg}ms, p50 ${p50}ms, min ${min}ms, max ${max}ms`);
  }

  const outDir = join('scripts/vision-ingest/results');
  mkdirSync(outDir, { recursive: true });
  const modelSlug = (process.env.OPENROUTER_DEFAULT_MODEL || 'gpt-4.1-nano').replace(/[/:]/g, '_');
  const outPath = join(outDir, `test-headless-${modelSlug}.md`);
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  process.stderr.write(`\n✓ Wrote ${outPath}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
