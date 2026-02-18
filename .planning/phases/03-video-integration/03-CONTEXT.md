# Phase 3: Video Integration - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Kinescope видеоплеер с реальными видео на страницах уроков. Клик по таймкоду в RAG summary/chat перематывает видео к нужному моменту. Если videoId отсутствует — информативный placeholder. Скрипт загрузки видео в Kinescope и маппинг videoId к урокам.

</domain>

<decisions>
## Implementation Decisions

### Kinescope плеер
- Без autoplay — видео стартует по клику пользователя
- SDK vs iframe, layout, кастомные контролы — Claude's Discretion

### Таймкод-навигация
- Таймкоды кликабельны в RAG summary и chat
- Формат отображения, поведение seek+play/scroll — Claude's Discretion
- Scope таймкодов (только RAG vs оглавление) — Claude's Discretion

### Placeholder без видео
- AI-панели (summary/chat) работают даже без видео — они основаны на транскриптах
- Дизайн placeholder — Claude's Discretion
- Поведение таймкодов без видео (disabled/hidden) — Claude's Discretion

### VideoId маппинг
- Kinescope ещё не настроен, videoId пока нет
- Видео хранятся локально: `E:\Academy Courses`
- Имена файлов предположительно совпадают с lesson_id (нужно проверить)
- Нужен скрипт bulk-загрузки видео в Kinescope с автоматическим маппингом
- Нужен пошаговый гайд по настройке Kinescope (регистрация, проект, API key)
- Хранение videoId (колонка в Lesson vs отдельная таблица) — Claude's Discretion

### Claude's Discretion
- Способ интеграции (iframe vs SDK) — выбрать оптимальный для таймкод-навигации
- Layout плеера на странице урока
- Кастомные контролы — минимальные или стандартные Kinescope
- Формат таймкодов (badge vs ссылка)
- Поведение при клике таймкода (seek+play, scroll to player)
- Placeholder дизайн
- Поведение таймкодов без видео

</decisions>

<specifics>
## Specific Ideas

- Пользователь хочет побыстрее — скрипт загрузки видео предпочтительнее ручной работы
- Гайд по настройке Kinescope — пошаговый, для человека без опыта с платформой
- Проверить структуру `E:\Academy Courses` перед загрузкой — сопоставить файлы с lesson_id

</specifics>

<deferred>
## Deferred Ideas

- Watch progress tracking (процент просмотра видео) — v2 requirement UX-04
- Административная панель для управления видео — v2 requirement CMS-01

</deferred>

---

*Phase: 03-video-integration*
*Context gathered: 2026-02-18*
