# Phase 3: Video Integration - Research

**Researched:** 2026-02-18
**Domain:** Kinescope video player integration, timecode navigation, bulk video upload
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 integrates Kinescope video player into the existing lesson pages, replacing the current simple iframe/placeholder with a controllable player that supports programmatic seek (for timecode navigation from RAG citations). The codebase already has the `videoId` column in the Lesson model, `SourceCitation` types with `timecode_start`/`timecode_end` in the AI package, and timecode formatting utilities in both `packages/shared` and `packages/ai/src/retrieval.ts`.

The React Kinescope Player (`@kinescope/react-kinescope-player`) is the clear choice over raw iframe because it provides `seekTo(seconds)` via ref, React-native event handling, and Next.js SSR compatibility via dynamic import. The current lesson page already renders timecodes in RAG summary/chat sources, but they are static text -- making them clickable and wiring to `playerRef.current.seekTo()` is the core integration task.

A bulk upload script is needed because Kinescope is not yet configured and ~80+ videos sit locally at `E:\Academy Courses`. The Kinescope API uses Bearer token auth with uploads to `https://upload.new.video`. The script must upload videos, capture returned videoIds, and update Lesson records in Supabase.

**Primary recommendation:** Use `@kinescope/react-kinescope-player` with ref-based `seekTo()` for timecode navigation. Store videoId in existing Lesson.videoId column (already in schema). Build a Node.js bulk upload script using Kinescope REST API.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Kinescope player without autoplay -- video starts on user click
- Timecodes are clickable in RAG summary and chat
- AI panels (summary/chat) work even without video -- they are transcript-based
- Kinescope is not yet configured, videoId values do not exist yet
- Videos stored locally at `E:\Academy Courses`
- File names presumably match lesson_id (needs verification)
- Need bulk upload script with automatic mapping
- Need step-by-step Kinescope setup guide (registration, project, API key)

### Claude's Discretion
- Integration method (iframe vs SDK) -- choose optimal for timecode navigation
- Player layout on lesson page
- Custom controls -- minimal or standard Kinescope
- Timecode format (badge vs link)
- Behavior on timecode click (seek+play, scroll to player)
- Placeholder design
- Timecode behavior without video
- videoId storage (column in Lesson vs separate table)

### Deferred Ideas (OUT OF SCOPE)
- Watch progress tracking (percent watched) -- v2 requirement UX-04
- Administrative panel for video management -- v2 requirement CMS-01
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@kinescope/react-kinescope-player` | latest | React video player component | Official Kinescope React SDK; provides `seekTo()` via ref, TypeScript types, SSR-safe |
| `next/dynamic` | (built-in) | Dynamic import with `ssr: false` | Required for Kinescope player in Next.js (avoids `window` reference during SSR) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@kinescope/player-iframe-api-loader` | latest | Low-level iframe API | NOT recommended -- React wrapper is sufficient and simpler |
| `node-fetch` or built-in `fetch` | - | HTTP client for upload script | Bulk upload script to Kinescope API |
| `form-data` | ^4.x | Multipart form upload | Upload script for sending video files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Kinescope Player | Raw iframe + postMessage | No `seekTo()` via ref, manual event wiring, no TypeScript types |
| React Kinescope Player | `@kinescope/player-iframe-api-loader` | Lower-level, more boilerplate, no React integration |

**Installation:**
```bash
# In apps/web
pnpm add @kinescope/react-kinescope-player

# For upload script (root or scripts/)
pnpm add -D form-data node-fetch
```

## Architecture Patterns

### Recommendation: React Kinescope Player via Ref

The React player component supports imperative control via `useRef`:

```typescript
const playerRef = useRef<KinescopePlayerHandle>(null);

// Seek to timecode
playerRef.current?.seekTo(seconds);

// Get current time
const time = await playerRef.current?.getCurrentTime();
```

This is the optimal approach because:
1. `seekTo(seconds)` accepts numeric seconds -- our `timecode_start` is already stored as integer seconds in `content_chunk`
2. No postMessage/iframe gymnastics needed
3. TypeScript types included
4. Next.js SSR handled via documented `dynamic()` pattern

### Recommended Component Structure

```
apps/web/src/
├── components/
│   ├── video/
│   │   ├── KinescopePlayer.tsx      # Wrapper with ref forwarding + placeholder logic
│   │   ├── TimecodeLink.tsx         # Clickable timecode badge/link
│   │   └── VideoPlaceholder.tsx     # Shown when videoId is null
│   ├── diagnostic/
│   ├── learning/
│   └── shared/
├── hooks/
│   └── useVideoPlayer.ts           # Optional: shared state for player ref + seek
└── app/(main)/learn/[id]/
    └── page.tsx                     # Updated lesson page
```

