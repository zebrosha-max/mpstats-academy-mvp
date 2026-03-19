# Phase 26: Yandex Metrika - Research

**Researched:** 2026-03-19
**Domain:** Web analytics integration (Yandex.Metrika + Next.js App Router)
**Confidence:** HIGH

## Summary

Phase 26 is a straightforward analytics integration. The exact same pattern is already proven in the sibling project `mpstats-connect` with identical stack (Next.js App Router + `@koiztech/next-yandex-metrika`). The counter (94592073) is shared across `mpstats.academy` subdomains, goals are prefixed `platform_` for filtering.

The scope is small: install one package, add a component to root layout, create a helper module with typed goals, and wire `reachGoal()` calls into 6-7 existing pages/components. The payment goal requires client-side tracking after CloudPayments widget callback (not from the server webhook).

**Primary recommendation:** Copy the connect project's pattern verbatim (component, helper, constants, type declaration), adapt goal names to `platform_` prefix, and add `NEXT_PUBLIC_YANDEX_ID` to Dockerfile ARGs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Counter ID: **94592073** (shared with connect.mpstats.academy)
- Goals prefix: `platform_` (8 goals defined with exact names and params)
- Library: `@koiztech/next-yandex-metrika` v0.0.8
- All features enabled: webvisor, clickmap, trackLinks, accurateTrackBounce
- Strategy: `afterInteractive`
- Production-only rendering (`NODE_ENV === 'production'`)
- No consent check (Phase 25 will handle later)
- ENV variable: `NEXT_PUBLIC_YANDEX_ID=94592073`
- Helper module pattern: `lib/analytics/metrika.ts` + `lib/analytics/constants.ts`
- Ecommerce via reachGoal params (not full dataLayer)

### Claude's Discretion
- Exact call sites for reachGoal in components (which handlers/useEffect)
- noscript `<img>` fallback for Metrika
- Adding NEXT_PUBLIC_YANDEX_ID to Dockerfile ARGs

### Deferred Ideas (OUT OF SCOPE)
- Cookie consent banner (Phase 25)
- GTM/Google Analytics
- A/B tests via Metrika
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@koiztech/next-yandex-metrika` | 0.0.8 | YandexMetrika component for Next.js App Router | Already used in connect project, handles SPA page hits automatically |

### Supporting
No additional dependencies needed. The helper module and type declarations are project files.

**Installation:**
```bash
cd apps/web && pnpm add @koiztech/next-yandex-metrika
```

**Version verification:** `npm view @koiztech/next-yandex-metrika version` returned `0.0.8` (confirmed 2026-03-19).

## Architecture Patterns

### Recommended File Structure
```
apps/web/src/
├── lib/
│   └── analytics/
│       ├── metrika.ts          # reachGoal() safe helper
│       └── constants.ts        # METRIKA_GOALS typed constants
├── types/
│   └── yandex-metrika.d.ts     # Window.ym global type
└── app/
    └── layout.tsx              # <YandexMetrika> component added here
```

### Pattern 1: YandexMetrika Component in Root Layout
**What:** `<YandexMetrika>` renders inside `<body>`, conditionally in production only.
**When to use:** Always — single place for counter initialization.
**Example (from connect, verified working):**
```typescript
// apps/web/src/app/layout.tsx — inside <body>, after <Toaster/>
import { YandexMetrika } from '@koiztech/next-yandex-metrika';

{process.env.NODE_ENV === 'production' && (
  <YandexMetrika
    clickmap={true}
    trackLinks={true}
    accurateTrackBounce={true}
    webvisor={true}
    strategy="afterInteractive"
  />
)}
```

### Pattern 2: Safe reachGoal Helper
**What:** Type-safe wrapper around `window.ym()` with null checks.
**When to use:** Every goal tracking call site.
**Example (from connect `lib/analytics/metrika.ts`):**
```typescript
import type { MetrikaGoal } from './constants';

export function reachGoal(goal: MetrikaGoal, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!window.ym) return;
  const counterId = process.env.NEXT_PUBLIC_YANDEX_ID;
  if (!counterId) return;
  window.ym(parseInt(counterId, 10), 'reachGoal', goal, params);
}
```

### Pattern 3: Typed Goal Constants
**What:** `as const` object with all goal names, derived union type.
**Example:**
```typescript
export const METRIKA_GOALS = {
  SIGNUP: 'platform_signup',
  LOGIN: 'platform_login',
  DIAGNOSTIC_START: 'platform_diagnostic_start',
  DIAGNOSTIC_COMPLETE: 'platform_diagnostic_complete',
  LESSON_OPEN: 'platform_lesson_open',
  PRICING_VIEW: 'platform_pricing_view',
  PAYMENT: 'platform_payment',
  CTA_CLICK: 'platform_cta_click',
} as const;

