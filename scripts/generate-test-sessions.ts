/**
 * Generate 3 test diagnostic sessions for Mila's review.
 * Uses real chunks from DB (with skill_category) + updated prompt rules.
 *
 * Usage: npx tsx scripts/generate-test-sessions.ts
 */
import OpenAI from 'openai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../packages/db/node_modules/@prisma/client');

const CATEGORIES = ['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  ANALYTICS: 'Аналитика',
  MARKETING: 'Маркетинг',
  CONTENT: 'Контент',
  OPERATIONS: 'Операции',
  FINANCE: 'Финансы',
};

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const prisma = new PrismaClient();

async function getChunksForCategory(category: string, count: number) {
  return prisma.$queryRaw`
    SELECT id, content, lesson_id, timecode_start, timecode_end
    FROM content_chunk
    WHERE skill_category = ${category}::"SkillCategory"
    ORDER BY RANDOM()
    LIMIT ${count}
  ` as Promise<Array<{ id: string; content: string; lesson_id: string }>>;
}

async function generateQuestions(category: string, chunks: Array<{ content: string }>) {
  const context = chunks.map((c, i) => `[${i + 1}] ${c.content.substring(0, 600)}`).join('\n\n');

  const systemPrompt = `Ты — генератор вопросов для диагностики знаний селлеров маркетплейсов.

## ПРАВИЛА ВЫБОРА РУБРИКИ
- SEO, поисковые фразы, ключевые слова, индексация → Маркетинг
- Реклама, ставки, показы, CTR, РК → Маркетинг
- Бюджет, расходы, юнит-экономика, маржа, CPO → Финансы
- Контент карточки, фото, инфографика, описание, воронка → Контент
- Логистика, FBO/FBS, остатки, поставки → Операции
- Аналитика, отчёты, мониторинг, конкуренты → Аналитика

## КАЧЕСТВО ВАРИАНТОВ ОТВЕТА
- Все 4 варианта должны быть правдоподобными для специалиста среднего уровня
- Неправильные варианты — частые заблуждения или близкие по смыслу понятия
- Избегай абсурдных вариантов
- Правильный ответ НЕ должен быть очевидным без знания предмета

## КОНТЕКСТ ПЛОЩАДКИ
- Если вопрос специфичен для площадки — обязательно укажи: Wildberries или Ozon
- Не задавай вопросы "в общем" когда ответ зависит от площадки

## ТЕРМИНОЛОГИЯ И СТИЛЬ
- Используй только реальные бизнес-термины маркетплейсов
- Не придумывай новых понятий
- Предпочитай вопросы про алгоритм действий и практические решения
- Избегай вопросов на определения и теоретические знания
- Формулируй вопросы профессиональным языком маркетплейсов
- Сохраняй английские названия брендов: Wildberries, Ozon, MPSTATS

## СТРОГО ЗАПРЕЩЕНО
- Вопросы о сертификатах курса или процессе обучения
- Вопросы о плагинах, расширениях или инструментах МПСТАТС (биддер, парсер)
- Вопросы о целях или структуре самого курса
- Вопросы об определениях общих IT-терминов

Сгенерируй 3 вопроса по рубрике "${CATEGORY_LABELS[category]}" на основе контекста из учебных материалов.
Разная сложность: 1 easy, 1 medium, 1 hard.

Ответ строго в JSON: {"questions": [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]}`;

  const resp = await openrouter.chat.completions.create({
    model: process.env.TEST_MODEL || 'qwen/qwen3.5-flash-02-23',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Контекст из учебных материалов:\n\n${context}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const text = resp.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(text).questions || [];
  } catch {
    console.error(`Parse error for ${category}:`, text.substring(0, 200));
    return [];
  }
}

async function generateSession(sessionNum: number) {
  const output: string[] = [];
  output.push(`# Тестовая сессия диагностики #${sessionNum}`);
  output.push('');
  output.push(`**Дата генерации:** ${new Date().toISOString().split('T')[0]}`);
  output.push(`**Модель:** ${process.env.TEST_MODEL || 'qwen/qwen3.5-flash-02-23'}`);
  output.push(`**Цель:** Проверка качества вопросов после промпт-тюнинга (Phase 42)`);
  output.push('');

  let questionNum = 0;
  for (const category of CATEGORIES) {
    output.push(`## ${CATEGORY_LABELS[category]} (3 вопроса)`);
    output.push('');

    const chunks = await getChunksForCategory(category, 5);
    const questions = await generateQuestions(category, chunks);

    for (const q of questions) {
      questionNum++;
      output.push(`### Вопрос ${questionNum}`);
      output.push(`**Рубрика:** ${CATEGORY_LABELS[category]} | **Сложность:** ${q.difficulty || 'medium'}`);
      output.push('');
      output.push(`> ${q.question}`);
      output.push('');
      output.push('| # | Вариант | Правильный |');
      output.push('|---|---------|-----------|');
      for (let i = 0; i < (q.options || []).length; i++) {
        output.push(`| ${String.fromCharCode(65 + i)} | ${q.options[i]} | ${i === q.correctIndex ? '✓' : ''} |`);
      }
      output.push('');
      if (q.explanation) output.push(`**Объяснение:** ${q.explanation}\n`);
    }
  }

  output.push('---\n');
  output.push('## Чеклист для ревью\n');
  output.push('| # | Критерий | ОК? | Комментарий |');
  output.push('|---|----------|-----|-------------|');
  output.push('| 1 | Рубрики соответствуют содержанию | | |');
  output.push('| 2 | Нет вопросов о сертификатах/плагинах/биддере | | |');
  output.push('| 3 | Все 4 варианта правдоподобны | | |');
  output.push('| 4 | Указана площадка (WB/Ozon) где нужно | | |');
  output.push('| 5 | Нет выдуманных терминов | | |');
  output.push('| 6 | Вопросы практические | | |');
  output.push('| 7 | Формулировки профессиональные | | |');

  const modelSlug = (process.env.TEST_MODEL || 'qwen').split('/').pop()?.replace(/[^a-z0-9-]/gi, '') || 'qwen';
  const filename = `docs/test-session-${modelSlug}-${sessionNum}.md`;
  fs.writeFileSync(filename, output.join('\n'), 'utf-8');
  console.log(`Session ${sessionNum}: ${questionNum} questions → ${filename}`);
}

async function main() {
  for (let i = 1; i <= 3; i++) {
    console.log(`Generating session ${i}...`);
    await generateSession(i);
  }
  await prisma.$disconnect();
  console.log('\nФайлы для Милы: docs/test-session-{1,2,3}.md');
}

main().catch(console.error);