### Pattern 1: Player Component with Dynamic Import

**What:** Wrapper around Kinescope React Player that handles SSR, missing videoId, and exposes ref for timecode seek.

**When to use:** Every lesson page that may or may not have a video.

**Example:**
```typescript
// Source: @kinescope/react-kinescope-player GitHub README
'use client';

import dynamic from 'next/dynamic';
import { forwardRef, useImperativeHandle, useRef } from 'react';

const KinescopePlayerRaw = dynamic(
  () => import('@kinescope/react-kinescope-player'),
  { ssr: false }
);

interface PlayerProps {
  videoId: string | null;
}

export interface PlayerHandle {
  seekTo: (seconds: number) => void;
}

export const VideoPlayer = forwardRef<PlayerHandle, PlayerProps>(
  ({ videoId }, ref) => {
    const playerRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds);
        playerRef.current?.play();
      },
    }));

    if (!videoId) {
      return <VideoPlaceholder />;
    }

    return (
      <KinescopePlayerRaw
        ref={playerRef}
        videoId={videoId}
        autoPlay={false}
        width="100%"
        height="100%"
      />
    );
  }
);
```

### Pattern 2: Clickable Timecode Component

**What:** Badge/link that triggers `seekTo()` on the player when clicked.

**When to use:** In RAG summary sources and chat message sources.

**Example:**
```typescript
interface TimecodeLinkProps {
  startSeconds: number;
  endSeconds: number;
  formattedTime: string; // e.g. "2:30 - 3:15"
  onSeek: (seconds: number) => void;
  disabled?: boolean; // true when no video
}

function TimecodeLink({ startSeconds, formattedTime, onSeek, disabled }: TimecodeLinkProps) {
  return (
    <button
      onClick={() => !disabled && onSeek(startSeconds)}
      disabled={disabled}
      className={cn(
        'text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1',
        disabled
          ? 'text-mp-gray-400 bg-mp-gray-100 cursor-not-allowed'
          : 'text-mp-blue-600 bg-mp-blue-50 hover:bg-mp-blue-100 cursor-pointer'
      )}
    >
      <PlayIcon className="w-3 h-3" />
      {formattedTime}
    </button>
  );
}
```

### Pattern 3: VideoId Storage

**Recommendation:** Use the existing `Lesson.videoId` column (already in Prisma schema).

The Prisma schema already has:
```prisma
model Lesson {
  videoId  String?  // Kinescope video ID (for API)
  videoUrl String?  // Kinescope embed URL (optional until configured)
}
```

No schema migration needed. The `videoUrl` column can be deprecated or used as a cache of the full embed URL.

### Anti-Patterns to Avoid
- **Direct iframe with `?t=` param for seek:** This reloads the iframe on every timecode click. Use React player `seekTo()` instead.
- **Global window event for player communication:** Fragile, not type-safe. Use React ref.
- **Storing videoId in a separate table:** Unnecessary -- 1:1 relationship already modeled in Lesson.
- **SSR rendering of Kinescope player:** Will crash because player accesses `window`. Always use `dynamic(() => import(...), { ssr: false })`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video player | Custom `<video>` or raw iframe | `@kinescope/react-kinescope-player` | DRM, adaptive bitrate, CDN, controls are Kinescope's job |
| Timecode seek | iframe URL parameter `?t=` | `playerRef.current.seekTo(s)` | URL param reloads iframe; seekTo is instant |
| Video upload | Manual dashboard upload for 80+ videos | Node.js script with Kinescope API | Manual upload for 80+ videos is impractical |
| SSR guard | Manual `typeof window !== 'undefined'` checks | `next/dynamic` with `ssr: false` | Cleaner, standard Next.js pattern |

**Key insight:** The Kinescope React player wraps all iframe complexity behind a React component with ref methods. Building any of this manually would be reinventing what the SDK already provides.

## Common Pitfalls

### Pitfall 1: SSR Crash with Kinescope Player
**What goes wrong:** Import of `@kinescope/react-kinescope-player` at top level causes `ReferenceError: window is not defined` during SSR.
**Why it happens:** The Kinescope player accesses browser globals (`window`, `document`) on import.
**How to avoid:** Always use `next/dynamic(() => import('@kinescope/react-kinescope-player'), { ssr: false })`.
**Warning signs:** Build errors or runtime crash on server-rendered pages.

