// scripts/vision-poc/run-ocr.ts
// Tesseract OCR baseline over frames-manifest.json. Writes results/ocr-runs.json.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { POC_CONFIG } from './config';

interface ManifestFrame {
  seq: number;
  timecode: string;
  pts: number;
  path: string;
}

interface ManifestVideo {
  lessonId: string;
  totalFramesExtracted: number;
  intervalSeconds: number;
  selectedForPoC: number;
  frames: ManifestFrame[];
}

interface Manifest {
  videos: ManifestVideo[];
}

interface OcrEntry {
  lessonId: string;
  seq: number;
  timecode: string;
  framePath: string;
  rawText: string;
  rawTextLength: number;
  extractedUrls: string[];
  extractedNumbers: string[];
  durationMs: number;
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const NUMBER_RE = /\b\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d+)?\b|\b\d+[.,]\d+\b|\b\d{2,}\b/g;

function extractUrls(text: string): string[] {
  return Array.from(new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[).,;]+$/, ''))));
}

function extractNumbers(text: string): string[] {
  return Array.from(new Set(text.match(NUMBER_RE) ?? []));
}

function runTesseract(imagePath: string): string {
  const res = spawnSync(
    POC_CONFIG.tesseract_binary,
    [
      imagePath,
      '-',
      '-l', POC_CONFIG.ocr_languages,
      '--tessdata-dir', POC_CONFIG.tessdata_dir,
      '--psm', String(POC_CONFIG.ocr_psm),
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  if (res.status !== 0) {
    throw new Error(`tesseract failed: ${(res.stderr ?? '').slice(0, 300)}`);
  }
  return res.stdout;
}

function main() {
  const resultsDir = POC_CONFIG.results_dir;
  const manifestPath = join(resultsDir, 'frames-manifest.json');
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const entries: OcrEntry[] = [];
  let totalFrames = 0;
  for (const v of manifest.videos) totalFrames += v.frames.length;
  console.log(`Running tesseract on ${totalFrames} frames across ${manifest.videos.length} videos...`);

  let processed = 0;
  for (const video of manifest.videos) {
    for (const frame of video.frames) {
      const absPath = resolve(resultsDir, frame.path);
      const t0 = Date.now();
      let rawText = '';
      try {
        rawText = runTesseract(absPath);
      } catch (err) {
        console.error(`[${video.lessonId} #${frame.seq}] ${(err as Error).message}`);
      }
      const durationMs = Date.now() - t0;
      const cleaned = rawText.trim();
      const entry: OcrEntry = {
        lessonId: video.lessonId,
        seq: frame.seq,
        timecode: frame.timecode,
        framePath: frame.path,
        rawText: cleaned,
        rawTextLength: cleaned.length,
        extractedUrls: extractUrls(cleaned),
        extractedNumbers: extractNumbers(cleaned),
        durationMs,
      };
      entries.push(entry);
      processed += 1;
      console.log(
        `[${processed}/${totalFrames}] ${video.lessonId} #${frame.seq} ${frame.timecode} ` +
          `len=${entry.rawTextLength} urls=${entry.extractedUrls.length} ` +
          `nums=${entry.extractedNumbers.length} (${durationMs}ms)`,
      );
    }
  }

  const outPath = join(resultsDir, 'ocr-runs.json');
  writeFileSync(outPath, JSON.stringify({ entries }, null, 2), 'utf8');

  const nonEmpty = entries.filter((e) => e.rawTextLength >= 20).length;
  console.log(`\nWrote ${entries.length} entries -> ${outPath}`);
  console.log(`Non-empty (>=20 chars): ${nonEmpty}/${entries.length} (${Math.round((nonEmpty / entries.length) * 100)}%)`);
}

main();
