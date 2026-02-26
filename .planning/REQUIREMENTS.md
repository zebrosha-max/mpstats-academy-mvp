# Requirements: MPSTATS Academy v1.1

**Defined:** 2026-02-26
**Core Value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения — без лишнего контента, только то, что нужно именно ему.

## v1.1 Requirements

### Admin

- [ ] **ADMIN-01**: Admin может видеть dashboard со статистикой платформы (юзеры, диагностики, активность)
- [ ] **ADMIN-02**: Admin может просматривать список всех пользователей с поиском и фильтрами
- [ ] **ADMIN-03**: Admin может переключать is_active и is_admin у пользователей inline
- [ ] **ADMIN-04**: Admin может видеть аналитику платформы (графики по времени: рост юзеров, активность)
- [ ] **ADMIN-05**: Admin может управлять курсами и уроками (просмотр, редактирование порядка)
- [ ] **ADMIN-06**: Поле isAdmin в UserProfile с Prisma миграцией, adminProcedure в tRPC
- [ ] **ADMIN-07**: Route group (admin) с layout guard + защита API через adminProcedure

### Lesson UX

- [ ] **UX-01**: Summary урока ограничен по высоте с кнопкой expand/collapse
- [ ] **UX-02**: Источники в тексте [N] кликабельны как интерактивные ссылки
- [ ] **UX-03**: Hover на источник [N] показывает тултип с превью (название, таймкод, фрагмент текста)
- [ ] **UX-04**: Клик на источник [N] перематывает видео на таймкод через seekTo

### Performance

- [ ] **PERF-01**: Lesson page загружается без длительного скелетона (целевое время < 2s)
- [ ] **PERF-02**: Видео загружается lazy — не блокирует рендер страницы
- [ ] **PERF-03**: tRPC запросы оптимизированы (параллельные запросы, кеширование ответов)

### Watch Progress

- [ ] **WATCH-01**: Прогресс просмотра видео сохраняется в БД (позиция + процент)
- [ ] **WATCH-02**: Прогресс-бар просмотра отображается на карточках уроков
- [ ] **WATCH-03**: Возобновление просмотра с последней сохранённой позиции
- [ ] **WATCH-04**: Процент завершения курса рассчитывается на основе просмотренных видео

### Tech Debt

- [ ] **DEBT-01**: activeSessionQuestions из globalThis Map → Prisma/Supabase хранилище
- [ ] **DEBT-02**: Кеширование AI-сгенерированных вопросов в БД для повторного использования
- [ ] **DEBT-03**: UX spinner timing при генерации AI вопросов (progressive loading)
- [ ] **DEBT-04**: Hardcoded Prisma version в Dockerfile → динамическое определение

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
| ADMIN-01 | TBD | Pending |
| ADMIN-02 | TBD | Pending |
| ADMIN-03 | TBD | Pending |
| ADMIN-04 | TBD | Pending |
| ADMIN-05 | TBD | Pending |
| ADMIN-06 | TBD | Pending |
| ADMIN-07 | TBD | Pending |
| UX-01 | TBD | Pending |
| UX-02 | TBD | Pending |
| UX-03 | TBD | Pending |
| UX-04 | TBD | Pending |
| PERF-01 | TBD | Pending |
| PERF-02 | TBD | Pending |
| PERF-03 | TBD | Pending |
| WATCH-01 | TBD | Pending |
| WATCH-02 | TBD | Pending |
| WATCH-03 | TBD | Pending |
| WATCH-04 | TBD | Pending |
| DEBT-01 | TBD | Pending |
| DEBT-02 | TBD | Pending |
| DEBT-03 | TBD | Pending |
| DEBT-04 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