### Pitfall 2: seekTo Before Player Ready
**What goes wrong:** Calling `seekTo()` before the player has loaded the video results in silent failure.
**Why it happens:** The player needs time to initialize and load the video stream.
**How to avoid:** Use the `onReady` callback to track player readiness. Queue seek commands if player not ready.
**Warning signs:** First timecode click does nothing, subsequent clicks work.

### Pitfall 3: Timecode Format Mismatch
**What goes wrong:** `seekTo()` expects seconds as number. Data in `content_chunk.timecode_start` is already integer seconds.
**Why it happens:** Confusion between display format ("2:30") and data format (150).
**How to avoid:** Always pass raw `timecode_start` (integer seconds) to `seekTo()`. Use `formatTimecode()` only for display.
**Warning signs:** Video seeks to wrong position.

### Pitfall 4: Bulk Upload File Name Mismatch
**What goes wrong:** Upload script assumes file names match lesson_id exactly, but actual files may have different naming.
**Why it happens:** The `E:\Academy Courses` folder structure is unverified.
**How to avoid:** First task must be to inspect the actual directory structure and create a mapping before writing upload logic.
**Warning signs:** Files not found, wrong videoId assigned to wrong lesson.

### Pitfall 5: Large File Upload Timeouts
**What goes wrong:** Uploading large video files (potentially several GB each) times out.
**Why it happens:** Default HTTP timeouts are too short for large uploads.
**How to avoid:** Use chunked/resumable upload if Kinescope supports it, or increase timeout. Add retry logic.
**Warning signs:** Upload script fails midway on large files.

## Code Examples

### Current State: What Exists

The lesson page (`apps/web/src/app/(main)/learn/[id]/page.tsx`) already has:

1. **VideoId check** (line 221-237): Renders iframe if `lesson.videoId` exists, placeholder otherwise
2. **Timecodes in sources** (line 396-399, 462-467): Displayed as static text badges
3. **Source citation type** from AI package: `{ id, timecodeFormatted, content }`

The AI generation service (`packages/ai/src/generation.ts`) returns:
```typescript
interface SourceCitation {
  id: string;
  lesson_id: string;
  content: string;
  timecode_start: number;  // <-- raw seconds, perfect for seekTo()
  timecode_end: number;
  timecodeFormatted: string;  // <-- display string like "2:30 - 3:15"
}
```

### Integration Point: Wiring Timecodes to Player

The key integration is passing `timecode_start` from `SourceCitation` to `playerRef.current.seekTo()`:

```typescript
// In lesson page
const playerRef = useRef<PlayerHandle>(null);

const handleTimecodeClick = (seconds: number) => {
  playerRef.current?.seekTo(seconds);
  // Optionally scroll to player if on mobile
  document.getElementById('video-player')?.scrollIntoView({ behavior: 'smooth' });
};

// In source rendering
{source.timecodeFormatted && (
  <TimecodeLink
    startSeconds={source.timecode_start}
    formattedTime={source.timecodeFormatted}
    onSeek={handleTimecodeClick}
    disabled={!lesson.videoId}
  />
)}
```

### Kinescope Setup Guide Structure

```
1. Register at kinescope.io
2. Create a project (e.g., "MPSTATS Academy")
3. Go to Settings -> API -> Generate API key
4. Save API key to .env as KINESCOPE_API_KEY
5. Note project_id from dashboard URL
6. Run upload script
```

### Bulk Upload Script Pattern

