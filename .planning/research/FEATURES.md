# Feature Research

**Domain:** Adaptive learning platform for marketplace sellers (MAAL)
**Researched:** 2026-02-16
**Confidence:** MEDIUM (web search/Context7 unavailable; based on codebase analysis + training data)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **TS-1: Dynamic course catalog from DB** | Users expect real, consistent course list; hardcoded mock data creates stale/broken state on content updates | MEDIUM | Replace `MOCK_COURSES` / `MOCK_LESSONS` with Prisma queries to `Course` + `Lesson` tables. Schema already exists. Main work: seed script + router rewrite |
| **TS-2: Persistent lesson progress** | Progress must survive server restarts; current in-memory `Map` loses all data | MEDIUM | Migrate `mockProgress` Map to `LessonProgress` Prisma model (already in schema). Wire up `updateProgress` / `completeLesson` mutations |
| **TS-3: Persistent diagnostic results** | Same problem as progress: `globalThis` storage loses sessions on restart | MEDIUM | Migrate `mockSessions` / `completedSessions` to `DiagnosticSession` + `DiagnosticAnswer` + `SkillProfile` Prisma models |
| **TS-4: Video player (Kinescope embed)** | Core of an education platform is video; placeholder "video coming soon" is a blocker | LOW | Iframe already wired in `learn/[id]/page.tsx`. Need: (a) real Kinescope videoId mapping per lesson, (b) lesson seed with real videoIds |
| **TS-5: Timecode deep-links in video** | RAG chat returns timecodes like "03:42 - 04:15"; clicking them should seek the video to that timestamp | MEDIUM | Kinescope iframe supports `?t=SECONDS` param. Need: (a) Kinescope Player JS SDK or postMessage API for seek, (b) clickable timecode badges in chat/summary UI |
| **TS-6: Production deployment** | App must be accessible online, not just localhost | MEDIUM | Next.js `output: 'standalone'` + PM2 + Nginx reverse proxy on VPS 79.137.197.90. Standard pattern, well-documented |
| **TS-7: Environment variable management** | Secrets must not leak; env vars must be properly configured on VPS | LOW | `.env` with `DATABASE_URL`, `OPENROUTER_API_KEY`, `SUPABASE_*`, etc. Copy `.env` to VPS, restrict file permissions |
| **TS-8: HTTPS / SSL** | Users will not trust a platform without HTTPS, especially with Google OAuth | LOW | Let's Encrypt + certbot + Nginx. Google OAuth requires HTTPS redirect URI |
| **TS-9: Diagnostic question variety** | 25 hardcoded questions get repetitive fast; users expect fresh assessments | HIGH | AI-generated questions from RAG chunks. See TS-12 differentiator. Fallback to mock pool is table stakes |
| **TS-10: Protected routes enforcement** | Auth middleware must work reliably; currently has `publicProcedure` TODOs | LOW | Fix the 3 `publicProcedure` TODOs in `ai.ts` back to `protectedProcedure`. Fix SSR cookie issue referenced in comments |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **D-1: AI-generated diagnostic questions from course content** | Questions are always relevant to actual course material; no manual question authoring needed; infinite variety | HIGH | New service `question-generator.ts`: fetch chunks for a skill category, prompt LLM to generate MCQ with correct answer + explanation. Needs strong prompt engineering + validation (LLM can generate wrong "correct" answers) |
| **D-2: Soft access gating (diagnostic-first)** | Users who complete diagnostic get personalized path; creates engagement loop and perceived value | MEDIUM | `LessonLocked.tsx` component, `hasCompletedDiagnostic()` check in lesson page, "My Track" filter in /learn showing only `recommendedPath` lessons |
| **D-3: Personalized learning path from skill gaps** | After diagnostic, weak areas surface priority lessons; strong areas are de-emphasized | MEDIUM | Already partially built (gaps + recommendedPath in diagnostic results). Need: save `recommendedPath` to `LearningPath` model, show "Recommended for you" badges, sort/filter in /learn |
| **D-4: RAG summary with clickable timecodes that seek video** | Summary references jump to exact video moment; deeply connects AI output to video content | MEDIUM | Requires Kinescope JS SDK integration. Timecodes already returned from RAG. UI needs onClick handler that sends `postMessage` or calls SDK `seekTo()` |
| **D-5: Adaptive difficulty (IRT-lite)** | Diagnostic adjusts question difficulty based on previous answers; more accurate skill assessment | HIGH | Requires: question pool large enough per difficulty level, selection algorithm that picks harder/easier questions based on running accuracy. Defer unless question generation (D-1) provides sufficient pool |
| **D-6: Course structure derived from RAG data** | Courses auto-populate from ingested content; no manual catalog management | MEDIUM | Query `content_chunk` table, extract distinct `lesson_id` prefixes, group into courses. Already have 6 courses / 80+ lessons in DB. Need: endpoint `getCourseStructure()` + mapping `lesson_id` prefix to `SkillCategory` |
| **D-7: Summary caching in DB** | Avoid re-generating summaries on every page load; currently in-memory Map (lost on restart) | LOW | `SummaryCache` model already in Prisma schema. Replace `summaryCache` Map in `ai.ts` with Prisma queries |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **AF-1: Real-time collaborative features** | "Add discussion forums, live chat between students" | Massive complexity (WebSockets, moderation, abuse), low value for a solo-learner niche product | Static FAQ per lesson; optional feedback form. Community can live in Telegram |
| **AF-2: Full LMS with SCORM/xAPI** | "Industry standard for content interop" | Over-engineering for MVP with single content source (Kinescope + transcripts). SCORM adds months of work | Keep current simple data model; add xAPI export later only if B2B demand appears |
| **AF-3: Custom video player** | "Build our own player for better control" | Kinescope already handles transcoding, CDN, DRM, analytics. Re-building is a multi-month project | Use Kinescope embed + their JS SDK for seek/events. Leverage, don't replace |
| **AF-4: Multi-language support** | "Translate to English/Kazakh" | All content (transcripts, questions, UI) is Russian. Translation doubles content effort | Keep Russian-only for MVP. i18n framework (next-intl) is cheap to add later for UI, content translation is the real bottleneck |
| **AF-5: Mobile native app** | "Students want mobile" | PWA or responsive web covers 90% of mobile needs. Native app adds App Store review, two codebases | Ensure responsive design (already using Tailwind). Add PWA manifest for home screen install |
| **AF-6: Gamification (badges, leaderboards, streaks)** | "Increases engagement" | Adds substantial DB/UI complexity, can feel gimmicky for professional audience (marketplace sellers) | Simple progress percentage + skill radar chart is already motivating. Add XP/badges only if retention data demands it |
| **AF-7: Overly strict access control** | "Lock ALL content behind paywall/diagnostic" | Frustrates users, increases bounce rate. Some preview content builds trust | Soft gating: show course catalog freely, lock video playback behind diagnostic completion, allow first lesson of each course for free |
| **AF-8: Microservice architecture for deployment** | "Separate API, frontend, worker services" | Single Next.js app is already the architecture. Splitting adds Docker orchestration, networking, 3x deployment complexity | Deploy as single `next start` process via PM2. Split only when scaling demands it |

