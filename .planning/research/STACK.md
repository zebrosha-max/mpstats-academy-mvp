# Stack Research

**Domain:** Educational platform — video integration, VPS deploy, AI question generation
**Researched:** 2026-02-16
**Confidence:** MEDIUM (web tools unavailable; versions verified via npm registry; patterns based on training data + codebase analysis)

## Scope

This research covers **only the additions** needed for Sprints 4-5. The existing stack (Next.js 14, tRPC 11, Supabase, Prisma, Turborepo, OpenRouter, Recharts, shadcn/ui) is already in place and working. We do NOT re-evaluate those choices.

Three areas researched:
1. **Kinescope video player integration** in Next.js
2. **Next.js production deploy** on VPS with PM2/Nginx
3. **AI-generated assessment questions** from RAG data

---

## 1. Kinescope Video Player Integration

### Recommended Stack

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `@kinescope/player-iframe-api-loader` | 0.9.0 | Typed iframe API for Kinescope player | Most recent package (Dec 2025), TypeScript types included, lightweight loader. Does NOT bundle the player — loads it via iframe which is Kinescope's recommended approach. | HIGH (verified via npm registry) |
| Plain iframe embed (current) | N/A | Fallback / simplest approach | Already implemented in `learn/[id]/page.tsx`. Works without any npm package. | HIGH (already in codebase) |

### Decision: Use `@kinescope/player-iframe-api-loader` (0.9.0)

**Rationale:**
- The project already has a working iframe embed (`https://kinescope.io/embed/${videoId}`). This works but provides zero programmatic control.
- The iframe API loader adds: play/pause control, seek to timecode (critical for RAG citation links), playback events (for watch progress tracking), and TypeScript types.
- The alternative React wrapper (`@kinescope/react-kinescope-player` v0.5.4, last updated Apr 2025) is older, lower version, and wraps the same iframe API. The loader is more flexible for Next.js App Router (no SSR issues with iframes).

### What NOT to use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@kinescope/react-kinescope-player` (0.5.4) | Older package, less recently maintained, adds React abstraction over what is already an iframe. In App Router `'use client'` components, direct iframe + API loader is simpler. | `@kinescope/player-iframe-api-loader` or plain iframe |
| Custom video.js / hls.js player | Kinescope handles DRM/streaming. Building your own player defeats the purpose of using Kinescope. | Kinescope iframe |
| Server-side rendering of video | Kinescope player is client-only (iframe). Attempting SSR causes hydration errors. | Always render in `'use client'` component |

### Installation

```bash
pnpm add @kinescope/player-iframe-api-loader@^0.9.0 --filter=@mpstats/web
```

### Integration Pattern

```typescript
// components/video/KinescopePlayer.tsx ('use client')
// 1. Load iframe API via the loader
// 2. Create player instance targeting an iframe element
// 3. Use player.seekTo(seconds) for timecode citations from RAG
// 4. Listen to player.on('timeupdate') for watch progress tracking
// 5. Expose onProgress callback to parent for saving to DB
```

### Key Integration Points

| Feature | How | Complexity |
|---------|-----|------------|
| Basic playback | iframe embed (already done) | Done |
| Timecode seek from RAG citations | `player.seekTo(seconds)` via API loader | Low |
| Watch progress tracking | `timeupdate` event -> save to Supabase | Medium |
| Resume from last position | Load `lastWatchedPosition` from DB, `seekTo` on mount | Low |

---

## 2. Next.js Production Deploy on VPS

### Recommended Stack

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Next.js standalone output | 14.2.x (current) | Self-contained production build | `output: 'standalone'` in next.config.js produces a minimal node server. No need for `node_modules` on VPS — everything is bundled. Standard approach for self-hosted deploy. | HIGH (well-documented Next.js feature) |
| PM2 | 6.0.14 | Process manager | Auto-restart on crash, cluster mode, log management, zero-downtime reload. Already installed on VPS (`PM2 5.x`). Upgrade to 6.x recommended. | HIGH (verified via npm, standard practice) |
| Nginx | 1.24+ | Reverse proxy + SSL | Handles HTTPS termination, static file serving, gzip, rate limiting. Standard for Ubuntu VPS. | HIGH (industry standard) |
| Certbot / Let's Encrypt | latest | SSL certificates | Free, automated SSL renewal. Standard for self-hosted. | HIGH |
| GitHub Actions | N/A | CI/CD deployment pipeline | Already have `.github/workflows/ci.yml`. Add deploy job that SSH's into VPS, pulls, builds, restarts PM2. | MEDIUM |

### Deploy Architecture

```
Client -> Nginx (:443 HTTPS) -> PM2 (Next.js :3000) -> Supabase (cloud)
                                                     -> OpenRouter (cloud)
```

