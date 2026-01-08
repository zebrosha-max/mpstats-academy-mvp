# MPSTATS Academy MVP — Documentation

**Статус:** Ready for Review  
**Последнее обновление:** 2025-12-18

---

## 📁 Структура документации

```
docs/
├── 00_constitution/
│   └── PROJECT_CONSTITUTION.md    # Принципы, стандарты, DoD
├── 01_prd/
│   ├── PRD.md                     # Product Requirements Document
│   └── USER_STORIES.md            # Детализированные User Stories
├── 02_technical_spec/
│   └── TECHNICAL_SPEC.md          # Архитектура, DB, API, RAG
└── 03_tasks/
    └── TASK_BREAKDOWN.md          # Задачи по спринтам и субагентам
```

---

## 🚀 Quick Start

### 1. Review документации

1. Начните с **PROJECT_CONSTITUTION.md** — понимание принципов
2. Затем **PRD.md** — что строим и зачем
3. **USER_STORIES.md** — детальные требования
4. **TECHNICAL_SPEC.md** — как строим
5. **TASK_BREAKDOWN.md** — план работ

### 2. Утверждение

После ревью необходимо утвердить:
- [ ] Конституция проекта
- [ ] PRD и User Stories
- [ ] Technical Spec (стек, архитектура)
- [ ] Task Breakdown (оценки, приоритеты)

---

## 📊 Summary

| Метрика | Значение |
|---------|----------|
| **User Stories** | 27 |
| **Sprints** | 5 (включая Sprint 0) |
| **Длительность** | ~8 недель |
| **Общий effort** | ~367 часов |

### По субагентам:

| Роль | Часы | % |
|------|------|---|
| Backend | 89.5h | 24% |
| Frontend | 126h | 34% |
| AI/ML | 44h | 12% |
| Design | 45h | 12% |
| QA | 62h | 17% |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, Tailwind, shadcn/ui |
| Backend | tRPC, Prisma |
| Database | **Supabase** (PostgreSQL + pgvector) |
| Auth | **Supabase Auth** |
| AI | **OpenRouter** (multi-model), Vercel AI SDK |
| Video | **Kinescope** |
| Testing | Vitest, Playwright |

---

## 📅 Timeline

```
Week 1-2:   Foundation (Auth, Landing, Setup)
Week 3-4:   Diagnostic Core (RAG, Questions, Results)
Week 5-6:   Learning Core (Path, Lessons, AI Chat)
Week 7-8:   Profile, Polish, Launch
```

---

## ✅ Next Steps

1. **Егор:** Ревью документации, feedback
2. **Егор:** Предоставить Figma с дизайном
3. **Егор:** Подготовить транскрипты курсов (или mock data)
4. **Claude:** После утверждения — начать Sprint 0

---

## 📝 Changelog

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2025-12-18 | Initial documentation package |

---

**Готов к ревью. Жду feedback.**