export type MetrikaGoal = (typeof METRIKA_GOALS)[keyof typeof METRIKA_GOALS];
```

### Pattern 4: Window.ym Type Declaration
**What:** Global type augmentation for `window.ym` to avoid TS errors.
**Example (from connect `types/yandex-metrika.d.ts`):**
```typescript
export {};

declare global {
  interface Window {
    ym?: (
      counterId: number,
      method: 'hit' | 'reachGoal' | 'params' | 'userParams' | 'init',
      ...args: unknown[]
    ) => void;
  }
}
```

### Anti-Patterns to Avoid
- **Calling `window.ym()` directly:** Always use the `reachGoal()` helper for null-safety and type checking.
- **Server-side reachGoal calls:** `window` does not exist on server. The payment webhook (`/api/webhooks/cloudpayments`) cannot call reachGoal — must track on the client after widget callback.
- **Hardcoding counter ID:** Use `NEXT_PUBLIC_YANDEX_ID` env var, not a literal number.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SPA page view tracking | Custom router listener | `@koiztech/next-yandex-metrika` | Handles App Router navigation events automatically |
| Metrika script loading | `<script>` tag manually | `YandexMetrika` component | Handles async loading, strategy, noscript fallback |

## Common Pitfalls

### Pitfall 1: NEXT_PUBLIC_YANDEX_ID Missing from Dockerfile
**What goes wrong:** Counter works in dev but not in Docker production build. Goals silently fail.
**Why it happens:** `NEXT_PUBLIC_*` vars are inlined at build time by Next.js. Without `ARG` in Dockerfile, the value is empty in the built bundle.
**How to avoid:** Add `ARG NEXT_PUBLIC_YANDEX_ID` and `ENV NEXT_PUBLIC_YANDEX_ID=$NEXT_PUBLIC_YANDEX_ID` to Dockerfile (same pattern as existing `NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID`).
**Warning signs:** No Metrika data appearing for production traffic despite correct `.env`.

### Pitfall 2: Payment Goal — Server vs Client
**What goes wrong:** Trying to call `reachGoal` in the CloudPayments webhook handler (server-side API route).
**Why it happens:** Payment confirmation arrives via webhook (server → server), but `window.ym` only exists on client.
**How to avoid:** Track `platform_payment` in the CloudPayments widget's `onSuccess` callback on the client side (pricing page), not in the webhook handler. The widget callback has access to the payment amount and plan info.
**Warning signs:** Payment goals never fire despite successful transactions.

### Pitfall 3: Double-Tracking with Carrot Quest
**What goes wrong:** Both CQ and YM track the same event, inflating metrics.
**Why it happens:** CQ already tracks `User Registered`, `Payment Success`, etc.
**How to avoid:** This is actually fine — CQ and YM serve different purposes (email automation vs web analytics). Both should fire. Just be aware during analysis.

### Pitfall 4: Goals Not Created in Metrika Dashboard
**What goes wrong:** `reachGoal` fires but goals don't appear in Metrika reports.
**Why it happens:** Goals must be created in the Yandex.Metrika dashboard (Settings > Goals) with the exact same identifiers as in code.
**How to avoid:** After deploying code, create all 8 goals in the Metrika dashboard. Use "JavaScript event" type with exact goal identifiers.
**Warning signs:** Goals appear in real-time but not in conversion reports.

### Pitfall 5: noscript Image Tag
**What goes wrong:** Missing noscript tracking for users with JS disabled.
**How to avoid:** The `@koiztech/next-yandex-metrika` component should handle this. Verify by checking the rendered HTML for a `<noscript><img>` tag. If missing, add manually:
```html
<noscript>
  <div>
    <img src="https://mc.yandex.ru/watch/94592073" style="position:absolute;left:-9999px" alt="" />
  </div>
</noscript>
```

## Code Examples

### Goal Call Sites (Recommended Implementation)

#### Signup (register page — after successful registration)
```typescript
// apps/web/src/app/(auth)/register/page.tsx
import { reachGoal } from '@/lib/analytics/metrika';
import { METRIKA_GOALS } from '@/lib/analytics/constants';