### Critical Configuration: `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // <-- ADD THIS
  reactStrictMode: true,
  transpilePackages: ['@mpstats/api', '@mpstats/db', '@mpstats/shared'],
  // ... rest unchanged
};
```

**Why `standalone`:** Without it, Next.js expects the full `node_modules` directory at runtime. With `standalone`, it creates a `.next/standalone/` folder with only the files needed to run, plus a minimal `server.js` entry point. This reduces deploy size from ~500MB to ~50MB.

### PM2 Ecosystem Config

```javascript
// ecosystem.config.js (root of project on VPS)
module.exports = {
  apps: [{
    name: 'mpstats-academy',
    script: '.next/standalone/server.js',
    cwd: '/home/deploy/mpstats-academy',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
    },
    instances: 1,           // Single instance for MVP (VPS resources)
    exec_mode: 'fork',
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/home/deploy/logs/mpstats-error.log',
    out_file: '/home/deploy/logs/mpstats-out.log',
  }],
};
```

### Nginx Config Pattern

```nginx
server {
    listen 443 ssl http2;
    server_name academy.mpstats.io;  # actual domain TBD

    ssl_certificate /etc/letsencrypt/live/academy.mpstats.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/academy.mpstats.io/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets from Next.js
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Deploy Script Pattern

```bash
#!/bin/bash
# deploy.sh — run on VPS or via SSH from CI
set -e

cd /home/deploy/mpstats-academy
git pull origin master
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build

# Copy static assets to standalone (required!)
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

pm2 reload ecosystem.config.js
```

### What NOT to use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Docker for Next.js (on this VPS) | Adds complexity for a single-app VPS. Docker is already used for n8n. Running Next.js directly with PM2 is simpler and uses less memory. | PM2 + standalone |
| `next start` directly | No process management, no auto-restart, no log rotation | PM2 wrapping standalone server.js |
| Vercel / Netlify | Project requirement is self-hosted VPS | PM2 + Nginx |
| Apache | Nginx is superior for reverse proxy + WebSocket support | Nginx |
| PM2 cluster mode (multiple instances) | VPS likely has limited RAM. Cluster mode doubles memory. One instance is fine for MVP scale. | Single fork mode, scale later |

### Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 14.2.x | Node.js 20.x | VPS has Node.js 20.19.6 — compatible |
| PM2 6.0.x | Node.js 20.x | Upgrade from 5.x on VPS: `pnpm add -g pm2@latest` |
| Prisma 5.x | Node.js 20.x | Needs `prisma generate` on VPS before build |
| pnpm 9.x | Node.js 20.x | Install on VPS: `corepack enable && corepack prepare pnpm@9.15.0 --activate` |

---

## 3. AI-Generated Assessment Questions from RAG Data

### Recommended Stack

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| OpenRouter (existing) | N/A | LLM provider for question generation | Already configured and working for summary/chat. Same client, same billing. No new dependency. | HIGH (already in codebase) |
| OpenAI SDK (existing) | ^4.73.0 | API client | Already used in `packages/ai/src/openrouter.ts`. Supports structured outputs via `response_format`. | HIGH |
| Zod | ^3.23.8 (existing) | Schema validation for LLM output | Already in the project. Use Zod schemas to validate LLM-generated questions match expected format. Rejects malformed output. | HIGH |
| `google/gemini-2.5-flash` (existing) | N/A | Primary model for generation | Already the default model. Fast, cheap, good at structured output. Perfect for generating quiz questions. | HIGH |

### Architecture: Question Generation Pipeline

```
RAG Chunks (Supabase) -> Select chunks by skill category
                      -> Build prompt with schema instructions
                      -> LLM generates JSON (structured output)
                      -> Zod validates response
                      -> Return typed questions
                      -> Fallback to mock questions on failure
```

### Key Design Decisions

**Use JSON mode, NOT function calling for question generation:**
- OpenRouter passes `response_format: { type: "json_object" }` to Gemini
- Include the Zod schema as instructions in the system prompt
- Validate the response with `questionSchema.safeParse()`
- This is simpler and more portable across models than function calling

**Why NOT Vercel AI SDK for this:**
- Vercel AI SDK (`ai` package, currently v6.0.86) is designed for streaming chat UIs
- Question generation is a batch operation — send prompt, get structured JSON back
- The existing OpenAI SDK + OpenRouter setup handles this perfectly
- Adding Vercel AI SDK would add a dependency for no benefit here

### Question Schema (Zod)

```typescript
// packages/ai/src/question-generator.ts
import { z } from 'zod';

const questionSchema = z.object({
  questions: z.array(z.object({
    text: z.string().min(10),
    category: z.enum(['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE']),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    options: z.array(z.object({
      text: z.string(),
      isCorrect: z.boolean(),
    })).length(4),
    explanation: z.string(),
    sourceChunkId: z.string().optional(),
  })).min(1).max(10),
});
```

### Generation Strategy

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Chunks per question | 2-3 chunks as context | Enough context for meaningful question, not so much it confuses the model |
| Questions per session | 10-15 | Matches current mock diagnostic length |
| Category balance | 2-3 questions per skill axis | Ensures all 5 axes are tested |
| Difficulty | Start MEDIUM, adapt based on answers | IRT-lite: correct -> HARD, incorrect -> EASY |
| Caching | Cache generated questions per category+difficulty for 24h | Avoid re-generating identical questions; invalidate when new chunks are added |
| Fallback | Mock questions from `mocks/questions.ts` | If LLM is down or rate-limited, diagnostic still works |
| Rate limiting | 1 generation request per user per minute | Prevent abuse; question generation is expensive |

### What NOT to use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vercel AI SDK (`ai` package) | Overkill for batch question generation. Designed for streaming chat. Adds ~200KB dependency for no benefit. | Direct OpenAI SDK calls (already in project) |
| Fine-tuned model | MVP scale doesn't justify fine-tuning cost/complexity. Prompt engineering with RAG context is sufficient. | Few-shot prompting with examples in system prompt |
| LangChain | Heavy abstraction layer. Project already has a clean, minimal RAG pipeline. LangChain would add complexity without value. | Direct OpenAI SDK + Supabase vector search (existing) |
| Embedding-based question matching | Generating questions is better than matching pre-made ones. RAG chunks are transcripts, not question banks. | LLM generation from RAG context |
| Client-side generation | Questions must be generated server-side to prevent cheating (seeing answers in network tab) | tRPC protectedProcedure (server-side only) |

---

## Alternatives Considered (Cross-cutting)

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| Video player | Kinescope iframe + API loader | Kinescope React wrapper (0.5.4) | If you need a drop-in React component and don't need fine control over iframe lifecycle |
| Process manager | PM2 6.x | systemd service | If you want zero external dependencies and are comfortable writing systemd units |
| Reverse proxy | Nginx | Caddy | If you want automatic HTTPS without Certbot (Caddy auto-provisions certs). Slightly simpler config. |
| LLM for questions | Gemini 2.5 Flash via OpenRouter | GPT-4o-mini via OpenRouter | If Gemini structured output quality is insufficient. GPT-4o-mini is the configured fallback. |
| Question format | JSON mode + Zod validation | OpenAI function calling | If using OpenAI directly (not via OpenRouter). Function calling is less portable across providers. |

---

## Installation Summary

```bash
# Kinescope (new dependency)
pnpm add @kinescope/player-iframe-api-loader@^0.9.0 --filter=@mpstats/web

# VPS setup (run on server, not locally)
npm install -g pm2@latest    # Upgrade PM2 from 5.x to 6.x
sudo apt install nginx certbot python3-certbot-nginx  # If not already installed

# No new npm packages needed for question generation
# Uses existing: openai, zod, @supabase/supabase-js
```

---

## Stack Patterns by Variant

**If Kinescope videoIds are not yet available:**
- Keep the current placeholder UI (already implemented)
- Build the `KinescopePlayer` component with a mock videoId
- Wire up timecode seek from RAG citations
- Swap in real videoIds when received

**If VPS memory is constrained (<2GB):**
- Use PM2 fork mode (not cluster)
- Set `max_memory_restart: '512M'`
- Consider `next.config.js` -> `swcMinify: true` (default in 14.x)
- Monitor with `pm2 monit`

**If LLM rate limits are hit during question generation:**
- Implement question cache (Redis or in-memory with TTL)
- Pre-generate question pools during off-peak hours
- Fall back to mock questions immediately

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| Next.js | 14.2.x | Node.js 18-22, React 18 | Current in project. Do NOT upgrade to 15.x during deploy sprint — breaking changes. |
| PM2 | 6.0.14 | Node.js 16+ | Stable. VPS needs upgrade from 5.x. |
| `@kinescope/player-iframe-api-loader` | 0.9.0 | Any (loads via script tag) | No framework dependency |
| `@kinescope/react-kinescope-player` | 0.5.4 | React 16-19 | NOT recommended (see above) |
| OpenAI SDK | 4.73.0 | Node.js 18+ | Already in project. Works with OpenRouter. |
| Prisma | 5.x | Node.js 16.13+ | Needs `generate` on VPS. |
| pnpm | 9.15.0 | Node.js 18.12+ | Must be installed on VPS via corepack. |

---

## Sources

- npm registry — `@kinescope/player-iframe-api-loader@0.9.0` (verified 2026-02-16, published 2025-12-05)
- npm registry — `@kinescope/react-kinescope-player@0.5.4` (verified 2026-02-16, published 2025-04-04)
- npm registry — `pm2@6.0.14` (verified 2026-02-16)
- npm registry — `next@16.1.6` latest, project uses `14.2.x` (verified 2026-02-16)
- npm registry — `openai@6.22.0` latest, project uses `4.73.0` (verified 2026-02-16)
- npm registry — `ai@6.0.86` (Vercel AI SDK, considered but not recommended)
- Existing codebase analysis: `packages/ai/src/`, `apps/web/src/app/(main)/learn/[id]/page.tsx`, `next.config.js`, `package.json`
- Project documentation: `CLAUDE.md`, `docs/02_technical_spec/TECHNICAL_SPEC.md`
- LOW confidence items: Nginx config patterns, deploy script patterns, question generation prompting strategy (based on training data, not verified against current docs due to web tool restrictions)

---
*Stack research for: MAAL — Kinescope, VPS Deploy, AI Question Generation*
*Researched: 2026-02-16*
