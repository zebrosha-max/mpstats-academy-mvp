# MPSTATS Academy MVP — Progress Log

**Created:** 2025-12-21

---

## Workflow Agreements

### Development Strategy
- **Dev environment:** Локально (Windows PC)
- **Production:** VPS 79.137.197.90 (Ubuntu 24.04)
- **Database:** Supabase (cloud)

### Progress Tracking
- Обновлять после КАЖДОЙ задачи (BE-0.1, FE-1.2 и т.д.)
- Формат: `- [x] ID: Описание — ключевые файлы`

---

## Sprint 0: Project Setup ✅ (2025-12-21)

- [x] BE-0.1: Turborepo monorepo — `turbo.json`, `pnpm-workspace.yaml`, `package.json`
- [x] BE-0.2: Prisma + Supabase — `packages/db/prisma/schema.prisma`
- [x] BE-0.3: tRPC routers — `packages/api/src/routers/*`
- [x] BE-0.4: Docker Compose — `docker-compose.yml`
- [x] BE-0.5: ENV template — `.env.example`
- [x] FE-0.1: Next.js 14 App Router — `apps/web/src/app/`
- [x] FE-0.2: Tailwind CSS — `tailwind.config.ts`, `globals.css`
- [x] FE-0.3: shadcn/ui — `apps/web/src/components/ui/*`
- [x] FE-0.4: tRPC client — `apps/web/src/lib/trpc/*`
- [x] QA-0.1: Vitest — `apps/web/vitest.config.ts`
- [x] QA-0.2: Playwright — `apps/web/playwright.config.ts`
- [x] QA-0.3: CI Pipeline — `.github/workflows/ci.yml`

---

## Sprint 1: Foundation ✅ (2025-12-21)

### Backend
- [x] BE-1.1: Supabase project setup — `.env`, pgvector, trigger
- [x] BE-1.2: Supabase client setup — `lib/supabase/{client,server}.ts`
- [x] BE-1.3: UserProfile model + trigger — SQL в Supabase Dashboard
- [x] BE-1.4: Auth actions — `lib/auth/actions.ts` (signUp, signIn, signOut, reset)
- [x] BE-1.5: Google OAuth setup — Supabase Dashboard ✅
- [x] BE-1.6: Auth callback route — `app/auth/callback/route.ts`
- [x] BE-1.7: Protected middleware — `middleware.ts`
- [x] BE-1.8: tRPC context with auth — уже было настроено
- [x] BE-1.9: Profile router — уже было настроено

### Frontend
- [x] FE-1.1: Landing page — `app/page.tsx` (Hero, Features, CTA)
- [x] FE-1.2: Auth layout — `app/(auth)/layout.tsx`
- [x] FE-1.3: Login page — `app/(auth)/login/page.tsx`
- [x] FE-1.4: Register page — `app/(auth)/register/page.tsx`
- [x] FE-1.5: Verify email page — `app/(auth)/verify/page.tsx`
- [x] FE-1.6: Password reset pages — `app/(auth)/forgot-password/`, `reset-password/`
- [x] FE-1.7: Main layout — `app/(main)/layout.tsx`, `components/shared/{sidebar,mobile-nav,user-nav}.tsx`
- [x] FE-1.8: Dashboard placeholder — `app/(main)/dashboard/page.tsx`

### QA
- [x] QA-1.1: Auth integration tests ✅
- [x] QA-1.2: Auth E2E tests ✅
- [x] QA-1.3: Landing E2E ✅
- [x] QA-1.4: Protected routes test ✅

---

## Sprint 2: UI Shell ✅ (2025-12-22)

> **Цель:** Полностью кликабельный прототип на mock data

