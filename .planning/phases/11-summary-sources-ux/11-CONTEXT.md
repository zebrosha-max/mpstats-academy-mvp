# Phase 11: Summary & Sources UX - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Пользователь взаимодействует с источниками в AI-сгенерированном summary урока — кликает на ссылки, видит превью в тултипах, перематывает видео на таймкод. Summary переносится из боковой панели под видео для лучшей читаемости.

</domain>

<decisions>
## Implementation Decisions

### Компактность summary
- Summary отображается ПОД видео (не в боковой AI-панели)
- По умолчанию свёрнуто (6-8 строк видимы)
- Gradient fade внизу свёрнутого текста (плавное затухание в белый)
- Кнопка "Показать полностью" — текстовая ссылка, не кнопка
- Плавная анимация разворачивания (~300ms height transition)
- Боковая AI-панель остаётся только для чата (таб "Краткое содержание" убирается)

### Стиль ссылок [N]
- Superscript badge — маленький круглый badge сверху текста, как в научных статьях
- Цвет badge: mp-blue (брендовый синий)
- Внизу summary — блок сносок (footnotes), как в Wikipedia: [1] Название урока, 05:30

### Тултипы источников
- Задержка появления ~200ms (не мелькают при быстром движении мыши)

### Claude's Discretion
- Расположение summary (точный layout под видео — Claude решает оптимальную структуру)
- Loading state при генерации summary (skeleton vs spinner)
- Содержимое тултипа (название + таймкод + цитата vs компактный формат)
- Мобильное поведение тултипов (попновер по tap vs сразу seekTo)
- Действие при клике на badge [N] (seekTo видео vs скролл к сноске)
- Наличие кнопки "Перемотать" в тултипе vs клик по таймкоду
- Скролл к плееру при seekTo если плеер не в viewport
- Автоплей при seekTo (seekTo + play vs только позиция)
- Визуальная обратная связь при seekTo (подсветка badge, тост, ничего)
- Поведение при ошибке seekTo (тихий fallback vs тост с ошибкой)

</decisions>

<specifics>
## Specific Ideas

- Summary сейчас в узкой боковой панели, что создаёт проблему: текст растягивается на несколько экранов вниз. Перенос под видео решает эту проблему за счёт полной ширины контента.
- Kinescope seekTo работает через postMessage API к iframe (`https://kinescope.io/embed/{videoId}`)
- RAG summary уже возвращает sources с таймкодами — нужно парсить [1], [2] из markdown текста

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-summary-sources-ux*
*Context gathered: 2026-02-26*
