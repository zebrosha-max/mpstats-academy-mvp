# Phase 9: Integration Wire-Up - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Закрытие integration gaps из milestone audit: подключение реальных данных к profile router (история диагностик), верификация seekTo через postMessage API (кликабельные таймкоды в AI-панелях). Виджет прогресса recommended track **отложен** до появления трекинга просмотра видео.

**Scope change:** Success Criteria #2 (dashboard recommended track progress) перенесена в будущую фазу — требует video watch tracking, которого ещё нет.

</domain>

<decisions>
## Implementation Decisions

### История диагностик в профиле
- Wire-up: profile router подключает getCompletedSessions вместо mock данных
- UI: допускается полировка отображения при подключении реальных данных
- Формат данных, навигация по сессиям, уровень детализации — Claude's Discretion

### Прогресс recommended track на dashboard
- **ОТЛОЖЕН** — виджет прогресса не реализуется в этой фазе
- Причина: прогресс урока требует трекинга просмотра видео (video watch events), которого нет
- Показывать "0 из N" бессмысленно — лучше реализовать когда будет реальный трекинг
- SC #2 из ROADMAP переносится в будущую фазу (после video tracking)

### Кликабельные таймкоды (seekTo)
- Где: в AI summary и в AI chat — обе панели
- Визуал: `▶ 02:15` — иконка ▶ + время, цвет mp-blue, выглядит как ссылка
- Поведение при клике: seekTo + autoplay (перемотать и сразу воспроизвести)
- Механизм: postMessage API к Kinescope iframe

### Claude's Discretion
- Набор данных для каждой диагностической сессии в профиле (дата, скор, оси)
- Формат списка сессий и навигация (клик → results page или inline expand)
- График тренда навыков — решить на основе сложности
- Edge case: поведение seekTo когда iframe не загружен или не в viewport

</decisions>

<specifics>
## Specific Ideas

- Таймкоды сейчас отображаются как текст "MM:SS - MM:SS" в AI summary и chat — нужно парсить и оборачивать в кликабельный компонент
- Kinescope iframe управляется через postMessage (после отказа от @kinescope/react-kinescope-player)
- Profile page уже имеет секцию diagnostic history (`app/(main)/profile/history/page.tsx`) — нужно wire-up к реальным данным

</specifics>

<deferred>
## Deferred Ideas

- **Video watch tracking** — трекинг прогресса просмотра видео (Kinescope events → LessonProgress). Необходим для виджета прогресса на dashboard
- **Recommended track progress widget** — виджет на dashboard "Пройдено X/N уроков" (зависит от video watch tracking)

</deferred>

---

*Phase: 09-integration-wire-up*
*Context gathered: 2026-02-26*