### Backend
- [x] BE-2.1: Mock data types — `packages/shared/types/*` (SkillGap, DiagnosticResult, DashboardData)
- [x] BE-2.2: Mock API layer — `packages/api/mocks/{questions,courses,dashboard}.ts`
- [x] BE-2.3: Diagnostic mock router — `routers/diagnostic.ts` (startSession, submitAnswer, getResults)
- [x] BE-2.4: Learning mock router — `routers/learning.ts` (getCourses, getLesson, getPath)
- [x] BE-2.5: Profile mock router — `routers/profile.ts` (getDashboard, getSkillProfile)
- [x] BE-2.6: Course/Lesson models — уже в `schema.prisma`
- [ ] BE-2.7: Seed mock courses — отложено (используем in-memory mock)

### Frontend — Diagnostic UI
- [x] FE-2.1: Diagnostic intro page — `app/(main)/diagnostic/page.tsx`
- [x] FE-2.2: Question component — `components/diagnostic/Question.tsx`
- [x] FE-2.3: Progress bar — `components/diagnostic/ProgressBar.tsx`
- [x] FE-2.4: Diagnostic session page — `app/(main)/diagnostic/session/page.tsx`
- [x] FE-2.5: Results page — `app/(main)/diagnostic/results/page.tsx`
- [x] FE-2.6: Radar chart component — `components/charts/RadarChart.tsx` (recharts)

### Frontend — Learning UI
- [x] FE-2.7: Learning path page — `app/(main)/learn/page.tsx`
- [x] FE-2.8: Lesson card — `components/learning/LessonCard.tsx`
- [x] FE-2.9: Lesson page layout — `app/(main)/learn/[id]/page.tsx`
- [x] FE-2.10: Kinescope player — встроен в lesson page (iframe placeholder)
- [x] FE-2.11: AI panels (placeholder) — summary tab + chat placeholder в lesson page
- [x] FE-2.12: Lesson completion — кнопка "Завершить урок" в lesson page

### Frontend — Dashboard & Profile UI
- [x] FE-2.13: Dashboard page — `app/(main)/dashboard/page.tsx` (stats, radar, activity)
- [x] FE-2.14: Stats cards — встроены в dashboard
- [x] FE-2.15: Recent activity — встроено в dashboard
- [x] FE-2.16: Profile settings page — `app/(main)/profile/page.tsx`
- [x] FE-2.17: Diagnostic history — `app/(main)/profile/history/page.tsx`

### Bugfixes (2025-12-22)
- [x] BF-2.1: Hot reload сессий — `globalThis` паттерн для `mockSessions` (сессии терялись при hot reload)
- [x] BF-2.2: Динамический расчёт gaps — `calculateSkillGaps()` вместо `MOCK_SKILL_GAPS`
- [x] BF-2.3: Хранение завершённых сессий — `completedSessions[]` + `latestSkillProfile`
- [x] BF-2.4: Реальная история диагностик — `getHistory` из `completedSessions`
- [x] BF-2.5: Актуальный профиль навыков — `getSkillProfile` из `latestSkillProfile`
- [x] BF-2.6: Кликабельная история — ссылки на `/diagnostic/results?id=...`

### QA (отложено)
- [ ] QA-2.1: UI Component tests
- [ ] QA-2.2: Diagnostic flow E2E
- [ ] QA-2.3: Learning flow E2E
- [ ] QA-2.4: Responsive testing
- [ ] QA-2.5: Accessibility audit

### Created Files
```
packages/api/src/mocks/
├── questions.ts    # 25 mock вопросов (5 per category)
├── courses.ts      # 3 курса, 11 уроков
├── dashboard.ts    # mock stats, activity
└── index.ts

components/
├── diagnostic/
│   ├── Question.tsx
│   └── ProgressBar.tsx
├── learning/
│   └── LessonCard.tsx
└── charts/
    └── RadarChart.tsx

app/(main)/
├── diagnostic/
│   ├── page.tsx           # intro
│   ├── session/page.tsx   # quiz flow
│   └── results/page.tsx   # results with radar
├── learn/
│   ├── page.tsx           # course list + path
│   └── [id]/page.tsx      # lesson player
├── profile/
│   ├── page.tsx           # settings
│   └── history/page.tsx   # diagnostic history
└── dashboard/page.tsx     # updated with stats + radar
```

---

## Technical Notes (для будущих сессий)

