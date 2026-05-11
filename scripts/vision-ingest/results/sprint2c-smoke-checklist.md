# Phase 55 Sprint 2C — Smoke Checklist (6 lessons × 3 questions)

Model: `openai/gpt-4.1-mini` (matches prod). Target: ≥80% accuracy (Y + 0.5·Partial) / 18.

## Lesson picks

| # | Lesson ID | Module | Rationale |
|---|-----------|--------|-----------|
| L1 | `03_ai_m02_neuroanalytics_003` | m02 | Frames rich in URLs (chatgpt.com/c/...), specific numbers (1098 ₽, 278, SPP/WB-кошелёк deltas) |
| L2 | `03_ai_m03_visual_008` | m03 | Tool names (Seedream 4, Krea Train, Flux), config values (2:3, 1K, 30mm) |
| L3 | `03_ai_m04_neurovideo_012` | m04 | Google Flow URLs, VEO model labels (Veo 3 - Fast), product names (DOLCE MILK) |
| L4 | `03_ai_m05_neurotexts_002` | m05 | MPSTATS revenue numbers, ChatGPT custom GPT names (Yoku Отзывович, Ассистент для WB) |
| L5 | `03_ai_m07_neuroscout_003` | m07 | Specific niche metrics (15,5 млн ₽, 45,95 млн ₽), price ranges (700-2000 руб) |
| L6 | `03_ai_m08_neurointegrator_006` | m08 | Custom GPT editor URL (chatgpt.com/gpts/editor/g-...), WB SEO limits (60 символов, 2000 символов) |

## Questions

| # | Lesson | Cat | Question | Expected fact (ground truth from frames) | Score |
|---|--------|-----|----------|------------------------------------------|-------|
| Q1 | L1 m02_003 | url-tool | Какие два инструмента/сервиса используются в этом уроке для анализа карточки товара? | ChatGPT (chatgpt.com) + MPSTATS (mpstats.io). | Y |
| Q2 | L1 m02_003 | number-metric | Какая цена карточки и сколько фото у неё, по данным из урока? | Цена 1098 ₽, 5 фото; средняя позиция/органика 278; у конкурентов 12-17 фото. | Y |
| Q3 | L1 m02_003 | hybrid | Какая структура итоговой таблицы рекомендуется спикером для анализа? | Таблица 3×3: Карточка / Цена / Реклама — слабые места карточки, сильные ходы конкурентов, точки роста. | Y |
| Q4 | L2 m03_008 | url-tool | Какой основной инструмент генерации изображений показан в уроке и какой второй сервис для обучения собственной модели? | Seedream 4 (или Krea 1) для генерации; Krea Train для обучения модели; ещё упоминается Flux. | Y |
| Q5 | L2 m03_008 | number-metric | Какое соотношение сторон и разрешение выставлены в Seedream при генерации? | Соотношение 2:3, разрешение 1K (стиль 1/5). | Y |
| Q6 | L2 m03_008 | hybrid | Чем по подходу к контенту отличаются Wildberries и Ozon, по итоговому слайду урока? | WB — эмоции, типажи, атмосфера; Ozon — каталог, нейтральный фон, детали. | Y |
| Q7 | L3 m04_012 | url-tool | В каком сервисе спикер генерирует видео из кадров и какая модель выбрана? | Google Flow (labs.google/fx/tools/flow/...), модель Veo 3 - Fast. | Y |
| Q8 | L3 m04_012 | number-metric | Какой бренд и объём продукта показаны в кадре с пачкой геля для душа? | DOLCE MILK, гель для душа Sunset beach PEACH, 300 ml / 10.1 fl.oz. | Y |
| Q9 | L3 m04_012 | hybrid | Какую главную мысль/итог выносит спикер на финальном слайде урока? | «Сильное видео начинается с сильного смысла». | Y |
| Q10 | L4 m05_002 | url-tool | В каком интерфейсе спикер собирает ключевые запросы и какой отчёт выгружает? | MPSTATS, отчёт «Расширения и запросы» / «SEO / Расширение запросов / Товарные позиции WB», по нише «Одежда / Футболки». | Y |
| Q11 | L4 m05_002 | number-metric | Какая выручка указана у топ-товара в таблице MPSTATS по футболкам? | Топ-продавец 24 003 360 ₽. | Y |
| Q12 | L4 m05_002 | hybrid | Какие кастомные GPT для маркетплейсов спикер показывает в разделе «Мои GPT»? | Ассистент для WB, Ассистент для Ozon, Yoku Отзывович, Контент-Мастер Маркетплейсов, Yoku Маркетплейс Менеджер. | Y |
| Q13 | L5 m07_003 | url-tool | В каком инструменте и в каком разделе спикер выбирает нишу для анализа? | MPSTATS (mpstats.io), раздел «Выбор ниши», данные за последние 30 дней. | Y |
| Q14 | L5 m07_003 | number-metric | Какой ценовой диапазон спикер задаёт для поиска подниши и какая выручка указана для ниши «Держатели для украшений»? | Цена 700–2000 руб; «Держатели для украшений» — выручка 45,95 млн ₽. | Y |
| Q15 | L5 m07_003 | hybrid | По каким критериям ChatGPT рекомендует подниши? Назови ключевые признаки «хорошей» подниши. | Низкая насыщенность (~20 продавцов с продажами), быстрый оборот, компактный товар, простой формат входа (FBO, без сертификации), не сезонный. | **N** (retrieval miss, 0 sources, "ответа нет") |
| Q16 | L6 m08_006 | url-tool | Какой инструмент создания кастомного GPT используется и какое имя получает ассистент? | ChatGPT GPT Editor, имя «Seo-специалист для Wildberries», описание «Соберет SEO для вашей карточки в 3 клика». | Y |
| Q17 | L6 m08_006 | number-metric | Какие лимиты по символам для Title и Описания на Wildberries указаны в инструкциях ассистента? | Title ≤ 60 символов, Описание ≤ 2000 символов. | Y |
| Q18 | L6 m08_006 | hybrid | Что нужно проверить в финальной самопроверке ассистента перед выдачей карточки? | Title ≤ 60, Описание ≤ 2000, дубли слов нет, «женский»/«мужской» в названии отсутствуют, переспама >3 раз нет. | **N** (retrieval miss, 0 sources, "ответа нет") |

