# Phase 55 Sprint 1 — Vision Chunking RAG PoC

**Date:** 2026-05-06
**Phase:** 55 (Vision Chunking RAG, milestone v1.7)
**Sprint:** 1 of 3 (PoC)
**Status:** Design approved, awaiting implementation plan

## Context

Текущий RAG-индекс ассистента в чате урока построен только из аудио-транскриптов через таблицу `content_chunk`. Если спикер молча показывает экран — ячейку Excel, URL без озвучки, скриншот кабинета MPSTATS — этого нет в индексе. Тестер Мила (2026-05-05) обозначила это как главную боль продукта: «спрашиваю про то что вижу — ассистент молчит». В чат урока временно добавлен дисклеймер про границы RAG.

Phase 55 закрывает разрыв через vision-индексацию ключевых кадров видео. Полная архитектура (3 спринта с гейтами) описана в `.planning/ROADMAP.md` секция «Phase 55». Текущий документ — спек **только Sprint 1 (PoC)**: throwaway-эксперимент за 1-2 дня для решения GO/NO-GO на Sprint 2.

## Goal

За 1-2 дня получить ответ на вопрос: «Какая VLM-модель адекватно описывает наш контент, и стоит ли вообще идти в Sprint 2 (Pilot)?»

Sprint 1 — throwaway-эксперимент, не production-код. Никаких изменений в `apps/web/`, `packages/`, Prisma-схеме или production-pipeline. Только набор скриптов в изолированной папке `scripts/vision-poc/` (4 основных + 1 опциональный helper) и артефакты для gate-решения.

## Definition of Done

Sprint 1 считается завершённым, когда выполнены все пункты:

1. Выбраны **3 видео разной длины** (короткое 3-10 мин / среднее 20-40 мин / воркшоп 1-3 ч) из разных курсов, известны их `lessonId` и URL на платформе.
2. Из каждого видео извлечено `30-120` кадров через ffmpeg scene-detection с adaptive cap, из них взято **по 10 равномерно** для PoC-теста (итого 30 кадров).
3. 30 кадров прогнаны через **3 VLM** (Gemini 2.5 Flash Lite / Gemini 3.1 Flash Lite Preview / GPT-4.1 mini) → 90 ответов с замером фактической стоимости.
4. Те же 30 кадров прогнаны через локальный **tesseract OCR** как контрольный baseline на URL/числах.
5. Проведён ручной sanity-check 90 VLM-ответов: систематические галлюцинации, ошибки на таблицах, неинформативные описания. Результат — `comparison.md`.
6. Подготовлен пакет для Милы: 3 урока на платформе (URL + тайм-коды) + чек-лист из 20 «визуальных» вопросов + 1-страничная инструкция.
7. Получен заполненный чек-лист от Милы, посчитан accuracy на **best model** (модель с минимальным hallucination rate по итогам ручного sanity-check на шаге 5).
8. Принято gate-решение **GO / NO-GO / RETRY** на Sprint 2, зафиксировано в `decision.md`, закоммичено.

## Out of Scope (Sprint 1)

Явно не делаем в Sprint 1, оставляем на Sprint 2-3:

- Изменения схемы Prisma (`source_type`, `frame_url`, `metadata` на `content_chunk`)
- Embedding кадров через `text-embedding-3-small`
- INSERT в Supabase `content_chunk`
- Изменения `packages/ai/src/retrieval.ts` (mixed search)
- Изменения `packages/ai/src/generation.ts` (context builder для кадров)
- UI обновления `SourceTooltip` (превью кадра, seek по тайм-коду)
- Интеграция в production ingest pipeline нового урока
- PII / privacy фильтры (решение: не делаем — что показано на эфире, можно перемотать и переписать)
- Обновление дисклеймера в чате (делаем после Sprint 3)

## Architecture

### Components

Все компоненты в `scripts/vision-poc/` — изолированная throwaway-папка. После Sprint 3 архивируется или удаляется.

#### `select-videos.ts`

Выбирает 3 видео из `E:/Academy Courses` по критериям длительности и наличия screen-share, резолвит соответствующие `lessonId` и URL на платформе.

