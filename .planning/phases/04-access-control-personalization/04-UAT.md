---
status: complete
phase: 04-access-control-personalization
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-02-25T12:00:00Z
updated: 2026-02-25T12:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Gate banner on lesson page (no diagnostic)
expected: Открой /learn/[id] без диагностики — баннер с замком и CTA вместо видео/саммари/чата. Заголовок, breadcrumb, badge видны.
result: pass

### 2. Full content on lesson page (with diagnostic)
expected: Открой /learn/[id] с диагностикой — видео, AI-саммари и чат отображаются нормально, баннера нет.
result: pass

### 3. Default tab "Все курсы" (no diagnostic)
expected: Открой /learn без диагностики — по умолчанию активна вкладка "Все курсы".
result: pass

### 4. Default tab "Мой трек" (with diagnostic)
expected: Открой /learn с диагностикой — по умолчанию активна вкладка "Мой трек" с рекомендованными уроками.
result: pass

### 5. Track progress bar
expected: В "Мой трек" над списком уроков — прогресс-бар "X/Y уроков завершено" с зелёной полосой.
result: pass

### 6. "Мой трек" empty state (no diagnostic)
expected: Переключись на "Мой трек" без диагностики — CTA-баннер с текстом и кнопкой "Начать диагностику".
result: pass

### 7. Recommended badge on LessonCard
expected: Рекомендованные уроки помечены зелёным бейджем "Рекомендовано" с иконкой галочки.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
