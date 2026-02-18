/**
 * Export questions to CSV for team review.
 *
 * Usage:
 *   pnpm tsx scripts/seed/export-questions-csv.ts                    # Export current mock bank
 *   pnpm tsx scripts/seed/export-questions-csv.ts --source generated # Export AI-generated file
 *
 * Output: scripts/seed/output/questions-{source}-{date}.csv
 */

import * as fs from 'fs';
import * as path from 'path';

const sourceArg = process.argv.includes('--source')
  ? process.argv[process.argv.indexOf('--source') + 1]
  : 'current';

// Dynamically import the questions file (use pathToFileURL for Windows compatibility)
import { pathToFileURL } from 'url';

async function loadQuestions() {
  if (sourceArg === 'generated') {
    const genPath = path.resolve(__dirname, '../../packages/api/src/mocks/questions.generated.ts');
    if (!fs.existsSync(genPath)) {
      console.error('questions.generated.ts not found. Run seed script first.');
      process.exit(1);
    }
    const mod = await import(pathToFileURL(genPath).href);
    return { questions: mod.MOCK_QUESTIONS, label: 'ai-generated' };
  } else {
    const mockPath = path.resolve(__dirname, '../../packages/api/src/mocks/questions.ts');
    const mod = await import(pathToFileURL(mockPath).href);
    return { questions: mod.MOCK_QUESTIONS, label: 'current-mock' };
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
  skillCategory: string;
}

function toCsv(questions: Question[]): string {
  const headers = [
    'ID',
    'Категория',
    'Сложность',
    'Вопрос',
    'Вариант A',
    'Вариант B',
    'Вариант C',
    'Вариант D',
    'Правильный (A/B/C/D)',
    'Объяснение',
    'OK? (да/нет)',
    'Комментарий',
  ];

  const indexToLetter = ['A', 'B', 'C', 'D'];

  const rows = questions.map((q) => [
    q.id,
    q.skillCategory,
    q.difficulty,
    escapeCsv(q.question),
    escapeCsv(q.options[0]),
    escapeCsv(q.options[1]),
    escapeCsv(q.options[2]),
    escapeCsv(q.options[3]),
    indexToLetter[q.correctIndex],
    escapeCsv(q.explanation),
    '', // OK? column for reviewer
    '', // Comment column for reviewer
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

async function main() {
  const { questions, label } = await loadQuestions();
  console.log(`Loaded ${questions.length} questions (${label})`);

  const date = new Date().toISOString().slice(0, 10);
  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, `questions-${label}-${date}.csv`);
  const csv = toCsv(questions);

  // Write with BOM for Excel to detect UTF-8
  fs.writeFileSync(outputFile, '\ufeff' + csv, 'utf-8');
  console.log(`Written: ${outputFile}`);
  console.log(`\nОткрой в Google Sheets или Excel, отметь колонку "OK?" и "Комментарий"`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