**Логика:**
- Прочитать `manifest.json` или `_rename_map.json` из `E:/Academy Courses` для маппинга файлов к курсам
- Получить длительность каждого файла через `ffprobe -v error -show_entries format=duration`
- Распределить файлы по бакетам: `short` (180-600 с), `medium` (1200-2400 с), `long` (3600-10800 с)
- Из каждого бакета выбрать по одному файлу, желательно из разных курсов (приоритет: `01_analytics`, `03_ai`, `04_workshops`)
- Зарезолвить `lessonId` через прямой Supabase Management API SQL: `SELECT id, slug, title, "courseId" FROM "Lesson" WHERE title ILIKE '%fragment%' OR "kinescopeId" = '...'`
- Если fuzzy match не сработал — fallback на ручной ввод соответствия

**Output:** `scripts/vision-poc/results/selected-videos.json`

```json
[
  {
    "localPath": "E:/Academy Courses/03_ai/03_ai_001_intro.mp4",
    "duration": "07:23",
    "durationSeconds": 443,
    "bucket": "short",
    "courseSlug": "ai-tools",
    "courseTitle": "AI-инструменты",
    "lessonId": "abc-123",
    "lessonTitle": "Введение в AI-инструменты",
    "platformUrl": "https://platform.mpstats.academy/learn/ai-tools/abc-123"
  }
]
```

#### `extract-frames.ts`

Запускает ffmpeg для каждого выбранного видео с adaptive scene-detection и min interval, генерирует JPG-кадры с тайм-кодами в имени файла.

**Логика:**
- Команда ffmpeg первой попыткой:
  ```
  ffmpeg -i {video} -vf "select='gt(scene,0.3)*gte(t-prev_selected_t,10)',showinfo" -vsync vfr {outDir}/frame_%04d.jpg
  ```
- Парсить timestamp каждого кадра из stderr (`pts_time:`) для именования файлов
- Если `frames.length > 120` — повторить с threshold 0.5, потом 0.7
- Если после threshold 0.7 всё ещё `> 120` — равномерно sub-sample до 120
- Из всего набора взять **равномерно 10 кадров** для PoC-теста (slice по индексу)

**Output:**
- `scripts/vision-poc/results/frames/{lessonId}/frame_{seq}_{timecode}.jpg`
- `scripts/vision-poc/results/frames-manifest.json`:

```json
{
  "videos": [
    {
      "lessonId": "abc-123",
      "totalFramesExtracted": 47,
      "thresholdUsed": 0.3,
      "selectedForPoC": 10,
      "frames": [
        {"seq": 1, "timecode": "00:12", "path": "frames/abc-123/frame_001_00-12.jpg"}
      ]
    }
  ]
}
```

#### `run-vlm.ts`

Прогоняет 30 кадров (3 урока × 10) через 3 VLM-модели через OpenRouter, замеряет фактическую стоимость.

**Логика:**
- Читает API key из `E:/Academy Courses/OpenRouter_Api_key.txt` (env var `OPENROUTER_POC_KEY`)
- Для каждой модели × каждого кадра — единый промпт из `scripts/vision-poc/prompts/frame-describe.txt`
- Промпт (v1):
  ```
  Опиши что показано на кадре. Формат ответа — строго JSON:

  {
    "type": "slide" | "interface" | "table" | "code" | "video" | "other",
    "summary": "1-2 предложения общего описания",
    "extracted": {
      "urls": ["полный URL дословно если виден"],
      "numbers": ["числа из таблиц или интерфейсов с указанием контекста"],
      "tools": ["название инструмента/сервиса/программы"],
      "other": ["прочие важные детали"]
    }
  }

  Правила:
  - Если не уверен в значении (мелкий текст, размытость) — пиши "не разобрать"
  - НЕ выдумывай конкретные числа, URL или имена если не видишь их чётко
  - Для таблиц извлекай данные построчно
  - URL извлекай дословно, не сокращай
  ```
- Параллельные запросы с rate limit 5 req/s через очередь
- Замер `usage.prompt_tokens`, `usage.completion_tokens`, расчёт стоимости через прайс OpenRouter

**Output:** `scripts/vision-poc/results/vlm-runs.json`

```json
{
  "models": ["google/gemini-2.5-flash-lite", "google/gemini-3.1-flash-lite-preview", "openai/gpt-4.1-mini"],
  "totalCostUSD": {
    "google/gemini-2.5-flash-lite": 0.012,
    "google/gemini-3.1-flash-lite-preview": 0.058,
    "openai/gpt-4.1-mini": 0.041
  },
  "results": [
    {
      "frameId": "abc-123/frame_001",
      "model": "google/gemini-2.5-flash-lite",
      "response": {"type": "slide", "summary": "...", "extracted": {...}},
      "tokensIn": 1024,
      "tokensOut": 187,
      "costUSD": 0.0004,
      "latencyMs": 1840
    }
  ]
}
```

