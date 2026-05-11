// Phase 55 Sprint 2C smoke test — 6 lessons × 3 questions from the new 79 lessons.
// Target: ≥80% accuracy (Y + 0.5·Partial) / 18 → GO Sprint 3.
//
// Run:
//   NODE_OPTIONS='--conditions=react-server' OPENROUTER_DEFAULT_MODEL=openai/gpt-4.1-mini \
//   npx tsx --env-file=.env scripts/vision-ingest/smoke-test-sprint2c.ts

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

type Category = 'url-tool' | 'number-metric' | 'hybrid';

const QUESTIONS: Array<{
  lessonId: string;
  question: string;
  category: Category;
  expectedFact: string;
}> = [
  // === L1: m02_neuroanalytics_003 — Проверка и доработка ответов нейросети ===
  {
    lessonId: '03_ai_m02_neuroanalytics_003',
    question: 'Какие два инструмента/сервиса используются в этом уроке для анализа карточки товара?',
    category: 'url-tool',
    expectedFact: 'ChatGPT (chatgpt.com) и MPSTATS (mpstats.io).',
  },
  {
    lessonId: '03_ai_m02_neuroanalytics_003',
    question: 'Какая цена карточки товара и сколько у неё фото, по данным разбора в этом уроке?',
    category: 'number-metric',
    expectedFact: 'Цена 1098 ₽, 5 фото; органика/средняя позиция 278; у конкурентов 12-17 фото.',
  },
  {
    lessonId: '03_ai_m02_neuroanalytics_003',
    question: 'Какую структуру итоговой таблицы для анализа карточки рекомендует спикер?',
    category: 'hybrid',
    expectedFact: 'Таблица 3×3: Карточка / Цена / Реклама — слабые места моей карточки, сильные ходы конкурентов топ-10, точки роста.',
  },

  // === L2: m03_visual_008 — Krea AI создаем моделей с нуля ===
  {
    lessonId: '03_ai_m03_visual_008',
    question: 'В каком сервисе спикер обучает собственную модель на фотографиях и в каком сервисе потом генерирует изображения?',
    category: 'url-tool',
    expectedFact: 'Обучение в Krea Train (на базе Flux); генерация в Seedream 4 (Krea 1).',
  },
  {
    lessonId: '03_ai_m03_visual_008',
    question: 'Какое соотношение сторон и разрешение выставлены в Seedream при генерации изображений в этом уроке?',
    category: 'number-metric',
    expectedFact: 'Соотношение сторон 2:3, разрешение 1K, стиль 1/5.',
  },
  {
    lessonId: '03_ai_m03_visual_008',
    question: 'Чем по подходу к контенту отличаются Wildberries и Ozon, согласно итоговому слайду урока?',
    category: 'hybrid',
    expectedFact: 'WB — эмоции, типажи, атмосфера; Ozon — каталог, нейтральный фон, детали.',
  },

  // === L3: m04_neurovideo_012 — Генерируем видео в VEO3 ===
  {
    lessonId: '03_ai_m04_neurovideo_012',
    question: 'В каком сервисе спикер генерирует видео из кадров и какая модель выбрана для генерации?',
    category: 'url-tool',
    expectedFact: 'Google Flow (labs.google/fx/tools/flow/...), модель Veo 3 - Fast (Frames to Video).',
  },
  {
    lessonId: '03_ai_m04_neurovideo_012',
    question: 'Какой бренд и объём продукта показаны на кадре с гелем для душа с персиковым ароматом?',
    category: 'number-metric',
    expectedFact: 'DOLCE MILK, Sunset beach PEACH, гель для душа, 300 ml / 10.1 fl.oz.',
  },
  {
    lessonId: '03_ai_m04_neurovideo_012',
    question: 'Какую главную мысль выносит спикер на финальном слайде урока?',
    category: 'hybrid',
    expectedFact: '«Сильное видео начинается с сильного смысла».',
  },

  // === L4: m05_neurotexts_002 — MPSTATS + ChatGPT: собрать сильные ключи ===
  {
    lessonId: '03_ai_m05_neurotexts_002',
    question: 'В каком инструменте спикер собирает ключевые запросы и какой именно отчёт выгружает?',
    category: 'url-tool',
    expectedFact: 'MPSTATS (mpstats.io), отчёт «Расширения и запросы» / «SEO / Расширение запросов / Товарные позиции WB», ниша «Одежда / Футболки».',
  },
  {
    lessonId: '03_ai_m05_neurotexts_002',
    question: 'Какая выручка указана у топ-товара в таблице MPSTATS по нише футболок?',
    category: 'number-metric',
    expectedFact: 'Топ ряд по выручке: 24 003 360 ₽, 19 013 868 ₽, 18 977 099 ₽, 16 228 358 ₽.',
  },
  {
    lessonId: '03_ai_m05_neurotexts_002',
    question: 'Какие кастомные GPT-ассистенты для маркетплейсов спикер показывает в разделе «Мои GPT»?',
    category: 'hybrid',
    expectedFact: 'Ассистент для WB, Ассистент для Ozon, Yoku Отзывович, Контент-Мастер Маркетплейсов, Yoku Маркетплейс Менеджер.',
  },

  // === L5: m07_neuroscout_003 — Проверка гипотез и поиск подниши в MPSTATS с ИИ ===
  {
    lessonId: '03_ai_m07_neuroscout_003',
    question: 'В каком инструменте и в каком разделе спикер выбирает нишу для анализа?',
    category: 'url-tool',
    expectedFact: 'MPSTATS (mpstats.io), раздел «Выбор ниши», данные за последние 30 дней, обновление каждый день в 03:00 МСК.',
  },
  {
    lessonId: '03_ai_m07_neuroscout_003',
    question: 'Какой ценовой диапазон спикер задаёт для поиска подниши и какая выручка указана для ниши «Держатели для украшений»?',
    category: 'number-metric',
    expectedFact: 'Ценовой коридор 700–2000 руб; «Держатели для украшений» — выручка ~45,95 млн ₽, ~76,0 тыс. продаж, медианная цена ~899 ₽.',
  },
  {
    lessonId: '03_ai_m07_neuroscout_003',
    question: 'По каким критериям ChatGPT рекомендует выбирать подниши? Назови ключевые признаки «хорошей» подниши.',
    category: 'hybrid',
    expectedFact: 'Низкая насыщенность (~20 продавцов с продажами), быстрый оборот, компактный товар, простой вход (FBO, без сертификации), не сезонный, нет монополии.',
  },

  // === L6: m08_neurointegrator_006 — Собираем ассистента в ChatGPT под задачу ===
  {
    lessonId: '03_ai_m08_neurointegrator_006',
    question: 'Какой инструмент используется для создания кастомного GPT и какое имя/описание получает ассистент?',
    category: 'url-tool',
    expectedFact: 'GPT Editor в ChatGPT (chatgpt.com/gpts/editor/g-...), имя «SEO-специалист для Wildberries», описание «Соберет SEO для вашей карточки в 3 клика».',
  },
  {
    lessonId: '03_ai_m08_neurointegrator_006',
    question: 'Какие лимиты по символам для Title и Описания на Wildberries указаны в инструкциях ассистента?',
    category: 'number-metric',
    expectedFact: 'Title ≤ 60 символов, Описание ≤ 2000 символов, слово не более 3 раз (no переспам).',
  },
  {
    lessonId: '03_ai_m08_neurointegrator_006',
    question: 'Что входит в финальную самопроверку, которую ассистент выполняет перед выдачей карточки?',
    category: 'hybrid',
    expectedFact: 'Title ≤ 60, Описание ≤ 2000, дубли слов?, слова «женский»/«мужской» в названии отсутствуют?, переспама >3 раз нет.',
  },
];