## Feature Dependencies

```
[TS-1: DB Course Catalog]
    |-- requires --> Prisma seed script (courses + lessons in DB)
    |-- enables --> [D-6: Course structure from RAG]
    |-- enables --> [TS-4: Video player] (videoId comes from DB)
    |-- enables --> [D-2: Soft access gating] (need real lessons to gate)

[TS-4: Video player]
    |-- requires --> [TS-1: DB Course Catalog] (videoId mapping)
    |-- enables --> [TS-5: Timecode deep-links]
    |-- enables --> [D-4: Clickable timecodes in RAG]

[TS-5: Timecode deep-links]
    |-- requires --> [TS-4: Video player] (Kinescope SDK loaded)
    |-- requires --> RAG sources with timecodes (already working)

[D-1: AI Question Generation]
    |-- requires --> RAG chunks in DB (already have 5,291)
    |-- requires --> LLM access via OpenRouter (already configured)
    |-- enables --> [D-5: Adaptive difficulty] (need large question pool)
    |-- enables --> [TS-9: Question variety]

[D-2: Soft Access Gating]
    |-- requires --> [TS-3: Persistent diagnostics] (need to check completion)
    |-- requires --> [TS-1: DB Course Catalog] (need real lessons to gate)
    |-- enhances --> [D-3: Personalized path]

[D-3: Personalized Path]
    |-- requires --> [TS-3: Persistent diagnostics] (skill profile in DB)
    |-- requires --> [TS-2: Persistent progress] (track what's done)
    |-- enhances --> [D-2: Soft Access Gating]

[TS-6: Production Deploy]
    |-- requires --> [TS-7: Env management]
    |-- requires --> [TS-8: HTTPS/SSL]
    |-- requires --> [TS-10: Protected routes] (no public endpoints in prod)

[D-7: Summary cache in DB]
    |-- requires --> [TS-1: DB Course Catalog] (lessonId FK)
    |-- enhances --> AI performance (fewer LLM calls)
```

### Dependency Notes

