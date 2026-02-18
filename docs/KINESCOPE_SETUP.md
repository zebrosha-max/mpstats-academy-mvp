# Kinescope: Пошаговая настройка

Руководство по настройке Kinescope для MPSTATS Academy.
Результат: ~400 видео загружены, videoId привязаны к урокам в базе данных.

## Содержание

1. [Регистрация](#шаг-1-регистрация)
2. [Создание проекта](#шаг-2-создание-проекта)
3. [Получение API ключа](#шаг-3-получение-api-ключа)
4. [Настройка окружения](#шаг-4-настройка-окружения)
5. [Проверка маппинга](#шаг-5-проверка-маппинга-видео)
6. [Запуск маппинга](#шаг-6-запуск-маппинг-скрипта)
7. [Ревью маппинга](#шаг-7-ревью-результатов-маппинга)
8. [Загрузка видео](#шаг-8-загрузка-видео)

---

## Шаг 1: Регистрация

1. Перейдите на [kinescope.io](https://kinescope.io)
2. Нажмите "Попробовать бесплатно" или "Регистрация"
3. Укажите email и создайте пароль
4. Подтвердите email через ссылку в письме

> **Тариф:** Рекомендуем Super план (~€10/мес + pay-as-you-go).
> Для 405 видео (~212 GB): хранилище ~€6/мес, транскодинг ~€100 разово, CDN по трафику.

## Шаг 2: Создание проекта

1. Войдите в [app.kinescope.io](https://app.kinescope.io)
2. Нажмите "+" или "Новый проект"
3. Введите название: **MPSTATS Academy**
4. Запомните **project_id** — его можно получить через API:
   ```bash
   curl -s -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.kinescope.io/v1/projects" | python -m json.tool
   ```

## Шаг 3: Получение API ключа и Workspace ID

1. В дашборде перейдите в **Настройки** (иконка шестеренки)
2. Откройте раздел **API**
3. Нажмите **"Создать API ключ"**
4. Скопируйте ключ — он показывается только один раз

**Workspace ID** нужен для загрузки через TUS протокол:
- Загрузите любое видео через дашборд вручную
- Откройте DevTools → Network → найдите запрос к `eu-ams-uploader.kinescope.io`
- Скопируйте значение заголовка `X-Workspace-ID`

> **Безопасность:** API ключ и Workspace ID дают полный доступ. Не коммитьте в git.

## Шаг 4: Настройка окружения

Добавьте в `apps/web/.env`:

```env
# ============== KINESCOPE ==============
KINESCOPE_API_KEY=your_api_key_here
KINESCOPE_PROJECT_ID=your_project_id_here
KINESCOPE_WORKSPACE_ID=your_workspace_id_here
```

Проверьте что `apps/web/.env` в `.gitignore` (уже должен быть).

## Шаг 5: Проверка маппинга видео

Видео хранятся в `E:\Academy Courses\` со следующей структурой:

```
E:\Academy Courses\
├── manifest.json           # Метаданные всех видео
├── 01_analytics\
│   ├── m01_start\
│   │   ├── 001_kak_proyti_kurs.mp4
│   │   └── 002_dlya_chego_nuzhna_analitika.mp4
│   └── m02_economics\
│       └── ...
├── 02_ads\
├── 03_ai\
├── 04_workshops\
├── 05_ozon\
└── 06_express\
```

Маппинг-скрипт использует `manifest.json` для связки файлов с lesson_id в базе данных.

## Шаг 6: Запуск маппинг-скрипта

```bash
# Создание маппинга (не трогает базу данных)
npx tsx scripts/kinescope-mapping.ts

# Или с проверкой какие уроки уже имеют videoId
npx tsx scripts/kinescope-mapping.ts --check-db

# Только посмотреть структуру (без БД)
npx tsx scripts/kinescope-mapping.ts --dry-run
```

Результат записывается в `scripts/kinescope-video-map.json`.

## Шаг 7: Ревью результатов маппинга

Откройте `scripts/kinescope-video-map.json` и проверьте:

1. **`stats`** — общая статистика:
   - `matched` — сколько файлов привязаны к урокам
   - `unmatched` — сколько файлов не найдены в БД
   - `filesExist` — сколько файлов реально существуют на диске

2. **`matched`** — для каждого файла:
   - `filePath` — путь к видео
   - `lessonId` — ID урока в БД
   - `fileExists` — файл найден на диске
   - `fileSizeMB` — размер файла

3. **`unmatched`** — файлы без привязки:
   - Проверьте причину (`reason`)
   - При необходимости исправьте маппинг вручную

## Шаг 8: Загрузка видео

### Тестовая загрузка (рекомендуется начать с неё)

```bash
# Только показать что будет загружено (без реальной загрузки)
npx tsx scripts/kinescope-upload.ts --dry-run

# Загрузить только 1 видео для теста
npx tsx scripts/kinescope-upload.ts --limit 1
```

### Массовая загрузка

```bash
# Загрузить все видео
npx tsx scripts/kinescope-upload.ts
```

Скрипт:
- Пропускает уроки, у которых уже есть `videoId` в БД
- Повторяет загрузку при ошибке (до 3 раз с exponential backoff)
- Сохраняет прогресс в `scripts/kinescope-upload-progress.json`
- При повторном запуске продолжает с того места, где остановился

---

## Техническая архитектура загрузки

### TUS протокол (двухэтапный)

Kinescope использует [TUS resumable upload protocol](https://tus.io/) v1.0.0.
Загрузка происходит в два шага:

#### Шаг 1: Инициализация (POST, без тела)

```
POST https://eu-ams-uploader.kinescope.io/v2/init
Headers:
  Authorization: Bearer {KINESCOPE_API_KEY}
  Tus-Resumable: 1.0.0
  X-Workspace-ID: {KINESCOPE_WORKSPACE_ID}
  Upload-Length: {размер_файла_в_байтах}
  Upload-Metadata: parent_id {b64(PROJECT_ID)},init_id {b64(UUID)},type {b64("video")},title {b64(название)},filename {b64(имя_файла)},filesize {b64(размер_строкой)}
```

Ответ: `201 Created` с заголовком `Location` — URL для загрузки файла.

#### Шаг 2: Загрузка файла (PATCH, бинарное тело)

```
PATCH {URL_из_Location_заголовка}
Headers:
  Authorization: Bearer {KINESCOPE_API_KEY}
  Tus-Resumable: 1.0.0
  X-Workspace-ID: {KINESCOPE_WORKSPACE_ID}
  Upload-Offset: 0
  Content-Type: application/offset+octet-stream
Body: сырые байты файла
```

### Формат Upload-Metadata

TUS спецификация: `ключ base64значение,ключ base64значение` (без пробелов после запятой).

| Поле | Значение | Пример (decoded) |
|------|---------|------------------|
| `parent_id` | ID проекта в Kinescope | `ad127c11-6187-4fe2-bbfa-16f0d708a41c` |
| `init_id` | Случайный UUID (станет video ID!) | `7bac744d-c5be-4721-b787-34b9b6c3120e` |
| `type` | Всегда `video` | `video` |
| `title` | Название видео | `Генератор описания AI` |
| `filename` | Имя файла с расширением | `003_generator_opisaniya_ai.mp4` |
| `filesize` | Размер файла строкой | `9886112` |

**Важно:** `init_id` который вы генерируете сами — это и есть итоговый Kinescope Video ID.

### Проверка загруженного видео через API

```bash
# Список видео в проекте
curl -s -H "Authorization: Bearer $KINESCOPE_API_KEY" \
  "https://api.kinescope.io/v1/videos?project_id=$KINESCOPE_PROJECT_ID" \
  | python -m json.tool

# Конкретное видео по ID
curl -s -H "Authorization: Bearer $KINESCOPE_API_KEY" \
  "https://api.kinescope.io/v1/videos/{VIDEO_ID}" \
  | python -m json.tool
```

### Embed видео на сайте

```typescript
// Kinescope React Player (уже установлен в проекте)
import KinescopePlayer from '@kinescope/react-kinescope-player';

// Embed URL формат:
const embedUrl = `https://kinescope.io/embed/${videoId}`;
```

---

## Устранение ошибок

### 401 Unauthorized
- API ключ неверный или не установлен
- Проверьте `KINESCOPE_API_KEY` в `apps/web/.env`
- Проверьте что ключ не просрочен в дашборде

### Init failed (400 Bad Request)
- Проверьте `KINESCOPE_WORKSPACE_ID` — он обязателен для TUS загрузки
- Проверьте `KINESCOPE_PROJECT_ID` — должен быть валидный UUID проекта
- Все поля Upload-Metadata обязательны (parent_id, init_id, type, title, filename, filesize)

### 413 Payload Too Large
- Файл слишком большой для текущего тарифного плана
- Проверьте лимит размера файла в настройках Kinescope

### Timeout при загрузке
- Большие файлы (>1 ГБ) могут загружаться долго
- Скрипт использует таймаут 5 минут на файл
- При нестабильном интернете используйте `--limit N` для порционной загрузки

### ENOENT: файл не найден
- Видеофайл отсутствует на диске
- Проверьте `kinescope-video-map.json` — колонка `fileExists`
- Перезапустите маппинг-скрипт после перемещения файлов

### База данных недоступна
- Проверьте `DATABASE_URL` в `apps/web/.env`
- Проверьте что Supabase проект не заснул (free tier)
- Зайдите на supabase.com/dashboard и нажмите "Restore" при необходимости

---

## Полезные ссылки

| Ресурс | URL |
|--------|-----|
| Kinescope Dashboard | https://app.kinescope.io |
| Kinescope API (projects) | `https://api.kinescope.io/v1/projects` |
| Kinescope API (videos) | `https://api.kinescope.io/v1/videos` |
| TUS Upload Endpoint | `https://eu-ams-uploader.kinescope.io/v2/init` |
| Supabase Dashboard | https://supabase.com/dashboard |
| Manifest файл | `E:\Academy Courses\manifest.json` |
