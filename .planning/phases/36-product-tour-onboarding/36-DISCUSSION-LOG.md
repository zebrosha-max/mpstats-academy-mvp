# Phase 36: Product Tour / Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 36-product-tour-onboarding
**Areas discussed:** Библиотека/подход, Шаги туров, Триггеры и UX, Мобилка

---

## Библиотека/подход

| Option | Description | Selected |
|--------|-------------|----------|
| driver.js (рекоменд.) | ~35KB gzip. Декларативные шаги, highlight, клавиатура, a11y. Упомянут в ROADMAP. | ✓ |
| Shepherd.js | ~13KB gzip. Легче, но меньше встроенных фич. Требует Popper.js/Floating UI. | |
| Кастом на Radix Popover | Ноль зависимостей. Полный контроль стиля. Нужно писать highlight-overlay самому. | |
| Ты решай | Claude выберет оптимальную библиотеку | |

**User's choice:** driver.js (рекоменд.)
**Notes:** —

---

## Шаги туров — Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Сайдбар фокус (реком.) | 4-5 шагов: sidebar навигация, карта навыков, CTA диагностики | |
| Полный обзор | 6-7 шагов: сайдбар + статистика, radar chart, активность, тарифы, поддержка | |
| Ты решай | Claude определит оптимальные шаги | ✓ |

**User's choice:** Ты решай
**Notes:** Claude определит оптимальные шаги dashboard-тура при планировании

---

## Шаги туров — Learn

| Option | Description | Selected |
|--------|-------------|----------|
| Каталог + трек (реком.) | 5-6 шагов: поиск, фильтры, переключатель, секции, добавление в трек | ✓ |
| Минимум | 3 шага: поиск, "Мой трек", карточка урока | |
| Ты решай | Claude определит оптимальные шаги | |

**User's choice:** Каталог + трек (реком.)
**Notes:** —

---

## Шаги туров — Lesson

| Option | Description | Selected |
|--------|-------------|----------|
| Видео + AI (реком.) | 4-5 шагов: видеоплеер, summary, чат, комментарии, навигация | ✓ |
| Только AI-фичи | 3 шага: summary, чат, таймкоды. Видеоплеер очевиден. | |
| Ты решай | Claude определит оптимальные шаги | |

**User's choice:** Видео + AI (реком.)
**Notes:** —

---

## Триггеры и UX — Запуск

| Option | Description | Selected |
|--------|-------------|----------|
| Авто + задержка (реком.) | Тур стартует через 1-2 сек при первом визите. Без модалов. | |
| Welcome-модал | Модал "Хотите обзор?" — кнопки "Начать" / "Пропустить" | |
| Ты решай | Claude выберет лучший UX | ✓ |

**User's choice:** Ты решай
**Notes:** Claude выберет между авто-стартом и welcome-модалом

---

## Триггеры и UX — Кнопка повтора

| Option | Description | Selected |
|--------|-------------|----------|
| Иконка ? в хедере (реком.) | HelpCircle в хедере рядом с UserNav. Клик — тур текущей страницы. | |
| Меню выбора | Кнопка ? открывает dropdown с выбором тура | |
| Ты решай | Claude выберет оптимальный UX | ✓ |

**User's choice:** Ты решай
**Notes:** Claude выберет расположение и поведение кнопки повтора

---

## Мобилка

| Option | Description | Selected |
|--------|-------------|----------|
| Адаптировать шаги (реком.) | Dashboard-тур показывает MobileNav вместо sidebar. Шаги адаптируются под mobile layout. | ✓ |
| Только десктоп | Туры только на экранах ≥ 768px. На мобилке не показывать. | |
| Ты решай | Claude решит на этапе планирования | |

**User's choice:** Адаптировать шаги (реком.)
**Notes:** —

---

## Claude's Discretion

- Dashboard-тур: конкретные шаги и тексты
- Триггер запуска тура (авто vs модал)
- Кнопка повтора тура (расположение, поведение)

## Deferred Ideas

None — discussion stayed within phase scope