## Per-category tally

- **url-tool** (Q1, Q4, Q7, Q10, Q13, Q16): Y=6 / Partial=0 / N=0 → **100%**
- **number-metric** (Q2, Q5, Q8, Q11, Q14, Q17): Y=6 / Partial=0 / N=0 → **100%**
- **hybrid** (Q3, Q6, Q9, Q12, Q15, Q18): Y=4 / Partial=0 / N=2 → **66.7%**

## Final tally

`Y=16, Partial=0, N=2` → Accuracy = (16 + 0) / 18 = **88.9%**

**Verdict: GO Sprint 3** (≥80% target, exceeds Sprint 2 baseline 84%).

**Notable failures:**
- Q15 (m07_003 hybrid — criteria for good подниша): retrieval returned 0 chunks, generator answered "В этом фрагменте урока ответа нет". The expected facts (FBO, низкая насыщенность, быстрый оборот) ARE present in frames at tc=09:00 and tc=10:00 — content was ingested but retrieval scoring didn't surface them for the broad/abstract phrasing of the question.
- Q18 (m08_006 hybrid — финальная самопроверка): same pattern. Frame at tc=27:00 has the verbatim "Проверка по требованиям: Title ≤ 60 символов, Описание ≤ 2000 символов, Слово «женский/мужской»: Нет, Переспама >3 раз: Нет" but retrieval missed it.

**Root cause hypothesis:** both failed Qs are "list/criteria" hybrids without strong lexical anchors (URLs, numbers, brand names). The same pattern was visible in pilot smoke but masked because pilot questions had more keyword overlap. Worth tracking as a candidate for Phase 56 query-expansion or hybrid retrieval re-ranking — already in Sprint 2 backlog.

url-tool and number-metric categories are 100% — the most production-critical retrieval modes are healthy.