- **TS-1 is the foundation**: Almost everything depends on real data in the database. This must be Phase 1.
- **TS-4 requires Kinescope videoIds**: This is an external dependency -- need the actual video IDs from the content team. If not available, video remains placeholder.
- **D-1 (AI questions) is the riskiest feature**: LLM-generated MCQs can have wrong "correct" answers. Needs validation layer or human review.
- **TS-6 (deploy) is independent of features**: Can be done in parallel. Deploy early, iterate on features in production.
- **D-5 (adaptive difficulty) depends on D-1**: Without a large generated question pool, there aren't enough questions per difficulty level to make IRT work.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept.

- [ ] **TS-1: DB Course Catalog** -- replace mocks with real Prisma queries; without this nothing else works
- [ ] **TS-2: Persistent lesson progress** -- progress must survive restarts
- [ ] **TS-3: Persistent diagnostic results** -- skill profiles must persist
- [ ] **TS-4: Video player** -- needs real Kinescope videoIds (external dependency)
- [ ] **TS-6: Production deploy** -- must be accessible online
- [ ] **TS-7 + TS-8: Env + SSL** -- required for deploy
- [ ] **TS-10: Protected routes** -- fix publicProcedure TODOs
- [ ] **D-2: Soft access gating** -- core value prop: diagnostic drives learning path
- [ ] **D-3: Personalized path** -- core value prop: weak areas get priority
- [ ] **D-7: Summary cache in DB** -- trivial, prevents wasted LLM costs

### Add After Validation (v1.x)

Features to add once core is working and real users are testing.

- [ ] **TS-5: Timecode deep-links** -- add when Kinescope SDK is integrated and users request it
- [ ] **D-1: AI question generation** -- add when mock questions feel repetitive (after ~50 diagnostic sessions)
- [ ] **D-4: Clickable timecodes** -- add alongside TS-5
- [ ] **D-6: Auto course structure from RAG** -- add when content team adds new courses

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **D-5: Adaptive difficulty (IRT-lite)** -- needs large question pool from D-1 first
- [ ] **AF-5: PWA manifest** -- add when mobile usage data justifies
- [ ] **AF-6: Gamification** -- add only if retention metrics demand it

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-1: DB Course Catalog | HIGH | MEDIUM | **P1** |
| TS-2: Persistent progress | HIGH | MEDIUM | **P1** |
| TS-3: Persistent diagnostics | HIGH | MEDIUM | **P1** |
| TS-4: Video player | HIGH | LOW (if videoIds available) | **P1** |
| TS-6: Production deploy | HIGH | MEDIUM | **P1** |
| TS-7: Env management | HIGH | LOW | **P1** |
| TS-8: HTTPS/SSL | HIGH | LOW | **P1** |
| TS-10: Protected routes | HIGH | LOW | **P1** |
| D-2: Soft access gating | HIGH | MEDIUM | **P1** |
| D-3: Personalized path | HIGH | MEDIUM | **P1** |
| D-7: Summary cache in DB | MEDIUM | LOW | **P1** |
| TS-5: Timecode deep-links | MEDIUM | MEDIUM | **P2** |
| D-4: Clickable timecodes | MEDIUM | MEDIUM | **P2** |
| D-1: AI question generation | HIGH | HIGH | **P2** |
| D-6: Auto course structure | MEDIUM | MEDIUM | **P2** |
| TS-9: Question variety | MEDIUM | HIGH (via D-1) | **P2** |
| D-5: Adaptive difficulty | MEDIUM | HIGH | **P3** |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Implementation Notes per Feature Area

### 1. DB Course Catalog (TS-1)

**What exists:** Prisma `Course` + `Lesson` models (schema ready), 5,291 `ContentChunk` records in Supabase, hardcoded `MOCK_COURSES` (5 courses, 20 lessons) and `MOCK_LESSONS` in `packages/api/src/mocks/courses.ts`.

**What to build:**
- Seed script that inserts 6 courses + 80+ lessons into `Course` / `Lesson` tables (derive from `content_chunk.lesson_id` distinct values)
- Rewrite `learningRouter` to query Prisma instead of importing mocks
- Map `lesson_id` prefixes to `SkillCategory`: `01_analytics` -> ANALYTICS, `02_ads` -> MARKETING, `03_ai` -> CONTENT, `04_workshops` -> OPERATIONS, `05_ozon` -> OPERATIONS, `06_express` -> FINANCE
- Keep mock data as fallback for offline/test scenarios

**Complexity:** MEDIUM. Schema exists, data exists in chunks table. Main work is seed script + router changes.

### 2. Persistent Storage (TS-2, TS-3)

**What exists:** `LessonProgress`, `DiagnosticSession`, `DiagnosticAnswer`, `SkillProfile` Prisma models (schema ready). In-memory Maps in routers.

