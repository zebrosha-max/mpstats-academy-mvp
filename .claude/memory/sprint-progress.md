---
name: MAAL Sprint Progress
description: Completed sprint tasks (0-5) with task IDs and file references — all done
type: project
---

All sprints complete. This is archival reference.

## Sprint 0: Project Setup (2025-12-21)
BE-0.1..0.5: Turborepo, Prisma+Supabase, tRPC routers, Docker Compose, ENV template
FE-0.1..0.4: Next.js 14, Tailwind, shadcn/ui, tRPC client
QA-0.1..0.3: Vitest, Playwright, CI Pipeline

## Sprint 1: Foundation (2025-12-22)
BE-1.1..1.9: Supabase project, client setup, UserProfile, Auth actions, Google OAuth, callback, middleware, tRPC context, Profile router
FE-1.1..1.8: Landing, Auth layout, Login, Register, Verify, Reset password, Main layout + Sidebar, Dashboard
QA-1.1..1.4: Auth integration tests (440 lines), Auth E2E, Landing E2E, Protected routes E2E

## Sprint 2: UI Shell (2025-12-22)
BE-2.1..2.5: Mock data types, Mock API, Diagnostic/Learning/Profile mock routers
FE-2.1..2.6: Diagnostic UI (intro, question, progress, session, results, radar chart)
FE-2.7..2.11: Learning UI (path, card, lesson, kinescope, AI panels)
FE-2.13..2.17: Dashboard, Stats, Activity, Profile, Diagnostic history
QA-2.2..2.5: Diagnostic flow E2E, Learning flow E2E, Responsive testing, Accessibility audit
Remaining: QA-2.1 (UI component tests — low priority)

## Sprint 2.5: UI Redesign (2025-12-24)
Design sources: Color System (wheel-next), Landing (Figma ltQb2G), Brand Guideline (Figma OmBVlW)
RD-1.1..1.4: Tailwind colors (mp-blue/green/pink/gray), CSS variables, Logo, Typography
RD-2.1..2.5: Button (7 variants), Card (7 variants), Badge (15+), Input, Logo integration
RD-3.1..3.7: Landing, Sidebar, Main layout, UserNav, MobileNav, Auth layout, Login
RD-4.1..4.9: All app pages redesigned with mp-colors
RD-5.1..5.8: CSS animations, Skeleton, Transitions, Staggered, Polish, Focus, Reduced motion, Dark mode vars

## Sprint 3: RAG Integration (2025-01-08)
5,291 chunks with embeddings in Supabase (content_chunk table)
AI-3.1: Prisma schema sync (ContentChunk, Course/Lesson models)
AI-3.2: AI package (OpenRouter, embeddings, retrieval, generation)
AI-3.3: tRPC AI router (getLessonSummary, chat, searchChunks)
AI-3.4: Frontend integration (Summary tab, Chat tab, Loading/Error states)
AI-3.5: Testing verified (summary, chat, vector search, timecodes)

## Sprint 4: Integration (2026-02-24)
Kinescope: 405 videos uploaded (209.4 GB), all videoId in DB
VPS: Docker, Nginx, UFW, fail2ban, SSL
Deploy: multi-stage build, HTTPS platform.mpstats.academy
OAuth fix, Nginx proxy buffer fix

## Sprint 5: RAG + Diagnostic (via GSD phases)
Phase A (1+9): Prisma routers, real data
Phase B (4+20+32): Diagnostic gate, paywall, custom track
Phase C (23): AI question generation from RAG chunks
Phase D (4+14): isRecommended badge, mobile responsive

## QA Test Suite (2026-03-24)
24 unit tests (Vitest): auth integration
31 E2E tests (Playwright): landing, protected-routes, auth-flow, diagnostic-flow, learning-flow, accessibility
Test user: tester@mpstats.academy (password in global memory)