### Mock Data Architecture
In-memory хранилище для Sprint 2 использует `globalThis` паттерн для сохранения данных между hot reloads:

```typescript
// packages/api/src/routers/diagnostic.ts
type MockStorage = {
  mockSessions: Map<string, MockSession>;      // Активные сессии
  completedSessions: CompletedSession[];       // Завершённые сессии
  latestSkillProfile: SkillProfile | null;     // Последний профиль навыков
};

const globalForMock = globalThis as unknown as { mockStorage: MockStorage };
globalForMock.mockStorage = globalForMock.mockStorage || { ... };
```

### Экспорты для cross-router доступа
```typescript
// diagnostic.ts экспортирует:
export const getLatestSkillProfile = (): SkillProfile | null => ...
export const getCompletedSessions = (): CompletedSession[] => ...

// profile.ts импортирует и использует
import { getLatestSkillProfile } from './diagnostic';
```

### Приоритет данных
1. Реальные данные из `globalThis.mockStorage`
2. Данные из Supabase (если доступна)
3. Fallback на `MOCK_*` константы

### Known Limitations (Sprint 2)
- Данные теряются при перезапуске сервера (in-memory)
- `recommendedLessons` в gaps пока пустые
- История не персистится между сессиями

---

## Sprint 2.5: UI Redesign (2025-12-24)

> **Цель:** Применить MPSTATS брендинг ко всем UI компонентам

### Фаза 1: Foundation ✅ COMPLETE (2025-12-23)
- [x] RD-1.1: Tailwind Color Config — `mp-blue`, `mp-green`, `mp-pink`, `mp-gray` scales
- [x] RD-1.2: CSS Variables — MPSTATS theme (light + dark mode)
- [x] RD-1.3: Logo component — `components/shared/Logo.tsx`
- [x] RD-1.4: Typography + Shadows — custom fontSize, boxShadow in `tailwind.config.ts`

### Фаза 2: Базовые компоненты ✅ COMPLETE (2025-12-24)
- [x] RD-2.1: Button redesign — `components/ui/button.tsx`
  - Variants: default (blue), success (green), featured (pink), outline, secondary, ghost, link
  - Sizes: sm, default, lg, xl, icon variants
  - Effects: shadows, hover states, active scale
- [x] RD-2.2: Card redesign — `components/ui/card.tsx`
  - Variants: default, soft-blue, soft-green, soft-pink, gradient, outline, glass, elevated
  - Interactive prop for hover effects
- [x] RD-2.3: Badge redesign — `components/ui/badge.tsx` (NEW)
  - Variants: default, primary, success, featured, hot, warning, destructive, premium, new, limited
  - Skill category badges: analytics, marketing, content, operations, finance
  - Outline variants
- [x] RD-2.4: Input redesign — `components/ui/input.tsx`
  - Variants: default, error, success (with auto-detect from props)
  - Sizes: sm, default, lg
  - Focus states with MPSTATS colors
- [x] RD-2.5: Logo integration — `components/shared/Logo.tsx`
  - Sizes: sm, md, lg, xl
  - Variants: default, white, dark
  - SVG placeholder (ready for Figma export)

### Фаза 3-5: Pending
- [ ] RD-3.x: Layout components (Sidebar, Header, MobileNav)
- [ ] RD-4.x: Pages redesign (Landing, Auth, Dashboard, Diagnostic, Learning, Profile)
- [ ] RD-5.x: Polish (RadarChart colors, LessonCard badges, icons, responsive)

---

## Next Session Tasks

- [ ] **Sprint 2.5 Phase 3:** Layout components redesign (Sidebar, Header, MobileNav)
- [ ] **PRIORITY:** Разобраться с количеством уроков и привести их в порядок
  - Проблема: уроки показываются не по результатам диагностики
  - getPath() возвращает захардкоженный список (Content/Marketing)
  - Нет уроков для OPERATIONS и FINANCE
  - План исправления: см. `.claude/plans/greedy-soaring-volcano.md`

---

## Sprint 3-4: See TASK_BREAKDOWN.md

---

## Key Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to DB
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
```
