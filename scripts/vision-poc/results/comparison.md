# VLM PoC Comparison — DRAFT

**Сгенерировано:** 2026-05-06T14:57:20.244Z
**Дата прогона VLM:** 2026-05-06T11:08:44.964Z
**Ручная разметка:** 2026-05-06 (Task 8 first-pass)

## Затраты

- **google/gemini-2.5-flash-lite:** $0.01203
- **google/gemini-3.1-flash-lite-preview:** $0.02557
- **openai/gpt-4.1-mini:** $0.03934
- **Итого:** $0.07694

## Per-frame сравнение

### 01_analytics_m02_economics_004/frame_001

![frame](frames/01_analytics_m02_economics_004/frame_001_00-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** Открыт документ "Копия Юнит экономика: Эксперт 3.8" в табличном редакторе, отображающий информацию о ценообразовании товаров, включая цены, скидки и конечную цену для покупателя. Также присутствуют разделы "Вводные данные" и "Габариты товара".<br>**numbers:** 125% / 3.8 / 167 / 667 / 500 / 4,0 / 299,40% / 1000<br>**tools:** Wildberries | n | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** На скриншоте открыта таблица Google Sheets «Копия Юнит экономика: Эксперт 3.8» для расчета юнит-экономики товаров на маркетплейсе Wildberries.<br>**numbers:** Строка 8: Цена до скидок — р.167 / Строка 8: Цена продавца — р.667 / Строка 8: Цена со скидкой продавца — p.667 / Строка 8: Скидка WB Клуба — p.667 / Строка 8: Конечная цена для покупателя — р.667 / Строка 8: WB Кошелек — р.500 / Строка 8: Наценка — 4,0 (299,40%) / Добавить больше строк: 1000<br>**tools:** Google Sheets / Wildberries | partial | |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Экран с таблицей в онлайн-редакторе Google Sheets с расчетами по ценообразованию и габаритам товара.<br>**numbers:** № товара: 1 / Наименование товара: светящийся куб / Цена до скидок: р.167 / Цена со скидкой продавца: р.667 / Цена со скидкой WB Клуба: р.667 / Конечная цена для покупателя: р.667 / Наценка в рублях: р.500 / Наценка в коэффициенте: 4,0 / Наценка в процентах: 299,40%<br>**tools:** Google Sheets | n | ✓ |

### 01_analytics_m02_economics_004/frame_002

![frame](frames/01_analytics_m02_economics_004/frame_002_01-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** Интерфейс мессенджера Telegram, показывающий диалог с ботом 'EVIRMA Secret Bot', который рекламирует светящиеся кубики для ванны.<br>**urls:** www.wildberries.ru<br>**numbers:** CRO: 97% / выкупа: 93% / CRP: 8.25% / товаров ценой от 154Р до30 613P / товаров ценой от 237Р до400Р / товаров ценой от 440Р до2 167P / 12 штук / 251 / 751 / 290 / 693 / 59,2K / 12,6K / 4,5K / 5,5K / 778 / 1 / 13,9K / 16:18<br>**tools:** Telegram | y | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Интерфейс десктопной версии Telegram, в котором отображается сообщение от бота EVIRMA Secret Bot с аналитическими данными по товару «Кубики» и рекламным изображением.<br>**urls:** www.wildberries.ru<br>**numbers:** Конверсия из перехода в заказ (CRO): 8.87% / Процент выкупа: 93% / Конверсия из перехода в продажу (CRP): 8.25% / 0% для товаров ценой от 154₽ до 613₽ / 1% для товаров ценой от 237₽ до 400₽ / 25% для товаров ценой от 440₽ до 2 167₽ / 12 шт<br>**tools:** Telegram | n | ✓ |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Окно мессенджера с открытым чатом и сообщением о продаже светящихся кубиков для ванны.<br>**urls:** www.wildberries.ru<br>**numbers:** Выручка: не разобрать / 0% для товаров ценой от 154₽ до 30 613₽ / 1% для товаров ценой от 237₽ до 4000₽ / 25% для товаров ценой от 440₽ до 2 167₽ / конверсия из перехода в заказ (CRO): 8.87% / процент выкупа: 93% / конверсия из перехода в продажу (CRP): 8.25% / 12 штук<br>**tools:** EVIRMA Secret Bot / мессенджер | partial | |

### 01_analytics_m02_economics_004/frame_003

![frame](frames/01_analytics_m02_economics_004/frame_003_02-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** other<br>**summary:** Данный кадр демонстрирует интерфейс электронной таблицы, вероятно, Google Sheets или аналога, с данными о ценообразовании и габаритах товаров. На экране видно окно с таблицей, где перечислены товары, их цены со скидками, а также размеры и вес.<br>**numbers:** 125% / 0.00 / 123 / 601,9008 / 8 / 1 / 1000<br>**tools:** Google Sheets | partial | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Экранная запись работы в таблицах Google Sheets с расчетом юнит-экономики товара, наложенная на видео с лицом ведущего в углу.<br>**numbers:** Строка 8: Цена до скидок 167 р., Скидка продавца 4%, Цена со скидкой продавца 640 р., Скидка WB Клуб 6%, Цена со скидкой WB Клуба 602 р., Скидка Wildberries 25%, Конечная цена для покупателя 450 р., Наценка 435 руб, 3,6 коэффициент, 260,42% / Ячейка AR8: 602 / Строка 8: № 1 / Строка 8: светящиеся куб<br>**tools:** Google Таблицы | n | ✓ |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс таблицы Excel или Google Sheets с данными о ценообразовании и габаритах товара, на фоне видео с мужчиной в наушниках.<br>**numbers:** Цена до скидок: 667 руб / Скидка продавца: 4% / Цена со скидкой продавца: 640 руб / Скидка WB Клуб: 6% / Цена со скидкой WB Клуба: 602 руб / Скидка Wildberries: 25% / Конечная цена для покупателя: 450 руб / Наценка: 435 руб / Множитель наценки: 3.6 / Процент наценки: 260.42%<br>**tools:** Google Sheets | partial | |

### 01_analytics_m02_economics_004/frame_004

![frame](frames/01_analytics_m02_economics_004/frame_004_03-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** В окне показана таблица с информацией о товарах, включающая вводные данные, габариты товара и параметры продавца. Пользователь просматривает информацию по конкретному товару - "светящиеся куб".<br>**numbers:** 125% / 0.00 / 123 / 260,419640718563% / 1 / 5% / 428 / 435 / 3,6 / 260,42% / 1000<br>**tools:** Wildberries | partial | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** На скриншоте открыта таблица Google Sheets «Копия Юнит экономика: Эксперт 3.8», используемая для расчетов юнит-экономики товаров на маркетплейсе Wildberries.<br>**numbers:** Строка 8: Наценка 3,6 / Строка 8: AX 260,42% / Строка 8: B 1 (светящиеся куб) / Строка 8: C 5%<br>**tools:** Google Sheets / Wildberries | n | |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Окно таблицы Google Sheets с данными по товару и параметрами продавца, а также вставка с изображением человека в наушниках.<br>**numbers:** Наценка: 3,6 руб / Наценка: 260,42% / Конечная цена для покупателя: р.428, р.435 / 5% (в какой-то колонке рядом с товаром)<br>**tools:** Google Sheets | n | ✓ |

### 01_analytics_m02_economics_004/frame_005

![frame](frames/01_analytics_m02_economics_004/frame_005_04-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** На слайде показан интерфейс сайта Wildberries с информацией о товаре "Игрушки для ванной светящиеся кубики детские".<br>**numbers:** 12 шт. / 4,8 / 5 792 / 979 / 46 / 244141371 / 12 шт. / 2.6 см / 2.7 см / 2.7 см / 1 000 000<br>**tools:** Wildberries / mk mkeeper / mpstats | n | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** На экране отображена страница товара «Светящиеся кубики для ванной» на маркетплейсе Wildberries, дополненная аналитическими данными сервиса mpstats, с активным всплывающим окном «Характеристики и описание».<br>**numbers:** Оценка: 4,8 / Количество оценок: 5 792 / Количество предметов в упаковке: 12 / Остатки на складах (Рязанская обл.): 979 / Доставка (ч): 46 / Артикул: 244141371 / Выручка за 30 суток: 1 159 556 / Продаж за 30 суток: 3 330 / Высота предмета: 2.6 см / Глубина предмета: 2.7 см / Ширина предмета: 2.7 см<br>**tools:** Wildberries / mpstats | n | ✓ |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс страницы Wildberries с описанием и характеристиками детских светящихся кубиков для ванной.<br>**numbers:** Рейтинг: 4.8 (5 792 оценки) / Количество предметов в упаковке: 12 шт. / Остаток на складе Рязанская обл.: 979 шт. / Доставка: 46 ч / Высота предмета: 2.6 см / Глубина предмета: 2.7 см / Ширина предмета: 2.7 см / Выручка за 30 суток: 1 159 556 / Продаж за 30 суток: 3 330<br>**tools:** Wildberries / mpstats / mkeeper | n | |

### 01_analytics_m02_economics_004/frame_006

![frame](frames/01_analytics_m02_economics_004/frame_006_05-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | ⚠ Не парсится JSON: ```json {   "type": "interface",   "summary": "На скриншоте показан интерфейс сайта Wildberries с ка | y | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Карточка товара «Игрушки для ванной светящиеся кубики» на маркетплейсе Wildberries, дополненная аналитическими данными сервиса MPStats.<br>**numbers:** Оценки: 4,8 5 792 / Количество предметов: 12 / Склад Рязанская обл. остаток: 979 / Доставка склад: 46 / Артикул: 24414371 / Выручка за 30 суток: 1 159 556 / Продаж за 30 суток: 3 330 / Версия mpstats: 4.200 / Высота предмета: 2.6 см / Глубина предмета: 2.7 см / Ширина предмета: 2.7 см<br>**tools:** Wildberries / mpstats | partial | |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс страницы интернет-магазина Wildberries с описанием товара — светящихся детских кубиков для ванной.<br>**numbers:** Рейтинг: 4.8 из 5792 оценок / Количество предметов в упаковке: 12 шт. / Остаток на складе: 979 шт. / Доставка: 46 ч / Высота предмета: 2.6 см / Глубина предмета: 2.7 см / Ширина предмета: 2.7 см / Дарим 15 000 ₽ на запуск автоматизированной аналитики<br>**tools:** mpstats / mkeeper | n | ✓ |

### 01_analytics_m02_economics_004/frame_007

![frame](frames/01_analytics_m02_economics_004/frame_007_06-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** Интерфейс электронной таблицы, отображающий информацию о товарах, их габаритах и параметрах продавца. В строке 8 показан товар "светящиеся куб" с его ценой, наценкой, габаритами и объемом.<br>**numbers:** 125% / 0.00 / 123 / 3,6 / 260,42% / 6 / 6 / 6 / 200,0 / 0,23 / 1000<br>**tools:** Wildberries | partial | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** На скриншоте открыта таблица Google Sheets с финансовым расчетом юнит-экономики для товаров Wildberries. В кадре видна часть интерфейса с настройками габаритов товара и параметров продавца.<br>**numbers:** Наценка (коэффициент): 3,6 / Наценка (%): 260,42% / Длина упаковки: 6 см / Ширина упаковки: 6 см / Высота упаковки: 6 см / Объем: 0,23 литр<br>**tools:** Google Таблицы | n | |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Экран с таблицей в Google Sheets, отображающей данные по экономике товара с параметрами товара и продавца.<br>**numbers:** Наценка руб: 3,6 / Наценка %: 260,42% / Конечная цена для покупателя руб: 428 / Длина упаковки см: 6 / Ширина упаковки см: 6 / Высота упаковки см: 6 / Вес кг: 200,0 / Объем литр: 0,23<br>**tools:** Google Sheets | n | ✓ |

### 03_ai_m01_intro_008/frame_001

![frame](frames/03_ai_m01_intro_008/frame_001_00-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Слайд представляет информацию о человеке по имени Анастасия Шамаева. Указаны ключевые направления ее профессиональной деятельности.<br>**numbers:** 2021<br>**tools:** Ai | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Презентационный слайд с представлением спикера Анастасии Шамаевой и описанием её профессиональной деятельности.<br>**numbers:** С 2021 года<br>**tools:** Ai | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с информацией о Анастасии Шамаевой и её профессиональной деятельности.<br>**numbers:** С 2021 года распаковываю экспертность ТОПовых селлеров<br>**tools:** Ai | n | |

### 03_ai_m01_intro_008/frame_002

![frame](frames/03_ai_m01_intro_008/frame_002_02-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** На слайде представлена информация о ChatGPT, включая его основные функции и стоимость, а также логотип сервиса.<br>**numbers:** 20$/мес<br>**tools:** ChatGPT | n | |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Слайд презентации с описанием возможностей ChatGPT и информации о необходимости использования VPN.<br>**numbers:** стоимость от 20$/мес<br>**tools:** ChatGPT | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Информационный слайд о необходимости VPN для использования ChatGPT, с описанием функций и стоимости.<br>**numbers:** от 20$/мес<br>**tools:** ChatGPT | n | ✓ |

### 03_ai_m01_intro_008/frame_003

![frame](frames/03_ai_m01_intro_008/frame_003_05-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** На слайде представлено изображение, иллюстрирующее популярные товары на маркетплейсах в 2025 году, и начат текст о том, что сегодня востребовано на маркетплейсах.<br>**urls:** chatgpt.com/c/68b92474-6218-8320-9f88-954d55fb04e0<br>**tools:** Chrome / ChatGPT | n | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Интерфейс веб-браузера с открытым чатом в ChatGPT, где нейросеть предоставляет информацию о популярных товарах на маркетплейсах в 2025 году.<br>**urls:** chatgpt.com/c/68b92474-6218-8320-9f88-954d55fb04e0<br>**numbers:** 2025 (в заголовках)<br>**tools:** ChatGPT / Chrome / Krea / Perplexity | n | ✓ |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс веб-страницы ChatGPT с текстом о популярных товарах на маркетплейсах в 2025 году и видеовставкой с женщиной в углу экрана.<br>**urls:** chatgpt.com/c/68b92474-6218-8320-9f88-954d55fb04e0<br>**numbers:** 2025 год: год, к которому относится информация о популярных товарах<br>**tools:** ChatGPT / Chrome | n | |

### 03_ai_m01_intro_008/frame_004

![frame](frames/03_ai_m01_intro_008/frame_004_08-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** Экран интерфейса ChatGPT, где представлены различные категории товаров или услуг. Пользователь получает уточняющий вопрос и может прикрепить файл.<br>**urls:** https://chatgpt.com/g/g-p-68b9251777dc819191f9564fa2b3a7b4/c/68b92474-6218-8320-9f88-954d55fb04e0<br>**tools:** Chrome / ChatGPT | n | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Экран веб-интерфейса ChatGPT, где отображается чат с классификацией товарных категорий и уточняющий вопрос пользователю.<br>**urls:** chatgpt.com/g/g-68b9251777dc819191f9564fa2b3a7b4/c/68b92474-6218-8320-9f88-954d55fb04e0<br>**numbers:** 1<br>**tools:** ChatGPT / Chrome | partial | |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс веб-версии ChatGPT на русском языке с открытым документом и видимым видео пользователя в правом верхнем углу.<br>**urls:** chatgpt.com/g/g-p-68b9251777dc819191f9564fa2b3a7b4/c/68b92474-6218-8320-9f88-954d55fb04e0<br>**tools:** ChatGPT / Chrome | n | ✓ |

### 03_ai_m01_intro_008/frame_005

![frame](frames/03_ai_m01_intro_008/frame_005_11-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Слайд с информацией о сервисе "Krea Ai", который позволяет генерировать инфографику, создавать видео из фото и имеет стоимость от 10$ в месяц, с наличием бесплатных генераций.<br>**numbers:** 10 $/мес<br>**tools:** Krea Ai | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Информационный слайд с кратким обзором возможностей и условий использования сервиса Krea AI.<br>**numbers:** Стоимость: от 10$/мес<br>**tools:** Krea Ai | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд о сервисе Krea Ai, который не требует VPN и предлагает генерацию инфографики и создание видео из фото с оплатой от 10$/месяц и бесплатными генерациями.<br>**numbers:** от 10$/мес<br>**tools:** Krea Ai | n | |

### 03_ai_m01_intro_008/frame_006

![frame](frames/03_ai_m01_intro_008/frame_006_14-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** other<br>**summary:** На кадре показан интерфейс веб-сайта Krea.ai, где пользователь вводит запрос на генерацию изображения 'Сгенерируй кепку бейсбольную зеленую' и отображаются примеры сгенерированных изображений.<br>**urls:** krea.ai/image<br>**numbers:** 39% / 1/5 / 2:3 / 1K<br>**tools:** Chrome / Krea.ai | n | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Пользователь работает в веб-интерфейсе генератора изображений Krea.ai, где отображается история генераций и окно для ввода текстового запроса.<br>**urls:** krea.ai/image<br>**numbers:** Процент заряда: 39% / Style 1/5 / Соотношение сторон: 2:3<br>**tools:** Chrome / Krea / Perplexity | n | |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс веб-приложения для генерации изображений на основе текстового запроса, с примерами сгенерированных изображений.<br>**urls:** krea.ai/image<br>**numbers:** 2:3 - соотношение сторон / 1/5 - стиль 1 из 5 / 1K - возможно количество использований или кредитов / 39% - заряд устройства в правом верхнем углу<br>**tools:** Krea 1 / Chrome | n | ✓ |

### 03_ai_m01_intro_008/frame_007

![frame](frames/03_ai_m01_intro_008/frame_007_16-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** Окно веб-браузера с интерфейсом сервиса krea.ai для генерации видео. На экране отображается сгенерированное изображение платья и поле для ввода текстового запроса.<br>**urls:** krea.ai/video<br>**numbers:** 39% / 720p / 2.1<br>**tools:** Chrome / Perplexity / Krea | n | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Пользовательский интерфейс веб-сервиса Krea AI для генерации видео, где в текстовом поле введен промпт с описанием красного платья.<br>**urls:** krea.ai/video<br>**numbers:** 39% (заряд батареи) / 720p (разрешение)<br>**tools:** Chrome / Krea AI | n | ✓ |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс веб-приложения для генерации видео на основе текстового описания с примером красного платья на вешалке.<br>**urls:** krea.ai/video<br>**numbers:** 720p — качество видео<br>**tools:** Krea.ai / Model Wan 2.1 / Seedance | n | |

### 03_ai_m01_intro_008/frame_008

![frame](frames/03_ai_m01_intro_008/frame_008_19-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** Скриншот интерфейса Telegram, где демонстрируется чат с ботом Kandinsky, предлагающий генерацию картинок через GigaChat.<br>**urls:** GigaChat.<br>**numbers:** 53 / 10 / 6 / 8 / 3 / 12 / 10 / 6 / 161 664<br>**tools:** Telegram / GigaChat / Kandinsky | partial | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** На экране открыто приложение Telegram с активным чатом бота Kandinsky, предлагающим перейти в GigaChat для генерации изображений. В фоне виден браузер с несколькими открытыми вкладками.<br>**numbers:** 161 664 пользователя в месяц / 53 (счетчик уведомлений на иконке Kandinsky) / 10 (счетчик в папке 'Все чаты') / 6 (счетчик в папке MPSTATS) / 8 (счетчик в папке Evirma) / 3 (счетчик в папке CEO) / 12 (счетчик в папке Кандидаты) / 10 (счетчик в папке Поток 3) / 6 (счетчик в папке Методолог) / 08:52 (время сообщения)<br>**tools:** Telegram / Kandinsky / GigaChat / Google Chrome / ChatGPT / MPSTATS | n | ✓ |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Скриншот интерфейса мессенджера Telegram с открытым чатом Kandinsky, предлагающим генерацию картинок через GigaChat внутри приложения.<br>**urls:** GigaChat<br>**numbers:** 161 664 пользователя в месяц / 53 (уведомлений)<br>**tools:** Telegram / Kandinsky / GigaChat | n | |

### 03_ai_m01_intro_008/frame_009

![frame](frames/03_ai_m01_intro_008/frame_009_22-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** На кадре представлен интерфейс для подписки на Perplexity. Для разблокировки полного потенциала предлагается войти через Google, Apple или ввести адрес электронной почты.<br>**urls:** perplexity.ai/search/shveitsariia-zapuskaet-otkrytu-g27UG1xyRCahuXANSOB7KQ<br>**tools:** Chrome | partial | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Экран входа в сервис Perplexity в браузере Google Chrome, предлагающий авторизацию через Google, Apple или электронную почту.<br>**urls:** https://perplexity.ai/search/shveitsariia-zapuskaet-otkrytu-g27UG1xyRCahuXANsOB7KQ<br>**tools:** Chrome / Perplexity / Google / Apple | n | ✓ |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Экран регистрации и входа на сайт Perplexity с предложением подписаться для разблокировки полного потенциала сервиса.<br>**urls:** perplexity.ai/search/shveitsariia-zapuskaet-otkrytu-g27UG1xyRCahuXANsOB7KQ<br>**tools:** Google / Apple / Perplexity | n | |

### 03_ai_m01_intro_008/frame_010

![frame](frames/03_ai_m01_intro_008/frame_010_25-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** interface<br>**summary:** Интерфейс платформы WeShop AI для создания изображений с помощью ИИ. Пользователь видит список доступных инструментов и примеры работ.<br>**urls:** weshop.ai/workspace?agentName=aimodel<br>**numbers:** 1575 / 2999 / 2958 / 3072 / 2990 / 2782 / 2610 / 3019<br>**tools:** WeShop AI | n | |
| google/gemini-3.1-flash-lite-preview | **type:** interface<br>**summary:** Рабочий интерфейс веб-сервиса WeShop AI для генерации AI-моделей и редактирования изображений товаров. На экране отображается панель управления задачами и галерея примеров с результатами обработки.<br>**urls:** https://weshop.ai/workspace?agentName=aimodel<br>**numbers:** 1575 / 2999 / 2958 / 3072 / 2990 / 2782 / 2610 / 3019<br>**tools:** WeShop AI / Chrome | n | |
| openai/gpt-4.1-mini | **type:** interface<br>**summary:** Интерфейс веб-приложения WeShop AI для создания изображений с помощью ИИ, с вкладкой AI Model и разделом лучших примеров.<br>**urls:** weshop.ai/workspace?agentName=aimodel<br>**numbers:** 1575 / 2999 / 2958 / 3072 / 2990 / 2782 / 2610 / 3019<br>**tools:** WeShop AI / AI Model / AI Product / Change Pose / Remove BG / Upscale / Relight / Expand Image / Magic Eraser / Hand/Feet Fixer / Design Repair | n | ✓ |

### 04_workshops_w01_feb_ads_001/frame_001

![frame](frames/04_workshops_w01_feb_ads_001/frame_001_00-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Кадр показывает молодого человека в очках и наушниках, который говорит на фоне доски с надписями. Часть экрана занимает логотип "mpstats academy".<br>**tools:** mpstats academy | n | |
| google/gemini-3.1-flash-lite-preview | **type:** video<br>**summary:** Мужчина в очках и с гарнитурой ведет лекцию или вебинар перед белой доской с надписями. В правом верхнем углу расположен логотип образовательной платформы.<br>**tools:** mpstats academy | n | ✓ |
| openai/gpt-4.1-mini | **type:** video<br>**summary:** Скриншот с видеозвонка, мужчины, сидящего на фоне белой доски с надписями на русском языке.<br>**tools:** mpstats academy | n | |

### 04_workshops_w01_feb_ads_001/frame_002

![frame](frames/04_workshops_w01_feb_ads_001/frame_002_10-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** На слайде представлен текст с советом о том, что плохая работа воронки будет усугубляться при масштабировании рекламы, приводя к сливу бюджета. Также виден логотип "mpstats academy" и часть изображения женщины.<br>**tools:** mpstats academy | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Образовательный слайд, на котором спикер рассказывает о рисках масштабирования неэффективной рекламной воронки.<br>**tools:** mpstats academy | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с текстом, предупреждающим о последствиях плохой работы воронки продаж для рекламного бюджета.<br>**tools:** mpstats academy | n | |

### 04_workshops_w01_feb_ads_001/frame_003

![frame](frames/04_workshops_w01_feb_ads_001/frame_003_21-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** На слайде представлен пример анализа лака для ногтей с тремя карточками товаров, каждая из которых показывает изображение продукта, скидку, цену и название платформы.<br>**numbers:** -52% РАСПРОДАЖА / 243 ₽ 621 ₽ / -65% РАСПРОДАЖА / 453 ₽ 1360 ₽<br>**tools:** mpstats academy | n | |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** На слайде представлен пример карточек товаров лака для ногтей с маркетплейса, демонстрирующий визуальное оформление и цены со скидками.<br>**numbers:** Цена первого товара: 243 Р / Старая цена первого товара: 521 Р / Скидка первого товара: -52% / Цена второго товара: 453 Р / Старая цена второго товара: 1360 Р / Скидка второго товара: -65%<br>**tools:** mpstats academy | n | ✓ |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Пример на тему лаков для ногтей с двумя товарами на распродаже и изображениями изделий.<br>**numbers:** 243 ₽ - цена с учетом -52% скидки, бывшая цена 521 ₽ (левый товар) / 453 ₽ - цена с учетом -65% скидки, бывшая цена 1360 ₽ (правый товар) | n | |

### 04_workshops_w01_feb_ads_001/frame_004

![frame](frames/04_workshops_w01_feb_ads_001/frame_004_31-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** other<br>**summary:** Слайд презентации с заголовком "низкий рейтинг – способ решения", интерфейсом "баллы за отзывы" и таблицей с расчетом итоговой суммы.<br>**numbers:** Все: 517 / Активные: 4 / Запланированные: 4 / Архивированные: 111 / Черновики: 308 / Количество товаров: 10 / Бюджет: 187 200 ₽ / Цель по отзывам: -200 / Отзывы за баллы: 200*200 = 40 000 рублей / Комиссия: 8 000 рублей / НДС: 9 600 рублей / Итого: 57 600 рублей<br>**tools:** mpstats academy | partial | |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Слайд из обучающего материала MPSTATS Academy, посвященный способам решения проблемы низкого рейтинга через инструмент «Баллы за отзывы». Справа представлена таблица с расчетом бюджетных затрат на эту активность.<br>**numbers:** Все: 517 / Активные: 4 / Запланированные: 4 / Архивированные: 111 / Черновики: 398 / Количество товаров: 10 / Бюджет: 187 200 / Цель по отзывам: 200 / Отзывы за баллы: 200*200 = 40 000 рублей / Комиссия: 8 000 рублей / НДС: 9 600 рублей / Итого: 57 600 рублей<br>**tools:** MPSTATS | n | ✓ |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с темой 'Низкий рейтинг – способ решения', иллюстрирующий расчет стоимости за отзывы и подробную разбивку затрат.<br>**numbers:** Количество товаров: 10 / Бюджет: 187 200 ₽ / Цель по отзывам: 200 / Отзывы за баллы: 200*200 = 40 000 рублей / Комиссия: 8 000 рублей / НДС: 9 600 рублей / Итого: 57 600 рублей<br>**tools:** mpstats academy / Баллы за отзывы (интерфейс Wildberries) | n | |

### 04_workshops_w01_feb_ads_001/frame_005

![frame](frames/04_workshops_w01_feb_ads_001/frame_005_42-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Презентация о сокращении сроков доставки как способе решения, с упоминанием перехода на FBO. В правом верхнем углу находится логотип "mpstats academy" и видеовставка с говорящей женщиной.<br>**tools:** mpstats academy | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Обучающий слайд от MPSTATS Academy, посвященный способу сокращения сроков доставки через переход на схему FBO.<br>**tools:** MPSTATS Academy | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд презентации на тему сокращения сроков доставки с упоминанием перехода на FBO.<br>**tools:** mpstats academy | n | |

### 04_workshops_w01_feb_ads_001/frame_006

![frame](frames/04_workshops_w01_feb_ads_001/frame_006_52-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Слайд с заголовком "Что выберете вы?" демонстрирует различные виды чая, разделенные на три категории: "Король Солнце", "Весенняя свежесть" и "Ароматный" в левой части, "Поцелуй Афродиты", "Соусеп" и "Бонапарт" в средней части, а также состав набора чая "В набор входит" в правой части.<br>**numbers:** 1 / 2<br>**tools:** mpstats academy | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Слайд с презентации, сравнивающий два варианта оформления карточек товаров с чаем. В правой части экрана расположены видеопотоки с докладчиками.<br>**numbers:** 1 / 2<br>**tools:** mpstats academy | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с предложением выбрать варианты различных сортов чая, разделённых на две группы с описаниями составов.<br>**numbers:** 1 / 2<br>**tools:** mpstats academy | n | |

### 04_workshops_w01_feb_ads_001/frame_007

![frame](frames/04_workshops_w01_feb_ads_001/frame_007_63-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Слайд с информацией о скидке 25% для участников сегодняшнего эфира, демонстрирующий ноутбук с логотипом MPSTATS и иконками OZON, WB, ЯМ.<br>**numbers:** 25%<br>**tools:** mpstats | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Рекламный слайд обучающего вебинара компании MPSTATS Academy, предлагающий скидку 25% участникам эфира.<br>**numbers:** Скидка: 25%<br>**tools:** MPSTATS | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с предложением скидки 25% для участников сегодняшнего эфира и изображением ноутбука с логотипами OZON, WB и ЯМ.<br>**numbers:** Скидка 25%<br>**tools:** mpstats | n | |

### 04_workshops_w01_feb_ads_001/frame_008

![frame](frames/04_workshops_w01_feb_ads_001/frame_008_73-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** other<br>**summary:** Кадр показывает рекламный баннер с надписью "Скидка 25%" и информацию о том, что предложение "только для участников сегодняшнего эфира". На баннере также изображен ноутбук с интерфейсом сайта mpstats.academy, логотипами "OZON", "WB" и "Ям".<br>**numbers:** 25%<br>**tools:** mpstats.academy | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Рекламный слайд для участников эфира с предложением скидки 25% на сервис аналитики MPSTATS.<br>**numbers:** Скидка: 25%<br>**tools:** MPSTATS | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с предложением скидки 25% только для участников сегодняшнего эфира и иллюстрацией ноутбука с логотипами платформ.<br>**numbers:** Скидка 25%<br>**tools:** mpstats academy | n | |

### 04_workshops_w01_feb_ads_001/frame_009

![frame](frames/04_workshops_w01_feb_ads_001/frame_009_84-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Слайд из академии mpstats с названием "Обрезали трафик - как исправить". На слайде перечислены шаги для решения проблемы, включая работу с бюджетом, инструментами и ставками, а также анализ влияния на рекламные кампании.<br>**tools:** mpstats / Джем | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Обучающий слайд от MPSTATS Academy с советами по исправлению ситуации при ограничении трафика в рекламных кампаниях.<br>**tools:** MPSTATS Academy | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с советами по исправлению ситуации с урезанным трафиком в рекламных кампаниях.<br>**tools:** Джем | n | |

### 04_workshops_w01_feb_ads_001/frame_010

![frame](frames/04_workshops_w01_feb_ads_001/frame_010_94-00.jpg)

| Модель | Описание | Hallucination? | Best? |
|---|---|---|---|
| google/gemini-2.5-flash-lite | **type:** slide<br>**summary:** Слайд из презентации с заголовком "6. Селлер не обновляет РК" и текстом, описывающим ситуацию, когда реклама перестает работать после хорошей начальной эффективности. В правом верхнем углу присутствует логотип "mpstats academy" и мини-видео с человеком.<br>**numbers:** 6 / 1-2<br>**tools:** mpstats academy | n | ✓ |
| google/gemini-3.1-flash-lite-preview | **type:** slide<br>**summary:** Образовательный слайд из вебинара, посвященный проблеме отсутствия обновлений в рекламных кампаниях (РК).<br>**numbers:** Период работы рекламы: 1-2 месяца<br>**tools:** mpstats academy | n | |
| openai/gpt-4.1-mini | **type:** slide<br>**summary:** Слайд с заголовком о проблеме, когда продавец не обновляет рекламные кампании (РК), и текстом о том, что реклама могла хорошо работать 1-2 месяца, а потом прекратила работать.<br>**numbers:** 1-2 месяца<br>**tools:** mpstats academy | n | |

## Hallucination rate per model

Подсчёт: y = 1.0, partial = 0.5, n = 0; делим на 27.

- **google/gemini-2.5-flash-lite:** 4.0 / 27 (≈14.8%) — 2 y (frame_002 economics — invented numbers; frame_006 economics — JSON parse failure) + 4 partial (economics frame_003, 004, 007; ai frame_008 — "GigaChat." как URL)
- **google/gemini-3.1-flash-lite-preview:** 1.5 / 27 (≈5.6%) — 3 partial (economics frame_001 — мисс-лейбл «WB Кошелёк р.667» вместо р.500; frame_006 — артикул 24414371 вместо 244141371; ai frame_004 — URL g- вместо g-p-)
- **openai/gpt-4.1-mini:** 1.0 / 27 (≈3.7%) — 2 partial (economics frame_002 — «до 4000Р» вместо «до 400Р»; frame_003 — «Цена до скидок 667» вместо 167)

**Winner:** openai/gpt-4.1-mini (lowest hallucination rate).

## SC5: OCR vs VLM на URL/числах

Проверено 10 кадров с явными URL или табличными данными:
1. `economics/frame_002` (CRO/CRP/диапазоны цен): OCR rawText есть, но `extractedNumbers` сильно искажены (87977, 1672, 0400). VLM (gemini-3.1) — все числа корректно.
2. `economics/frame_003` (sheet row 8 prices): OCR полная строка, числа все есть. VLM — корректно (gemini-3.1).
3. `economics/frame_005` (WB+mpstats артикул, выручка): OCR не получил выручку 1 159 556 (только в rawText, не в extractedNumbers). VLM — извлёк revenue из chart panel.
4. `economics/frame_006`: OCR sparse (Дарим 15 000 ₽ только в gpt-4.1-mini ответе, OCR не уловил числовое значение). VLM — caught.
5. `economics/frame_007` (габариты): OCR искажён («6 200,0»), VLM — корректно.
6. `ai/frame_003` (chatgpt.com URL): OCR `extractedUrls: []`, raw text содержит фрагменты URL. VLM — полный URL у всех 3 моделей.
7. `ai/frame_004` (chatgpt.com/g/g-p-... URL): OCR `extractedUrls: []`. VLM — gemini-2.5 и gpt-4.1-mini полный URL, gemini-3.1 ошибся на одной букве (g- вместо g-p-).
8. `ai/frame_006` (krea.ai/image, 39%, 1/5, 2:3, 1K): OCR `extractedUrls: []`, числа искажены (77111). VLM — все 3 модели полный URL и все ключевые значения.
9. `ai/frame_009` (perplexity.ai/search/long-slug URL): OCR `extractedUrls: []`. VLM — gemini-3.1 и gpt-4.1-mini полный URL.
10. `ai/frame_010` (WeShop AI 1575/2999/3072 etc): OCR `extractedUrls: []`, числа в основном в порядке но `8 290` искажено (на самом деле 2990). VLM — все 3 модели чистые числа.

**Итог:**
- OCR URL accuracy: **0/10** в `extractedUrls` (поле пустое для всех URL-кейсов; URL в rawText есть, но фрагментарно с пропусками). Только `www.wildberries.ru` пойман в frame_002 — это домен из текста, не из адресной строки.
- VLM URL accuracy (best model — gpt-4.1-mini): **9/10** — все URL корректны кроме случаев, где gemini-3.1 ошиблась на 1 символ.
- OCR numbers accuracy: ~50% — простые числа корректно, но многозначные с разделителями часто склеены/искажены.
- VLM numbers accuracy: ~95% — почти всегда правильно структурировано с лейблами.

**Решение:** [x] **VLM-only достаточно для URL/чисел** — OCR не предоставляет дополнительной ценности по URL, а по числам уступает VLM в качестве. OCR можно оставить как fallback для случаев, когда VLM возвращает невалидный JSON (1/27 = 3.7%).

## Выбор best model

**Best model по итогам ручного анализа: openai/gpt-4.1-mini**

Обоснование:
1. **Самая низкая hallucination rate** — 3.7% против 5.6% (gemini-3.1) и 14.8% (gemini-2.5).
2. **Лучше всех распознаёт UI-контекст и инструменты** — frame_010 (WeShop AI) перечислил все 11 пунктов меню точно; frame_006 (Krea) корректно интерпретировал 39% как заряд устройства, а 1K как кредиты, давая полезные пометки.
3. **Корректно распознал «Дарим 15 000 ₽» оверлей в economics/frame_006** — единственная модель, поймавшая динамический popup в frame, который остальные пропустили или у gemini-2.5 вообще привёл к JSON-failure.
4. **Стоимость вторая по дороговизне ($0.0393 vs $0.0256 у gemini-3.1)**, но при tie-breaker по hallucination — побеждает по качеству.

**Альтернатива:** при бюджетном ограничении — `google/gemini-3.1-flash-lite-preview` ($0.0256, ≈5.6% hallucination, лучшие counters в Telegram-folders на frame_008). Gemini-3.1 чаще даёт **более структурированные** числа с лейблами «Строка 8: ...».

**НЕ рекомендуется:** `google/gemini-2.5-flash-lite` — invented numbers в Telegram-чате (frame_002), JSON-parse failure на frame_006, путает CRO 8.87% → 97%. Дешевле, но не надёжен на сложных UI-кадрах.

### Best-frame counts
- gemini-2.5-flash-lite: **9** ✓ (выигрывает на простых slide-кадрах workshops по принципу tie-breaker «cheapest»)
- gemini-3.1-flash-lite-preview: **8** ✓ (лучшая структура чисел в spreadsheet-кадрах)
- gpt-4.1-mini: **10** ✓ (лучший на сложных interface-кадрах, корректные URL, fewer hallucinations)

## Notable observations

1. **gemini-2.5-flash-lite систематически фабрикует числа на сложных UI** — Telegram chat (economics frame_002): выдумала "251 / 751 / 290 / 693 / 59,2K / 12,6K / 4,5K / 5,5K / 778 / 1 / 13,9K" — все из левой панели чатов, но цифры неправильные (real: 12, 6, 8, 3, 12 в папках). Также CRO 8.87% → 97% — критический фейл.
2. **gpt-4.1-mini лучше всех на табличных данных** — четко перечисляет колонки и значения, не путает строки.
3. **gemini-3.1 даёт самые подробные tool-списки** — упоминает Krea/Perplexity по табам в браузере, что полезно для контекста.
4. **OCR полностью бесполезен на URL** — extractedUrls пустой во всех 10 проверенных URL-кейсах. URL появляется только в rawText фрагментарно. Tesseract не справляется с URL-bar-шрифтом Chrome.
5. **JSON-failure rate низкий** — 1/81 = 1.2% (только gemini-2.5 на economics/frame_006). Приемлемо для production, но retry-механизм нужен.
6. **Все три модели одинаково хорошо справляются с простыми slide-кадрами** (workshops frames 5, 7, 8, 10) — для них tie-breaker «cheapest» работает в пользу gemini-2.5.
7. **Видео-кадры (talking head без overlay-текста)** — все три модели одинаково сухо описывают, нет преимуществ. Tip: в production такие кадры можно фильтровать по low text density.

---

**Time spent:** ~25 минут (включая чтение 27 frames + аналитику + написание секций).