async function main() {
  const { generateChatResponse } = await import('../../packages/ai/src/index.ts');

  const lines: string[] = ['# Phase 55 Sprint 2C — Smoke Test (6 lessons × 3 questions)\n'];
  lines.push(`_Run: ${new Date().toISOString()}_`);
  lines.push(`_Model: ${process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4.1-nano (default)'}_\n`);

  let lastLesson = '';
  const latencyByCategory: Record<string, number[]> = { 'url-tool': [], 'number-metric': [], hybrid: [] };
  for (let i = 0; i < QUESTIONS.length; i++) {
    const { lessonId, question, category, expectedFact } = QUESTIONS[i];
    if (lessonId !== lastLesson) {
      lines.push(`\n## ${lessonId}\n`);
      lastLesson = lessonId;
    }
    process.stderr.write(`[${i + 1}/${QUESTIONS.length}] [${category}] ${lessonId} — ${question.slice(0, 60)}...\n`);
    const t0 = Date.now();
    try {
      const result = await generateChatResponse(lessonId, question, []);
      const ms = Date.now() - t0;
      latencyByCategory[category].push(ms);
      lines.push(`### Q${i + 1} [${category}]: ${question}\n`);
      lines.push(`**Ожидаемый факт:** ${expectedFact}\n`);
      lines.push(`**Ответ** _(${ms}ms):_ ${result.content}\n`);
      lines.push(`**Источники (${result.sources.length}):**`);
      for (let s = 0; s < result.sources.length; s++) {
        const src = result.sources[s];
        const label = src.sourceType === 'academy_video_frame' ? 'ЭКРАН' : 'АУДИО';
        lines.push(`- [${s + 1}] (${label} ${src.timecodeFormatted}) ${src.id}`);
      }
      lines.push('');
    } catch (e: any) {
      lines.push(`### Q${i + 1} [${category}]: ${question}\n`);
      lines.push(`**Ожидаемый факт:** ${expectedFact}\n`);
      lines.push(`**Ошибка:** ${e.message}\n`);
      process.stderr.write(`  FAIL: ${e.message}\n`);
    }
  }

  // Latency summary
  lines.push('\n---\n\n## Latency summary\n');
  for (const cat of ['url-tool', 'number-metric', 'hybrid']) {
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
  const outPath = join(outDir, `sprint2c-smoke.md`);
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  process.stderr.write(`\n✓ Wrote ${outPath}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
