// One-off: apply manual overrides for m01_intro + m08_neurointegrator to v3 JSON.
// Reason: positional alg fails when hidden lessons are interleaved (m01) or
// when files are not in lesson-order (m08).
import { readFileSync, writeFileSync, statSync } from 'fs';
import { execSync } from 'child_process';

interface Selected {
  localPath: string;
  filename: string;
  durationSeconds: number;
  durationFormatted: string;
  bucketSize: 'short' | 'medium' | 'long';
  module: string;
  category: 'theory' | 'ui_demo' | 'mpstats_cabinet';
  lessonId: string;
  lessonTitle: string;
  platformUrl: string;
}

const MANUAL: Record<string, Array<{filename: string; lessonId: string; lessonTitle: string}>> = {
  m01_intro: [
    { filename: '002_1_instrumenty_besplatnye_vs_platnye._vpn_risk_ili.mp4', lessonId: '03_ai_m01_intro_003', lessonTitle: 'Инструменты Бесплатные vs Платные. VPN Риск или необходимость' },
    { filename: '002_1_ustanovka_i_nastroyka_platnyh_vpn.mp4', lessonId: '03_ai_m01_intro_006', lessonTitle: 'Pepper VPN | Установка и настройка платных VPN, 1' },
    { filename: '002_3_ustanovka_i_nastroyka_platnyh_vpn.mp4', lessonId: '03_ai_m01_intro_004', lessonTitle: 'Дядя Ваня VPN | Установка и настройка платных VPN, 2' },
    { filename: '003_1_bezopasnye_sposoby_oplaty_servisov_neyrosetey.mp4', lessonId: '03_ai_m01_intro_007', lessonTitle: 'Бот Fastpay.Today | Безопасные способы оплаты сервисов нейросетей, 1' },
    { filename: '003_1_neyrolikbez_chatgpt_kandinsky_i_drugie_zveri.mp4', lessonId: '03_ai_m01_intro_008', lessonTitle: 'НейроЛикбез ChatGPT, Kandinsky и другие звери' },
    { filename: '003_2_kak_oplatit_neyroseti_v_2026_godu.mp4', lessonId: '03_ai_m01_intro_009', lessonTitle: 'Как оплатить нейросети в 2026 году' },
    { filename: '003_3_bezopasnye_sposoby_oplaty_servisov_neyrosetey.mp4', lessonId: '03_ai_m01_intro_010', lessonTitle: 'Бот Foreign Pay | Безопасные способы оплаты сервисов нейросетей, 2' },
    { filename: '004_nastroyka_chatgpt_pod_svoi_zadachi.mp4', lessonId: '03_ai_m01_intro_011', lessonTitle: 'Настройка ChatGPT под свои задачи' },
    { filename: '005_magiya_promtov_kak_neyroset_poymet_zadachu.mp4', lessonId: '03_ai_m01_intro_012', lessonTitle: 'Магия Промтов: Как нейросеть поймет задачу' },
    { filename: '007_layfhaki_tochnyh_zaprosov_k_neyroseti_validatsiya.mp4', lessonId: '03_ai_m01_intro_015', lessonTitle: 'Лайфхаки точных запросов к нейросети: валидация и контроль качества' },
    // 008_kontentnaya_voronka → m01_intro_016 already-ingested in pilot, skip
  ],
  m08_neurointegrator: [
    { filename: '002_anatomiya_gpt_assistenta_iz_chego_on_sostoit.mp4', lessonId: '03_ai_m08_neurointegrator_002', lessonTitle: 'Анатомия GPT-ассистента: из чего он состоит' },
    { filename: '003_bystryy_start_biblioteka_agentov_pod_mp_zadachi.mp4', lessonId: '03_ai_m08_neurointegrator_003', lessonTitle: 'Библиотека агентов ChatGPT под MП-задачи' },
    { filename: '005_1_assistenty_dlya_orgvoprosov_i_komandnoy_raboty.mp4', lessonId: '03_ai_m08_neurointegrator_004', lessonTitle: 'Ассистенты ChatGPT для оргвопросов и командной работы' },
    { filename: '005_2_finalnaya_praktika_po_sozdaniyu_neyroassistenta.mp4', lessonId: '03_ai_m08_neurointegrator_005', lessonTitle: 'Практика создания НейроАссистента в ChatGPT' },
    { filename: '4_sobiraem_assistenta_pod_zadachu_ot_tseli_do_inst.mp4', lessonId: '03_ai_m08_neurointegrator_006', lessonTitle: 'Собираем ассистента в ChatGPT под задачу: от цели до инструкций' },
  ],
};

function durationFmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function bucketize(s: number): 'short' | 'medium' | 'long' {
  return s < 900 ? 'short' : s < 2400 ? 'medium' : 'long';
}
function categorize(b: 'short' | 'medium' | 'long'): 'theory' | 'ui_demo' | 'mpstats_cabinet' {
  return b === 'short' ? 'theory' : b === 'medium' ? 'ui_demo' : 'mpstats_cabinet';
}
function probeDuration(localPath: string): number {
  const out = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${localPath}"`, { encoding: 'utf8' }).trim();
  return Math.round(parseFloat(out));
}

const v3Path = 'scripts/vision-ingest/results/selected-sprint2c-v3-lessons.json';
const v3 = JSON.parse(readFileSync(v3Path, 'utf8')) as Selected[];

const filtered = v3.filter(l => l.module !== 'm01_intro' && l.module !== 'm08_neurointegrator');
console.log(`v3 total: ${v3.length}, dropped m01+m08: ${v3.length - filtered.length}, remaining: ${filtered.length}`);

const courseRoot = 'E:/Academy Courses/03_ai';
for (const [module, entries] of Object.entries(MANUAL)) {
  for (const e of entries) {
    const localPath = `${courseRoot}/${module}/${e.filename}`;
    try { statSync(localPath); } catch { console.error(`MISSING FILE: ${localPath}`); process.exit(1); }
    const sec = probeDuration(localPath);
    const bucket = bucketize(sec);
    filtered.push({
      localPath,
      filename: e.filename,
      durationSeconds: sec,
      durationFormatted: durationFmt(sec),
      bucketSize: bucket,
      module,
      category: categorize(bucket),
      lessonId: e.lessonId,
      lessonTitle: e.lessonTitle,
      platformUrl: `https://platform.mpstats.academy/learn/${e.lessonId}`,
    });
    console.log(`  + ${module}/${e.filename} -> ${e.lessonId}`);
  }
}

filtered.sort((a, b) => a.lessonId.localeCompare(b.lessonId));

const ids = new Set<string>();
const dupes: string[] = [];
for (const l of filtered) {
  if (ids.has(l.lessonId)) dupes.push(l.lessonId);
  ids.add(l.lessonId);
}
if (dupes.length) { console.error('DUPLICATES:', dupes); process.exit(1); }

const outPath = 'scripts/vision-ingest/results/selected-sprint2c-final-lessons.json';
writeFileSync(outPath, JSON.stringify(filtered, null, 2), 'utf8');
console.log(`\nFinal: ${filtered.length} lessons, ${ids.size} unique -> ${outPath}`);