**What to build:**
- Replace `mockProgress` Map in `learning.ts` with Prisma `LessonProgress` CRUD
- Replace `mockSessions` / `completedSessions` in `diagnostic.ts` with Prisma `DiagnosticSession` + `DiagnosticAnswer` CRUD
- Save `SkillProfile` to Prisma on diagnostic completion (replace `latestSkillProfiles` Map)
- Need `UserProfile` upsert on first login (trigger from auth callback or tRPC middleware)

**Complexity:** MEDIUM. Models exist, business logic exists in mock routers -- it's a migration, not a rewrite.

### 3. Video Player + Timecodes (TS-4, TS-5, D-4)

**What exists:** Kinescope iframe embed in `learn/[id]/page.tsx` with `lesson.videoId`. Currently all videoIds are "demo1"-"demo20" (placeholders). Timecodes returned from RAG as `timecodeFormatted: "03:42 - 04:15"`.

**What to build:**
- (TS-4) Obtain real Kinescope videoIds from content team. Update seed script / Lesson records. **External dependency.**
- (TS-5) Integrate Kinescope Player JS SDK (`@kinescope/player` npm package or `window.Kinescope` global). Replace raw `<iframe>` with SDK initialization. Implement `player.seekTo(seconds)`.
- (D-4) Make timecode badges in summary/chat UI clickable. On click, call `player.seekTo()`. Requires lifting player ref to shared state or using `window.postMessage`.

**Complexity:** TS-4 is LOW (data entry). TS-5 is MEDIUM (SDK integration). D-4 is MEDIUM (cross-component communication).

### 4. AI Question Generation (D-1)

**What exists:** 25 hardcoded questions in `packages/api/src/mocks/questions.ts`. RAG pipeline operational (embeddings, retrieval, generation). `getBalancedQuestions(15)` selects 3 per category.

**What to build:**
- `packages/ai/src/question-generator.ts`: fetch N random chunks for a skill category, prompt LLM to generate MCQ (question, 4 options, correct index, explanation, difficulty)
- Validation layer: check generated question has exactly 4 options, correct index is valid, no duplicate options
- Integration with `diagnostic.startSession()`: call AI generator, fall back to mock pool if LLM fails / rate limited
- Rate limiting: cache generated questions, don't regenerate per session
- Consider: pre-generate question bank (batch job) vs on-demand generation

**Complexity:** HIGH. Prompt engineering for reliable MCQ generation is non-trivial. Wrong "correct" answers degrade trust. Needs testing.

### 5. Soft Access Gating (D-2)

**What exists:** Diagnostic flow works (start session -> answer questions -> see results with skill profile + recommended path). No gating logic.

**What to build:**
- `hasCompletedDiagnostic(userId)` utility (query `DiagnosticSession` where status=COMPLETED)
- `LessonLocked.tsx` component: banner "Complete diagnostic to unlock personalized learning"
- In lesson page: check if user has completed diagnostic. If not, show locked overlay on video
- In /learn page: add "My Track" filter showing only `recommendedPath` lesson IDs
- First lesson of each course should be free (no gating) to reduce friction

**Complexity:** MEDIUM. Straightforward conditional rendering + DB query.

### 6. Production Deployment (TS-6, TS-7, TS-8)

**What exists:** VPS at 79.137.197.90 with Node.js 20, PM2, Docker, Nginx installed. `.env` with Supabase credentials configured locally.

**What to build:**
- `next.config.js`: add `output: 'standalone'` for self-contained production build
- PM2 ecosystem config: `ecosystem.config.js` with `next start` command, env vars, log rotation
- Nginx config: reverse proxy from port 80/443 to Next.js port 3000, SSL termination
- Let's Encrypt: `certbot --nginx` for auto SSL (need domain pointed to VPS IP)
- Deploy script: `git pull`, `pnpm install`, `pnpm build`, `pm2 restart`
- Update Google OAuth redirect URI in Supabase to production domain

**Complexity:** MEDIUM. Standard deployment pattern, but first-time setup has many steps. Need a domain name pointed to VPS.

**External dependency:** Domain name. Currently only IP 79.137.197.90 -- Google OAuth requires a real domain for redirect URI.

## Sources

- Codebase analysis: `packages/api/src/routers/` (diagnostic.ts, learning.ts, ai.ts), `packages/api/src/mocks/` (courses.ts, questions.ts), `packages/ai/src/generation.ts`, `packages/db/prisma/schema.prisma`, `apps/web/src/app/(main)/learn/[id]/page.tsx`
- CLAUDE.md project documentation (Sprint 3, Sprint 5 plans)
- Prisma schema analysis (all models defined but Course/Lesson tables not seeded)
- Training data: Next.js deployment patterns, Kinescope embed API, PM2/Nginx configuration (MEDIUM confidence -- web search unavailable for verification)

---
*Feature research for: MAAL Adaptive Learning Platform*
*Researched: 2026-02-16*
