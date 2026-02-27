# Roadmap: MAAL

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-02-26)
- 🚧 **v1.1 Admin & Polish** — Phases 10-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Data Foundation (4/4 plans) — completed 2026-02-17
- [x] Phase 2: AI Question Generation (2/2 plans) — completed 2026-02-25
- [x] Phase 3: Video Integration (2/2 plans) — completed 2026-02-18
- [x] Phase 4: Access Control & Personalization (2/2 plans) — completed 2026-02-25
- [x] Phase 5: Security Hardening (2/2 plans) — completed 2026-02-25
- [x] Phase 5.1: VPS Infrastructure Setup (2/2 plans) — completed 2026-02-24
- [x] Phase 6: Production Deploy (2/2 plans) — completed 2026-02-24
- [x] Phase 7: Lesson & Course Name Cleanup (2/2 plans) — completed 2026-02-26
- [x] Phase 8: Documentation & Traceability Sync (1/1 plan) — completed 2026-02-26
- [x] Phase 9: Integration Wire-Up (1/1 plan) — completed 2026-02-26

Full details: `milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Admin & Polish (In Progress)

**Milestone Goal:** Добавить админ-панель с управлением платформой, улучшить UX источников в уроках, оптимизировать производительность, добавить трекинг просмотра видео и закрыть tech debt.

- [x] **Phase 10: Superuser & Admin Panel** — Полноценная админ-панель с управлением пользователями, аналитикой и контентом (completed 2026-02-26)
- [x] **Phase 11: Summary & Sources UX** — Интерактивные источники в summary урока с тултипами и seekTo (completed 2026-02-27)
- [ ] **Phase 12: Lesson Page Performance** — Быстрая загрузка страницы урока с lazy video и кешированием
- [ ] **Phase 13: Watch Progress Tracking** — Сохранение и отображение прогресса просмотра видео
- [ ] **Phase 14: Tech Debt Cleanup** — Миграция in-memory данных в DB, кеширование AI вопросов, UX polish

## Phase Details

### Phase 10: Superuser & Admin Panel
**Goal**: Администратор может управлять платформой через защищённую админ-панель — видеть статистику, управлять пользователями и контентом
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07
**Success Criteria** (what must be TRUE):
  1. Пользователь с isAdmin=true попадает на /admin dashboard со статистикой платформы (юзеры, диагностики, активность)
  2. Пользователь без isAdmin при попытке открыть /admin получает 403 или редирект на главную
  3. Админ может найти пользователя по email и переключить его is_active/is_admin через inline toggle
  4. Админ видит графики роста пользователей и активности по времени
  5. Админ может просматривать курсы и менять порядок уроков
**Plans**: 3 plans

Plans:
- [x] 10-01-PLAN.md — Infrastructure: Prisma isAdmin/isActive fields, adminProcedure, admin tRPC router, (admin) route group with layout guard and sidebar
- [x] 10-02-PLAN.md — Admin pages: Dashboard with KPIs, Users management with toggles, Analytics charts, Content management with lesson reordering
- [ ] 10-03-PLAN.md — Content editing: Course reorder, inline course title editing, inline lesson title editing

### Phase 11: Summary & Sources UX
**Goal**: Пользователь взаимодействует с источниками в summary урока — кликает, видит превью, перематывает видео
**Depends on**: Nothing (independent)
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Summary урока отображается компактно с кнопкой "Показать полностью" / "Свернуть"
  2. Ссылки [1], [2], [N] в тексте summary кликабельны и визуально выделены
  3. При наведении на ссылку [N] появляется тултип с названием источника, таймкодом и фрагментом текста
  4. Клик на ссылку [N] перематывает Kinescope видео на соответствующий таймкод
**Plans**: 1 plan

Plans:
- [ ] 11-01-PLAN.md — Collapsible summary under video, interactive [N] source badges with tooltips and seekTo, sidebar chat-only

### Phase 12: Lesson Page Performance
**Goal**: Страница урока загружается быстро без длительного скелетона, видео не блокирует рендер
**Depends on**: Nothing (independent)
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Страница урока рендерится с контентом менее чем за 2 секунды (без учёта видео)
  2. Видеоплеер появляется после загрузки страницы (lazy loading), не блокируя текст и навигацию
  3. Повторное открытие того же урока загружается быстрее благодаря кешированию tRPC ответов
**Plans**: TBD

Plans:
- [ ] 12-01: Lazy video loading + tRPC query optimization + caching

### Phase 13: Watch Progress Tracking
**Goal**: Пользователь видит свой прогресс просмотра видео и может продолжить с последней позиции
**Depends on**: Phase 12 (lazy video loading must work first)
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04
**Success Criteria** (what must be TRUE):
  1. При просмотре видео позиция и процент сохраняются в базу данных автоматически
  2. На карточках уроков отображается прогресс-бар с процентом просмотра
  3. При повторном открытии урока видео начинает воспроизведение с последней сохранённой позиции
  4. На странице курса отображается общий процент завершения на основе просмотренных видео
**Plans**: TBD

Plans:
- [ ] 13-01: Watch progress DB model + save/restore + progress UI on cards and courses

### Phase 14: Tech Debt Cleanup
**Goal**: Устранить технический долг — мигрировать in-memory данные в DB, добавить кеширование AI вопросов и улучшить UX загрузки
**Depends on**: Nothing (independent)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):
  1. Перезапуск сервера не теряет activeSessionQuestions — данные хранятся в Supabase
  2. Повторный запуск диагностики по той же категории использует ранее сгенерированные вопросы из кеша
  3. При генерации AI вопросов пользователь видит progressive loading (этапы генерации, а не просто спиннер)
  4. Prisma version в Dockerfile определяется из package.json, а не захардкожена
**Plans**: TBD

Plans:
- [ ] 14-01: activeSessionQuestions migration + AI question caching + spinner UX + Dockerfile fix

## Progress

**Execution Order:**
Phases 10, 11, 12 can start independently. Phase 13 depends on Phase 12. Phase 14 is independent.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 4/4 | Complete | 2026-02-17 |
| 2. AI Question Generation | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. Video Integration | v1.0 | 2/2 | Complete | 2026-02-18 |
| 4. Access Control | v1.0 | 2/2 | Complete | 2026-02-25 |
| 5. Security Hardening | v1.0 | 2/2 | Complete | 2026-02-25 |
| 5.1 VPS Infrastructure | v1.0 | 2/2 | Complete | 2026-02-24 |
| 6. Production Deploy | v1.0 | 2/2 | Complete | 2026-02-24 |
| 7. Lesson Name Cleanup | v1.0 | 2/2 | Complete | 2026-02-26 |
| 8. Documentation Sync | v1.0 | 1/1 | Complete | 2026-02-26 |
| 9. Integration Wire-Up | v1.0 | 1/1 | Complete | 2026-02-26 |
| 10. Superuser & Admin Panel | 3/3 | Complete    | 2026-02-26 | - |
| 11. Summary & Sources UX | 1/1 | Complete    | 2026-02-27 | - |
| 12. Lesson Page Performance | v1.1 | 0/1 | Not started | - |
| 13. Watch Progress Tracking | v1.1 | 0/1 | Not started | - |
| 14. Tech Debt Cleanup | v1.1 | 0/1 | Not started | - |
