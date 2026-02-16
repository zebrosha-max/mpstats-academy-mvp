# Phase 1: Data Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Приложение переходит с mock-данных на реальные данные из Supabase. Курсы, уроки, диагностики и профили сохраняются между перезапусками. Seed скрипт заполняет БД, три tRPC роутера (learning, diagnostic, profile) мигрируют с in-memory на Prisma. Dashboard показывает реальную статистику.

</domain>

<decisions>
## Implementation Decisions

### Seed данные и маппинг урок→скилл
- Маппинг SkillCategory идёт **на уровне урока**, не курса. Один курс содержит уроки из разных SkillCategory (например, маркетинг + аналитика + контент в одном курсе)
- Маппинг урок→SkillCategory определяется через **AI-классификацию** — LLM анализирует контент chunks и назначает категорию
- Seed скрипт должен быть **идемпотентным** (upsert логика, безопасный re-run)
- Метаданные курсов (названия, описания): нужно исследовать, что доступно в существующих content_chunk данных

### Поведение при ошибках БД
- **Без mock fallback** — если Supabase недоступна, показываем ошибку, не подменяем mock данными
- При паузе Supabase free tier (Error 521) — **специальное сообщение** с инструкциями для администратора ("База приостановлена, восстановите через dashboard")
- Общие ошибки БД — graceful error page

### Миграция mock → Prisma
- API можно менять — фронтенд обновляется вместе с бэкендом, обратная совместимость не требуется

### Dashboard и статистика
- Базовые метрики (как в mock): скилл-профиль, прогресс уроков, последняя диагностика
- **Дополнительно:** динамика скиллов (изменение между диагностиками) + стрик активности (дней подряд)

### Claude's Discretion
- Маппинг 6 курсов на 5 SkillCategory (или расширение enum) — Claude определит оптимальный подход при исследовании
- Одна основная SkillCategory на урок vs primary + secondary — Claude выберет по результатам AI-классификации
- Формат seed скрипта (из RAG chunks vs JSON)
- Стратегия миграции (поэтапно или big bang)
- Судьба mock данных после миграции (удалить vs оставить)
- DTO слой (Prisma напрямую vs маппинг) — Claude выберет для MVP
- Поведение auth при недоступности БД
- Fallback UI (покомпонентно vs error page)
- Dashboard empty state для новых пользователей
- Radar chart: последняя диагностика vs наложение двух

</decisions>

<specifics>
## Specific Ideas

- Курсы и скиллы — это ортогональные понятия. 6 курсов (analytics, ads, ai, workshops, ozon, express) не соответствуют 1:1 пяти SkillCategory. Уроки внутри курса могут покрывать разные скиллы
- 5,291 chunks с embeddings уже загружены в Supabase (`content_chunk` таблица)
- Стрик активности — как в Duolingo, мотивация через серию дней

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-02-16*