#### `run-ocr.ts`

Прогоняет те же 30 кадров через локальный tesseract как контрольный baseline.

**Логика:**
- Команда: `tesseract {frame.jpg} - -l rus+eng --psm 6`
- Вытащить URL через regex (`https?://[^\s]+`) и числа через regex (`\b\d+([.,]\d+)?\b`) из raw текста
- Никаких API, всё локально

**Output:** `scripts/vision-poc/results/ocr-runs.json`

```json
[
  {
    "frameId": "abc-123/frame_001",
    "rawText": "...",
    "extractedUrls": ["https://mpstats.io/wb/categories"],
    "extractedNumbers": ["1234", "56.78"]
  }
]
```

#### `analyze.ts` (опциональный helper)

Сводный скрипт, который читает `vlm-runs.json` + `ocr-runs.json` и генерит черновик `comparison.md` (таблица per-frame: VLM-описание trio, OCR raw, ручная пометка). Финальный анализ всё равно правлю руками.

### Configuration

`scripts/vision-poc/config.ts`:

```typescript
export const POC_CONFIG = {
  duration_buckets: {
    short: [180, 600],
    medium: [1200, 2400],
    long: [3600, 10800],
  },
  scene_threshold_initial: 0.3,
  scene_threshold_steps: [0.5, 0.7],
  min_interval_seconds: 10,
  frames_cap_per_video: 120,
  frames_for_poc_sample: 10,
  vlm_models: [
    'google/gemini-2.5-flash-lite',
    'google/gemini-3.1-flash-lite-preview',
    'openai/gpt-4.1-mini',
  ],
  vlm_fallback_if_preview_unavailable: 'google/gemini-2.5-flash',
  rate_limit_rps: 5,
  ocr_languages: 'rus+eng',
  ocr_psm: 6,
};
```

### Data Flow

```
E:/Academy Courses/{course}/*.mp4
        |
        v
[select-videos.ts] -- запросы Supabase Mgmt API
        |
        v
selected-videos.json (3 видео)
        |
        v
[extract-frames.ts] -- ffmpeg + adaptive cap
        |
        v
results/frames/{lessonId}/*.jpg + frames-manifest.json
        |
        +-------------------+-------------------+
        |                                       |
        v                                       v
[run-vlm.ts] x 3 модели              [run-ocr.ts] x tesseract
        |                                       |
        v                                       v
vlm-runs.json                          ocr-runs.json
        |                                       |
        +-------------------+-------------------+
                            |
                            v
                  [ручной анализ Claude]
                            |
                            v
                    comparison.md
                            |
                            v
              [сборка пакета для Милы]
                            |
                            v
                  mila-package/
                  - checklist.md (~20 вопросов)
                  - instructions.md (1 страница)
                            |
                            v
              [Мила тестирует на платформе]
                            |
                            v
              заполненный чек-лист от Милы
                            |
                            v
                       decision.md
                  (GO / NO-GO / RETRY)
```

### Storage Layout

```
MAAL/
└── scripts/
    └── vision-poc/
        ├── select-videos.ts
        ├── extract-frames.ts
        ├── run-vlm.ts
        ├── run-ocr.ts
        ├── analyze.ts
        ├── config.ts
        ├── prompts/
        │   └── frame-describe.txt
        ├── results/
        │   ├── selected-videos.json         (gitignored)
        │   ├── frames/                       (gitignored)
        │   │   └── {lessonId}/*.jpg
        │   ├── frames-manifest.json          (gitignored)
        │   ├── vlm-runs.json                 (gitignored)
        │   ├── ocr-runs.json                 (gitignored)
        │   ├── comparison.md                 (committed)
        │   ├── decision.md                   (committed)
        │   └── mila-package/                 (committed)
        │       ├── checklist.md
        │       └── instructions.md
        └── README.md
```

`.gitignore` дополнения:

```
scripts/vision-poc/results/frames/
scripts/vision-poc/results/selected-videos.json
scripts/vision-poc/results/frames-manifest.json
scripts/vision-poc/results/vlm-runs.json
scripts/vision-poc/results/ocr-runs.json
```

### External Dependencies

