# Kinescope Upload — Batch Upload Plan

## Status: ✅ COMPLETE (405/405 videos, 100%)
**Last updated:** 2026-02-21
**Completed:** 2026-02-20

## Verification (2026-02-21)

- Kinescope API: 405 videos, all status `done`
- Progress JSON: 405 uploaded entries
- DB dry-run: 405 lessons skipped (all have videoId)

## Resolved Issues

- `01_analytics_m00_bonus_autobidder_001` — stale videoId cleared, re-uploaded successfully
- `03_ai_m04_neurovideo_004` — video uploaded but DB connection dropped; videoId found via API and set manually
- `04_workshops_w01_feb_ads_001` (den_1.mp4) — uploaded manually, renamed from "den_1" to "День 1" via API

## TUS Protocol (proven working)

Two-step: POST /v2/init → get Location → PATCH with streaming body.
- `parent_id` in metadata = folder ID (video goes into that folder on Kinescope)
- `init_id` = random UUID that becomes the Kinescope video ID
- Upload uses `ReadableStream` (streaming) — не загружает файл целиком в RAM
- При ошибке `already exists` — скрипт удаляет orphan и генерирует новый initId

## Kinescope Project Structure

```
MPSTATS ACADEMY (project: ad127c11-6187-4fe2-bbfa-16f0d708a41c)
├── 01_analytics/  (folder: 71777756-e93a-4484-87eb-570c7588640f)
├── 02_ads/        (folder: 97d2cadb-4e63-4eb5-9d50-195d71436f20)
├── 03_ai/         (folder: 639d0266-4fa8-4e0f-93e1-4128d1ba6283)
├── 04_workshops/  (folder: 97b9a298-2fd9-4730-b63a-57991dbd2d0d)
├── 05_ozon/       (folder: 6d3dbe29-028c-4d13-8554-8367a91c5992)
└── 06_express/    (folder: 865be5b0-c6f7-4a44-a4da-6684dd78e695)
```

Folder IDs hardcoded in `scripts/kinescope-upload.ts` → `COURSE_FOLDER_IDS`.

## Batch Upload Plan

### Batch Summary

| # | Course | Videos | Size | Command | Status |
|---|--------|--------|------|---------|--------|
| 1 | 01_analytics | 82 | 33.4 GB | `--course 01_analytics` | ✅ 82/82 complete |
| 2 | 02_ads | 67 | 24.1 GB | `--course 02_ads` | ✅ 67/67 complete |
| 3 | 03_ai | 92 | 22.4 GB | `--course 03_ai` | ✅ 92/92 complete |
| 4 | 04_workshops | 24 | 68.2 GB | `--course 04_workshops` | ✅ 24/24 complete |
| 5 | 05_ozon | 76 | 31.9 GB | `--course 05_ozon` | ✅ 76/76 complete |
| 6 | 06_express | 64 | 32.2 GB | `--course 06_express` | ✅ 64/64 complete |
| | **TOTAL** | **405** | **212.2 GB** | | **405/405 (100%)** |

### Useful Flags

| Flag | Description |
|------|-------------|
| `--status` | Show batch progress without uploading |
| `--course X` | Upload only one course batch |
| `--limit N` | Upload first N videos (for testing) |
| `--dry-run` | Show what would be uploaded |

## Script Features

- **Auto-resume:** Reads `kinescope-upload-progress.json`, skips already-uploaded
- **DB check:** Also checks `Lesson.videoId` in Supabase — skips if already set
- **Folder organization:** Videos go into course folders on Kinescope via `parent_id`
- **Streaming upload:** Uses `ReadableStream` instead of loading file into memory (fixes >1.5 GB files)
- **Dynamic timeout:** 3min base + 1.5min per 100MB
- **Retry:** 3 attempts with exponential backoff (3s, 6s, 12s)
- **Orphan cleanup:** On `already exists` error, deletes orphan + waits 5s + new initId
- **Sort:** Small files first within each batch (faster initial feedback)
- **Atomic progress:** Saves after each upload (safe to Ctrl+C)

## Bugs Fixed During This Session (2026-02-18)

1. **dotenv override** — корневой `.env` имел пустые KINESCOPE_* → добавлен `override: true`
2. **Duplicate videos** — retry генерировал новый `initId` каждый раз → исправлено: один `initId` на файл
3. **API key permissions** — старый ключ не имел прав на удаление → обновлён на full-access
4. **Large file uploads** — `fs.readFileSync` для >1.5 GB падал → заменён на `ReadableStream` streaming
5. **`already exists` race condition** — cleanup + 5s wait перед новым init

## Kinescope Storage Note

Kinescope хранит original + транскодированные версии (1080p, 480p).
Реальное потребление диска ≈ 1.8-2x от размера оригиналов.
33 GB originals → ~63 GB on Kinescope (normal behavior).

## Upload Timeline

- **2026-02-18:** Sessions 1-2 — 01_analytics (81/82), 02_ads (67/67) — 148 videos
- **2026-02-19:** Session 3 — 03_ai (92/92) — 240 videos
- **2026-02-20:** Session 4 — fixes + 04_workshops (24/24), 05_ozon (76/76), 06_express (64/64) — 405 videos
- **2026-02-21:** Final verification — all 405 confirmed on Kinescope and in DB