// In the success handler after signUp/OAuth completes:
reachGoal(METRIKA_GOALS.SIGNUP, { method: 'email' }); // or 'yandex'
```

#### Login (login page — after successful auth)
```typescript
// apps/web/src/app/(auth)/login/page.tsx
reachGoal(METRIKA_GOALS.LOGIN, { method: 'email' }); // or 'yandex'
```

#### Diagnostic Start (session page — on mount/start)
```typescript
// apps/web/src/app/(main)/diagnostic/session/page.tsx
// In useEffect on session creation:
reachGoal(METRIKA_GOALS.DIAGNOSTIC_START);
```

#### Diagnostic Complete (results page — on mount)
```typescript
// apps/web/src/app/(main)/diagnostic/results/page.tsx
// In useEffect when results load:
reachGoal(METRIKA_GOALS.DIAGNOSTIC_COMPLETE, { avgScore });
```

#### Lesson Open (lesson page — on mount)
```typescript
// apps/web/src/app/(main)/learn/[id]/page.tsx
// In useEffect when lesson data loads:
reachGoal(METRIKA_GOALS.LESSON_OPEN, { courseId, lessonId });
```

#### Pricing View (pricing page — on mount)
```typescript
// apps/web/src/app/pricing/page.tsx
// In useEffect on mount:
reachGoal(METRIKA_GOALS.PRICING_VIEW);
```

#### Payment (pricing page — CloudPayments widget onSuccess)
```typescript
// In the CP widget success callback (client-side):
reachGoal(METRIKA_GOALS.PAYMENT, { planId, amount, currency: 'RUB' });
```

#### CTA Click (landing page — click handler)
```typescript
// apps/web/src/app/page.tsx
// On CTA button onClick:
reachGoal(METRIKA_GOALS.CTA_CLICK, { position: 'hero' }); // or 'features', 'footer'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `<script>` tag + custom SPA tracking | `@koiztech/next-yandex-metrika` component | 2024+ | Handles App Router navigation automatically |
| Untyped `ym()` calls | Typed `reachGoal()` helper + constants | Pattern from connect | Type safety, centralized goal management |

## Open Questions

1. **noscript tag handling**
   - What we know: `@koiztech/next-yandex-metrika` may or may not render a noscript fallback
   - What's unclear: Need to verify rendered output after installation
   - Recommendation: Check after adding component; add manual noscript if missing

2. **Metrika dashboard goal creation**
   - What we know: 8 goals need to be created as "JavaScript event" type
   - What's unclear: Who has access to Yandex.Metrika dashboard for counter 94592073
   - Recommendation: Human-action checkpoint — document the 8 goals to create, owner does it manually

## Existing Integration Points

### Dockerfile (line 24-33)
Existing pattern for `NEXT_PUBLIC_*` ARGs — add one more:
```dockerfile
ARG NEXT_PUBLIC_YANDEX_ID
ENV NEXT_PUBLIC_YANDEX_ID=$NEXT_PUBLIC_YANDEX_ID
```

### Root Layout (`apps/web/src/app/layout.tsx`)
Already has: theme script, Carrot Quest script, TRPCProvider, Toaster.
Add `<YandexMetrika>` after `<Toaster/>` inside `<body>`, wrapped in production check.

### .env.example / .env.production
Add `NEXT_PUBLIC_YANDEX_ID=94592073` to both.

### docker-compose.yml
Add `NEXT_PUBLIC_YANDEX_ID` to build args (same as other NEXT_PUBLIC vars).

## Sources

### Primary (HIGH confidence)
- `D:\GpT_docs\mpstats-connect\web\app\layout.tsx` — verified working YandexMetrika integration
- `D:\GpT_docs\mpstats-connect\web\lib\analytics\metrika.ts` — reachGoal helper pattern
- `D:\GpT_docs\mpstats-connect\web\lib\analytics\constants.ts` — typed goals pattern
- `D:\GpT_docs\mpstats-connect\web\types\yandex-metrika.d.ts` — Window.ym type declaration
- npm registry: `@koiztech/next-yandex-metrika@0.0.8` (verified 2026-03-19)
- MAAL Dockerfile (lines 24-33) — existing NEXT_PUBLIC ARG pattern

### Secondary (MEDIUM confidence)
- Yandex.Metrika API: `window.ym(counterId, 'reachGoal', goal, params)` — standard API, well-documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact same library already used in connect project
- Architecture: HIGH — copying proven pattern from sibling project
- Pitfalls: HIGH — Dockerfile ARG issue was already encountered with CloudPayments (MEMORY.md)

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable — analytics SDK rarely changes)