```typescript
// scripts/kinescope-upload.ts
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const KINESCOPE_API_KEY = process.env.KINESCOPE_API_KEY!;
const KINESCOPE_PROJECT_ID = process.env.KINESCOPE_PROJECT_ID!;
const VIDEO_DIR = 'E:\\Academy Courses';

async function uploadVideo(filePath: string, title: string): Promise<string> {
  const form = new FormData();
  form.append('video', fs.createReadStream(filePath));
  form.append('title', title);
  form.append('project_id', KINESCOPE_PROJECT_ID);

  const response = await fetch('https://upload.new.video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KINESCOPE_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form as any,
  });

  const data = await response.json();
  return data.id; // Kinescope video ID
}

// After upload, update Supabase Lesson.videoId
async function updateLessonVideoId(lessonId: string, videoId: string) {
  // Use Prisma or direct Supabase client
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `<iframe>` + `?t=` param | React Kinescope Player + `seekTo()` | Available since package creation | No iframe reload on seek, proper React lifecycle |
| `onKinescopeIframeAPIReady` callback | `@kinescope/player-iframe-api-loader` async/await | Loader package | Cleaner async API, but React wrapper is even better |
| Manual iframe postMessage | React ref methods | React wrapper | Type-safe, no manual event wiring |

**Current in codebase:**
- Lesson page uses raw `<iframe>` with Kinescope embed URL (line 222-227 of lesson page)
- This needs to be replaced with the React player component

## Discretion Recommendations

Based on research, here are recommendations for Claude's Discretion areas:

### Integration Method: React Player SDK (not iframe)
**Rationale:** `seekTo()` via ref is the only clean way to do timecode navigation without reloading the iframe. The React wrapper has TypeScript types, SSR docs, and is the official Kinescope React solution.

### Timecode Format: Badge with play icon
**Rationale:** Current code already renders timecodes as small badges (`text-xs text-mp-blue-600 bg-mp-blue-50 px-1.5 py-0.5 rounded`). Add a small play icon and cursor-pointer. This is minimal change from existing UI.

### Timecode Click Behavior: Seek + Play + Scroll on Mobile
**Rationale:** `seekTo()` + `play()` is the most intuitive behavior. On mobile (where player may be above the fold), also `scrollIntoView({ behavior: 'smooth' })` to the player.

### Placeholder Design: Improve existing
**Rationale:** Current placeholder is adequate (play icon + text). Enhance slightly: add "Video is being prepared" message, keep the aspect-video ratio, and show lesson duration.

### Timecodes Without Video: Show as disabled badges
**Rationale:** Hiding timecodes completely loses information. Showing them as grayed-out (cursor-not-allowed, muted colors) communicates "these are timecodes but no video available" while still showing the time range for reference.

### VideoId Storage: Existing Lesson.videoId column
**Rationale:** Already in Prisma schema. No migration needed. 1:1 with Lesson is the correct relationship.

### Timecode Scope: RAG sources only (not standalone table of contents)
**Rationale:** Building a table of contents from timecodes is a new feature beyond scope. RAG sources already have timecodes. Keep it simple.

## Open Questions

1. **Directory structure of `E:\Academy Courses`**
   - What we know: ~80+ lessons, 6 courses, files presumably match lesson_id
   - What's unclear: Actual file naming convention, folder structure, file formats (mp4? mkv?)
   - Recommendation: First task in plan should inspect directory and create mapping file

2. **Kinescope API exact upload response format**
   - What we know: POST to `https://upload.new.video` with Bearer token, returns video data
   - What's unclear: Exact response JSON structure, video_id field name, processing status
   - Recommendation: LOW confidence on exact API format. Script should log full response. Test with single video first.

3. **Kinescope pricing/limits for ~80 videos**
   - What we know: Kinescope is a paid platform with various plans
   - What's unclear: Storage limits, whether free tier exists for testing
   - Recommendation: Setup guide should note to check plan limits before bulk upload

4. **Kinescope React Player exact ref type**
   - What we know: README shows `playerRef.current.seekTo(30)` works
   - What's unclear: Exact TypeScript type name for the ref handle
   - Recommendation: Check actual types after `pnpm add`. Likely exported from package.

## Sources

### Primary (HIGH confidence)
- `@kinescope/react-kinescope-player` GitHub README -- props, ref methods (seekTo, play, pause, getCurrentTime), events (onReady, onTimeUpdate), Next.js dynamic import pattern
- Existing codebase: `packages/ai/src/generation.ts` -- SourceCitation type with timecode_start/timecode_end as integer seconds
- Existing codebase: `packages/db/prisma/schema.prisma` -- Lesson model already has videoId String? column
- Existing codebase: `apps/web/src/app/(main)/learn/[id]/page.tsx` -- current iframe implementation and timecode display

### Secondary (MEDIUM confidence)
- Kinescope API Postman docs (`documenter.getpostman.com/view/10589901/TVCcXpNM`) -- Bearer token auth, upload endpoint at `upload.new.video`
- `developers.kinescope.io` -- Platform API reference (could not fully access, but confirmed existence)
- WebSearch: Kinescope dashboard has API key generation in Settings

### Tertiary (LOW confidence)
- Exact upload API response format -- could not verify, needs testing with actual API call
- File naming in `E:\Academy Courses` -- needs filesystem inspection
- Kinescope pricing tiers and limits -- not researched in depth

## Metadata

**Confidence breakdown:**
- Standard stack (React Player): HIGH -- official package, documented README with seekTo example
- Architecture (ref-based seek): HIGH -- standard React pattern, documented by Kinescope
- Timecode integration: HIGH -- data types already exist in codebase (timecode_start as int seconds)
- Bulk upload API: MEDIUM -- endpoint confirmed but exact request/response format unverified
- File mapping (E:\Academy Courses): LOW -- directory structure not inspected

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain, Kinescope player API unlikely to change significantly)
