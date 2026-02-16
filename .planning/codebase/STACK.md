# Technology Stack

**Analysis Date:** 2026-02-16

## Languages

**Primary:**
- TypeScript 5.3.3 - All application code (strict mode enabled)

**Secondary:**
- JavaScript - Configuration files (next.config.js)

## Runtime

**Environment:**
- Node.js 20+ (LTS)

**Package Manager:**
- pnpm 9.15.0
- Lockfile: present (`pnpm-lock.yaml`)

## Frameworks

**Core:**
- Next.js 14.2.15 - App Router, React Server Components
- React 18.3.1 - UI library
- Turborepo 2.3.0 - Monorepo orchestration

**Testing:**
- Vitest 2.1.3 - Unit/integration tests with jsdom
- Playwright 1.48.1 - E2E tests (chromium, firefox, webkit, mobile)
- @testing-library/react 16.0.1 - Component testing utilities

**Build/Dev:**
- Tailwind CSS 3.4.14 - Utility-first styling
- PostCSS 8.4.47 - CSS processing
- Autoprefixer 10.4.20 - CSS vendor prefixes
- ESLint 8.57.0 - Linting (next/core-web-vitals config)
- Prettier 3.2.5 - Code formatting

## Key Dependencies

**Critical:**
- tRPC 11.0.0-rc.608 - Type-safe API layer (client + server + react-query)
- Prisma 5.22.0 - ORM with pgvector support
- @supabase/supabase-js 2.45.0 - Supabase SDK for auth and database
- @supabase/ssr 0.5.1 - Server-side rendering support for Supabase
- OpenAI SDK 4.73.0 - LLM client (used with OpenRouter API)

**Infrastructure:**
- @tanstack/react-query 5.59.0 - Data fetching/caching
- Zod 3.23.8 - Runtime type validation
- SuperJSON 2.2.1 - Serialization for tRPC
- Recharts 2.15.4 - Chart library for radar diagrams

**UI Components:**
- @radix-ui/react-slot 1.1.0 - Primitive component utilities
- lucide-react 0.453.0 - Icon library
- class-variance-authority 0.7.0 - Component variants
- tailwind-merge 2.5.4 - Class name merging
- tailwindcss-animate 1.0.7 - Animation utilities

## Configuration

**Environment:**
- Configuration via `.env` file
- Template provided: `.env.example`
- Required variables: Supabase credentials, OpenRouter API key, database URLs

**Build:**
- `turbo.json` - Pipeline configuration for build tasks
- `tsconfig.json` - TypeScript strict mode (target: ES2022)
- `next.config.js` - React strict mode, transpilePackages for monorepo
- `tailwind.config.ts` - Custom MPSTATS brand colors and design tokens
- `vitest.config.ts` - jsdom environment, coverage with v8
- `playwright.config.ts` - Multi-browser testing config

## Platform Requirements

**Development:**
- Node.js ≥20.0.0
- pnpm ≥9.0.0
- Docker Compose (optional for local PostgreSQL)

**Production:**
- VPS: 79.137.197.90 (Ubuntu 24.04 LTS)
- Deployment tools: PM2 (process manager), Nginx (reverse proxy)
- Database: Supabase cloud (PostgreSQL 16 with pgvector extension)

---

*Stack analysis: 2026-02-16*