| Зависимость | Источник | Проверка |
|---|---|---|
| `ffmpeg` + `ffprobe` | Системно (Windows: scoop / chocolatey) | `ffmpeg -version` |
| `tesseract` + `rus+eng` traineddata | UB-Mannheim build | `tesseract --version --list-langs` |
| OpenRouter API key | `E:/Academy Courses/OpenRouter_Api_key.txt` → env `OPENROUTER_POC_KEY` | Quick check на 1 кадре |
| Supabase Management API token | `.claude/memory/reference_supabase_mgmt.md` → env `SUPABASE_MGMT_TOKEN` | для запросов Lesson |

## Success Criteria

| # | Критерий | Метод замера | Порог |
|---|---|---|---|
| **SC1** | Pipeline работает технически end-to-end | Все 4 скрипта проходят без ошибок на 3 видео | binary pass/fail |
| **SC2** | Scene detection не ломается на разных длинах | `frames_extracted` для воркшопа в реалистичном диапазоне после adaptive | 30 ≤ frames ≤ 120 |
| **SC3** | Прогноз стоимости full-pass сходится с теорией | Экстраполяция 30 кадров × модель → 20K кадров платформы | отклонение ≤ 50% от роадмеп-прикидки |
| **SC4** | VLM не галлюцинирует систематически | Ручной sanity-check 90 ответов — % явных hallucinations на best model | ≤ 20% |
| **SC5** | OCR vs VLM на URL/числах | Сверка на ~10 кадрах с явными URL/таблицами | OCR accuracy на URL ≥ VLM accuracy |
| **SC6** | Мила/чек-лист подтверждают качество | Заполненный чек-лист на best model | accuracy ≥ 70% |

SC5 — архитектурный гейт, не go/no-go: его результат определяет, объединяем ли VLM+OCR в Sprint 2 или используем VLM-only.

## Gate Decision Tree

```
SC1 (pipeline работает)?
  NO  → STOP. Чинить технику. Не идём в gate.
  YES → SC2-SC3 (sane numbers)?
          NO  → пересмотреть config (cap, threshold). Повтор PoC.
          YES → SC4 (≤20% hallucinations on best model)?
                  NO  → NO-GO Sprint 2.
                        Action: переосмыслить промпт / др модель / OCR-only baseline.
                  YES → SC6 (Мила ≥70%)?
                          NO 50-70% → итерируем промпт, повтор теста Милы (≤2 итерации)
                          NO <50%   → NO-GO Sprint 2.
                          YES       → GO Sprint 2.
                                      Зафиксирована модель X.
                                      Пишется отдельный спек на Sprint 2.
```

`decision.md` — формальный gate-артефакт, фиксирует результаты SC1-SC6 + выбранную модель + отвергнутые варианты с причинами + дальнейшие шаги. Коммитим даже при NO-GO.

## Timeline

| День | Этап | Длительность |
|---|---|---|
| D1 утро | Setup: ffmpeg/tesseract, OpenRouter ключ | 30 мин |
| D1 утро | `select-videos.ts` + резолв lessonId | 1 ч |
| D1 день | `extract-frames.ts` на 3 видео | 1 ч |
| D1 день | `run-vlm.ts` (30 × 3 модели) | 30-60 мин |
| D1 вечер | `run-ocr.ts` | 15 мин |
| D1 вечер | Ручной sanity-check, `comparison.md` | 1-2 ч |
| D2 утро | Пакет для Милы | 1 ч |
| D2 день | Передача Миле, ожидание | её работа |
| D2 вечер | Анализ результатов, `decision.md` | 30 мин |

**Активного времени:** ~6-8 часов наших + 1 рабочий день у Милы.
**Календарно:** 2-4 дня в зависимости от скорости ответа Милы.

## Risks & Mitigations

| Риск | Вероятность | Impact | Mitigation |
|---|---|---|---|
| R1: ffmpeg/tesseract не установлены или несовместимая версия | Medium | Low | Проверка на setup, scoop install за 30 мин |
| R2: select-videos не резолвит lessonId через fuzzy | Medium | Medium | Fallback на ручное соответствие через транскрипты, +30 мин |
| R3: Воркшоп >120 кадров после adaptive 0.7 | Low | Low | Принудительный sub-sample до 120 в config |
| R4: OpenRouter ключ Academy Courses не имеет vision-доступа | Medium | Medium | Quick check на 1 кадре в начале, fallback на prod ключ или sub-key от Егора |
| R5: Gemini 3.1 Flash Lite Preview задеприкейчена/rate limit | Low | Low | Fallback на Gemini 2.5 Flash full ($20 full-pass) — конфиг меняется одной строкой |
| R6: Мила недоступна или отвечает позже ожидаемого | High | Medium | Self-explanatory пакет, чёткий дедлайн 1 день. Задержка >3 дней — gate откладывается, не блокирует параллельную работу |
| R7: Все 3 модели галлюцинируют систематически (>30%) | Medium | High | Это NO-GO сценарий, не баг. `decision.md` фиксирует, Phase 55 откладывается. Экономим недели на Sprint 2-3. |
| R8: PoC даёт пограничный 60-70% accuracy | High | Medium | Чёткий Gate Decision Tree: ≤2 итерации промпта, потом NO-GO. Не зависаем. |
| R9: Стоимость PoC за разумные рамки | Very Low | Very Low | 30 × 3 × ~$0.001 = ~$0.10 |

