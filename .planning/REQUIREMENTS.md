# Requirements: MPSTATS Academy v1.1

**Defined:** 2026-02-26
**Core Value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения — без лишнего контента, только то, что нужно именно ему.

## v1.1 Requirements

### Admin

- [x] **ADMIN-01**: Admin может видеть dashboard со статистикой платформы (юзеры, диагностики, активность)
- [x] **ADMIN-02**: Admin может просматривать список всех пользователей с поиском и фильтрами
- [x] **ADMIN-03**: Admin может переключать is_active и is_admin у пользователей inline
- [x] **ADMIN-04**: Admin может видеть аналитику платформы (графики по времени: рост юзеров, активность)
- [x] **ADMIN-05**: Admin может управлять курсами и уроками (просмотр, редактирование порядка)
- [x] **ADMIN-06**: Поле isAdmin в UserProfile с Prisma миграцией, adminProcedure в tRPC
- [x] **ADMIN-07**: Route group (admin) с layout guard + защита API через adminProcedure

### Lesson UX

- [x] **UX-01**: Summary урока ограничен по высоте с кнопкой expand/collapse
- [x] **UX-02**: Источники в тексте [N] кликабельны как интерактивные ссылки
- [x] **UX-03**: Hover на источник [N] показывает тултип с превью (название, таймкод, фрагмент текста)
- [x] **UX-04**: Клик на источник [N] перематывает видео на таймкод через seekTo

### Performance

- [x] **PERF-01**: Lesson page загружается без длительного скелетона (целевое время < 2s)
- [x] **PERF-02**: Видео загружается lazy — не блокирует рендер страницы
- [x] **PERF-03**: tRPC запросы оптимизированы (параллельные запросы, кеширование ответов)

### Watch Progress

- [x] **WATCH-01**: Прогресс просмотра видео сохраняется в БД (позиция + процент)
- [x] **WATCH-02**: Прогресс-бар просмотра отображается на карточках уроков
- [x] **WATCH-03**: Возобновление просмотра с последней сохранённой позиции
- [x] **WATCH-04**: Процент завершения курса рассчитывается на основе просмотренных видео

### Tech Debt

- [x] **DEBT-01**: activeSessionQuestions из globalThis Map → Prisma/Supabase хранилище
- [ ] **DEBT-02**: Кеширование AI-сгенерированных вопросов в БД для повторного использования
- [ ] **DEBT-03**: UX spinner timing при генерации AI вопросов (progressive loading)
- [x] **DEBT-04**: Hardcoded Prisma version в Dockerfile → динамическое определение

## Future Requirements

### Deferred from Active

- Адаптивная сложность вопросов (IRT-lite) на основе предыдущих ответов
- Визуализация прогресса навыков между диагностиками
- Dark mode toggle
- Полное accessibility audit (WCAG 2.1 AA)
- Полное QA покрытие (unit tests, component tests, E2E)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first, PWA достаточен |
| Платёжная система | MVP бесплатный |
| Real-time уведомления | Не нужны для образовательного контента |
| SCORM/xAPI | Over-engineering для MVP |
| Gamification | Усложняет без доказанной ценности |
| Multi-language | Только русский |
| Content moderation | Контент создаётся только админами |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADMIN-01 | Phase 10 | Complete |
| ADMIN-02 | Phase 10 | Complete |
| ADMIN-03 | Phase 10 | Complete |
| ADMIN-04 | Phase 10 | Complete |
| ADMIN-05 | Phase 10 | Complete |
| ADMIN-06 | Phase 10 | Complete |
| ADMIN-07 | Phase 10 | Complete |
| UX-01 | Phase 11 | Complete |
| UX-02 | Phase 11 | Complete |
| UX-03 | Phase 11 | Complete |
| UX-04 | Phase 11 | Complete |
| PERF-01 | Phase 12 | Complete |
| PERF-02 | Phase 12 | Complete |
| PERF-03 | Phase 12 | Complete |
| WATCH-01 | Phase 13 | Complete |
| WATCH-02 | Phase 13 | Complete |
| WATCH-03 | Phase 13 | Complete |
| WATCH-04 | Phase 13 | Complete |
| DEBT-01 | Phase 14 | Complete |
| DEBT-02 | Phase 14 | Pending |
| DEBT-03 | Phase 14 | Pending |
| DEBT-04 | Phase 14 | Complete |

**Coverage:**
- v1.1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after roadmap creation*