### Что не риск (явно)

- Кодовая безопасность — никаких изменений в `apps/web/`, `packages/`, Prisma. Прод не тронут.
- CI/деплой — никаких новых workflow или деплоев.
- Конфликты с Phase 53A (awaiting merge), Phase 47 (planned) — нет, работаем в изолированной папке `scripts/vision-poc/`.

## Branch & PR Strategy

- **Ветка:** `phase-55-sprint-1-poc` от текущего `master`
- **Коммиты:**
  - chore(vision-poc): scaffold scripts and config
  - feat(vision-poc): video selection with Lesson resolution
  - feat(vision-poc): ffmpeg frame extraction with adaptive capping
  - feat(vision-poc): VLM trio runner via OpenRouter
  - feat(vision-poc): tesseract OCR baseline
  - docs(vision-poc): comparison + Mila package
  - docs(vision-poc): Sprint 1 gate decision
- **PR:** в `master` после gate decision (даже при NO-GO — фиксируем артефакты как доказательство решения)

## Test Plan для Милы

Пакет в `scripts/vision-poc/results/mila-package/`:

### `instructions.md` (1 страница)

- Зачем тестируем (одна фраза: «Проверяем умеет ли ассистент отвечать про то, что показано на экране в видео»)
- Что нужно сделать: открыть 3 урока на платформе, для каждого вопроса в чек-листе перейти на указанный тайм-код, спросить ассистента в чате, заполнить графу «Корректно / Partial / Неверно»
- Сколько займёт: ~30-45 минут
- Дедлайн: 1 рабочий день (если задержка — предупредить)
- Куда вернуть: заполненный `checklist.md` обратно в чат

### `checklist.md`

20 вопросов в Markdown-таблице, разбитых по категориям:

- **URL/ссылки на экране** (~5 вопросов) — «Какая ссылка показана на 02:14?»
- **Числа в таблицах/графиках** (~7 вопросов) — «Какое значение в столбце "Выручка" на 15:30?»
- **Названия инструментов/кнопок/полей** (~5 вопросов) — «Какой раздел открыт в кабинете на 22:10?»
- **Скриншоты кабинета MPSTATS** (~3 вопроса) — «Какие фильтры установлены на 35:42?»

Формат таблицы:

```md
| # | Урок | Тайм-код | Вопрос | Ответ ассистента | Корректно? (Y/Partial/N) | Комментарий |
|---|------|----------|--------|------------------|--------------------------|-------------|
| 1 | AI-инструменты, урок X | 02:14 | Какая ссылка показана? | (заполняет ассистент в чате — Мила копирует) | | |
```

## References

- `.planning/ROADMAP.md` — Phase 55 полная архитектура (3 спринта)
- `.claude/memory/MEMORY.md` — индекс project memory
- `.claude/memory/reference_supabase_mgmt.md` — SQL endpoint для резолва Lesson
- Предыдущая сессия 2026-05-05 — записана в CLAUDE.md (Phase 55 запись в roadmap, дисклеймер в чате)

## Open Questions Resolved

| # | Вопрос | Решение |
|---|---|---|
| 1 | Источник видео | Локальный `E:/Academy Courses` (405 mp4 файлов проверены) |
| 2 | VLM API | OpenRouter, ключ из `E:/Academy Courses/OpenRouter_Api_key.txt` |
| 3 | Контрольный датасет | Мы готовим (3 видео + 20 вопросов + чек-лист), Мила проверяет |
| 4 | Privacy/PII фильтры | Не делаем — что показано на эфире, можно перемотать и переписать |

## Next Steps After Approval

1. Self-review этого документа
2. User review gate
3. Invoke `superpowers:writing-plans` skill для создания implementation plan
4. Создать ветку `phase-55-sprint-1-poc` от master
5. Реализовать по плану
