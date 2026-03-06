# Architecture Patterns: Auth Rework + Billing

**Domain:** Payment-gated educational platform (adding auth migration + billing to existing Next.js/Supabase app)
**Researched:** 2026-03-06
**Confidence:** MEDIUM (Yandex ID + Supabase integration has no built-in support; CloudPayments patterns well-documented)

---

## Existing Architecture (Unchanged Core)

```
apps/web/
  src/middleware.ts           # Auth guard: Supabase session check, redirect unauthenticated
  src/app/api/trpc/           # tRPC handler (fetchRequestHandler, injects user into context)
  src/lib/supabase/           # Supabase SSR client (cookies-based)
  src/lib/auth/actions.ts     # Server actions: signIn, signUp, signInWithGoogle, signOut
  src/app/auth/callback/      # OAuth callback: exchangeCodeForSession

packages/api/src/trpc.ts      # Context: { prisma, user }
                               # Procedures: publicProcedure, protectedProcedure,
                               #   adminProcedure, aiProcedure, chatProcedure
packages/api/src/routers/     # profile, diagnostic, learning, ai, admin
packages/db/prisma/schema.prisma  # 12 models (UserProfile, Course, Lesson, etc.)
```

**Key integration point:** tRPC context gets `user` from `supabase.auth.getUser()` in the API route handler (`apps/web/src/app/api/trpc/[trpc]/route.ts`). All auth-dependent logic flows from this single injection point.

---

## System Architecture with New Components

```
+----------------------------------------------------------------------------+
|                        PRESENTATION LAYER                                   |
|  +----------+  +----------+  +----------+  +----------+  +----------+      |
|  |  Login   |  | Pricing  |  | Paywall  |  | Profile  |  |  Admin   |      |
|  |(Yandex ID|  |  Page    |  | Overlay  |  |(billing) |  |(billing) |      |
|  +----+-----+  +----+-----+  +----+-----+  +----+-----+  +----+-----+      |
|       |              |             |              |              |           |
|  +----+--------------+-------------+--------------+--------------+------+   |
|  |              tRPC Client (TanStack Query cache)                      |   |
|  +------------------------------+---------------------------------------+   |
+------------------------------+--+------------------------------------------+
|                          API LAYER                                          |
|                                                                             |
|  +----------+ +----------+ +----------+ +----------+ +--------------------+ |
|  | billing  | | learning | |diagnostic| |   ai     | | /api/auth/yandex/* | |
|  | router   | | router   | | router   | |  router  | | (API routes)       | |
|  | (NEW)    | | (MOD)    | |          | |          | | (NEW)              | |
|  +----+-----+ +----+-----+ +----+-----+ +----+-----+ +--------+----------+ |
|       |             |            |            |                 |            |
|  +----+-----+ +-----+--------+  |   +--------+----------+     |            |
|  |CloudPay  | |checkAccess() |  |   |                    |     |            |
|  |API Client| |(paywall)     |  |   |                    |     |            |
|  +----+-----+ +-----+--------+  |   |                    |     |            |
|       |              |           |   |                    |     |            |
+-------+--------------+-----------+---+--------------------+-----+-----------+
|                        DATA LAYER                                           |
|  +-----------------------------------------------------------------------+  |
|  |  Supabase PostgreSQL                                                  |  |
|  |  +-- UserProfile (existing)                                           |  |
|  |  +-- Subscription (NEW: userId, planType, status, cpSubscriptionId)   |  |
|  |  +-- Payment (NEW: cpTransactionId, amount, status, rawPayload)       |  |
|  |  +-- FeatureFlag (NEW: key, value)                                    |  |
|  |  +-- Course (MOD: +price, +isFree)                                    |  |
|  |  +-- ... existing models unchanged ...                                |  |
|  +-----------------------------------------------------------------------+  |
+---+-----------+-------------+-----------------------------------------------+
    |           |             |
+---+-------+ +-+----------+ +-+------------+
|Yandex     | |CloudPay    | |Supabase Auth |
|OAuth      | |Webhooks +  | |(session mgmt)|
|oauth.yandex| |Widget     | |              |
+-----------+ +------------+ +--------------+
      EXTERNAL SERVICES
```

### Component Boundaries (New and Modified)

| Component | Responsibility | Communicates With | Status |
|-----------|---------------|-------------------|--------|
| `middleware.ts` | Auth check only (NO paywall here) | Supabase Auth | **Unchanged** |
| `lib/auth/actions.ts` | signInWithYandex replaces signInWithGoogle | Yandex API routes | **Modified** |
| `app/auth/callback/route.ts` | Supabase OAuth callback | Supabase Auth | **Unchanged** |
| `app/api/auth/yandex/route.ts` | Yandex OAuth initiation (redirect) | Yandex OAuth server | **New** |
| `app/api/auth/yandex/callback/route.ts` | Token exchange + Supabase session creation | Yandex token endpoint, Supabase Admin API | **New** |
| `lib/auth/yandex.ts` | Yandex OAuth client utilities | Yandex APIs | **New** |
| `app/api/webhooks/cloudpayments/[type]/route.ts` | Webhook receiver (check/pay/fail/recurrent) | CloudPayments, Prisma | **New** |
| `lib/cloudpayments/verify.ts` | HMAC-SHA256 signature verification | - | **New** |
| `lib/cloudpayments/handlers.ts` | Business logic per webhook type | Prisma | **New** |
| `packages/api/src/routers/billing.ts` | Subscription CRUD, plans, payment history | Prisma, CloudPayments API | **New** |
| `packages/api/src/lib/feature-flags.ts` | Feature flag reader with in-memory cache | Prisma | **New** |
| `packages/db/prisma/schema.prisma` | +Subscription, +Payment, +FeatureFlag, Course.price | PostgreSQL | **Modified** |
| `packages/shared/src/billing.ts` | Plan constants, shared types | - | **New** |
| `apps/web/src/components/billing/` | Paywall overlay, pricing cards, subscription UI | tRPC billing router | **New** |

---

## 1. Yandex ID Integration Architecture

### Problem: Supabase Does NOT Support Yandex as OAuth Provider

Supabase Auth has a fixed list of 16 supported providers: apple, azure, bitbucket, discord, facebook, github, gitlab, google, keycloak, linkedin, notion, twitch, twitter, slack, spotify, workos. **Yandex is not on this list.**

There is an ongoing discussion about generic OIDC support (GitHub Discussion #6547, #417), but it is not available on hosted Supabase as of March 2026.

**Confidence:** HIGH (verified via Supabase docs and multiple GitHub discussions)

### Rejected Approach: Keycloak Proxy Hack

Some guides suggest configuring Supabase's Keycloak provider with custom URLs pointing to a proxy that forwards to Yandex. This is **fragile and undocumented** -- Supabase uses hardcoded URL patterns for Keycloak discovery. Any Supabase Auth update could silently break it. PKCE state management across two proxies adds complexity with no benefit.

### Recommended Approach: Server-Side OAuth + Supabase Admin API

Handle Yandex OAuth flow entirely in custom API routes. Use Supabase Admin API to create users and generate sessions. This keeps Supabase as the single session manager while bypassing its provider limitation.

**Why this works:** The existing middleware, tRPC context, and all auth checks use `supabase.auth.getUser()` which reads the session cookie. As long as we set a valid Supabase session cookie at the end of our custom Yandex flow, everything downstream works unchanged.

### Yandex OAuth Endpoints

| Endpoint | URL |
|----------|-----|
| Authorize | `https://oauth.yandex.com/authorize` |
| Token | `https://oauth.yandex.com/token` |
| User Info | `https://login.yandex.ru/info` |
| App Registration | `https://oauth.yandex.com/` (dashboard) |

**Confidence:** HIGH (official Yandex docs at yandex.com/dev/id/doc/en/)

### Authentication Flow

```
User clicks "Войти через Яндекс"
        |
        v
[1] GET /api/auth/yandex
    - Generate random state token (CSRF protection)
    - Store state in httpOnly cookie (10 min TTL)
    - Redirect to:
      https://oauth.yandex.com/authorize?
        client_id={YANDEX_CLIENT_ID}&
        response_type=code&
        redirect_uri={SITE_URL}/api/auth/yandex/callback&
        state={state}&
        scope=login:email login:info login:avatar
        |
        v
[2] User logs in on Yandex, authorizes app
        |
        v
[3] GET /api/auth/yandex/callback?code={code}&state={state}
    - Verify state matches cookie (CSRF check)
    - DELETE state cookie
    - POST https://oauth.yandex.com/token
        body: grant_type=authorization_code&code={code}&
              client_id={ID}&client_secret={SECRET}
      -> Receive access_token
    - GET https://login.yandex.ru/info
        header: Authorization: OAuth {access_token}
      -> Receive user profile: { id, login, default_email, display_name,
                                  default_avatar_id, ... }
        |
        v
[4] Find or Create Supabase User
    - supabaseAdmin.auth.admin.listUsers() filtered by email
      OR supabaseAdmin.auth.admin.getUserById() if yandex_id stored
    - IF user exists:
        Update user_metadata with yandex_id (for future lookups)
    - IF user NOT found:
        supabaseAdmin.auth.admin.createUser({
          email: yandex_email,
          email_confirm: true,
          user_metadata: {
            full_name: display_name,
            yandex_id: yandex_user_id,
            avatar_url: yandex_avatar_url
          }
        })
        Note: handle_new_user trigger will create UserProfile automatically
        |
        v
[5] Create Supabase Session
    - supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: user_email,
        options: { redirectTo: '/dashboard' }
      })
    - Extract the token from the generated link
    - Use supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
      to exchange for a real session
    - Set session cookies via Supabase SSR cookie setter
    - Redirect to /dashboard
```

### File Structure

```
apps/web/src/
  app/api/auth/yandex/
    route.ts                    # Step 1: Initiate OAuth, redirect to Yandex
    callback/
      route.ts                  # Steps 3-5: Token exchange, user creation, session
  lib/auth/
    actions.ts                  # Modified: signInWithYandex() replaces signInWithGoogle()
    yandex.ts                   # New: exchangeYandexCode(), getYandexUserInfo()
  lib/supabase/
    admin.ts                    # New: Supabase admin client (service role key)
```

### Environment Variables

```env
# New
YANDEX_CLIENT_ID=               # From oauth.yandex.com dashboard
YANDEX_CLIENT_SECRET=           # From oauth.yandex.com dashboard

# Already exists, now also used for Yandex flow
SUPABASE_SERVICE_ROLE_KEY=      # For admin API (createUser, generateLink)
```

### Critical Constraints

1. **Service Role Key security**: `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. MUST be server-only (no `NEXT_PUBLIC_` prefix). Used only in API routes, never in client code.

2. **handle_new_user trigger**: The existing Supabase trigger creates a `UserProfile` row on new user signup. Verify it fires for `admin.createUser()` calls (it should, since the trigger is on `auth.users` INSERT).

3. **Email matching for migration**: Existing Google OAuth users who now log in with Yandex using the same email address will be matched automatically. Different email = different account (linking UI deferred).

4. **Google OAuth removal**: After Yandex is confirmed working, remove Google OAuth from Supabase dashboard (Authentication > Providers) and delete `signInWithGoogle()` from actions.ts.

---

## 2. CloudPayments Webhook Architecture

### Webhook Endpoint Design

CloudPayments sends HTTP POST requests to configured webhook URLs. URLs are registered per-type in the CloudPayments merchant dashboard.

**Confidence:** MEDIUM (official docs + npm library patterns; could not fetch full CloudPayments docs page)

### Webhook Types

| Type | Dashboard URL | Purpose |
|------|-------------|---------|
| Check | `/api/webhooks/cloudpayments/check` | Pre-authorization validation |
| Pay | `/api/webhooks/cloudpayments/pay` | Successful payment |
| Fail | `/api/webhooks/cloudpayments/fail` | Failed payment |
| Recurrent | `/api/webhooks/cloudpayments/recurrent` | Subscription status change |

### Route Structure

```
apps/web/src/
  app/api/webhooks/cloudpayments/
    [type]/
      route.ts                # Dynamic route handler for all webhook types
  lib/cloudpayments/
    verify.ts                 # HMAC-SHA256 signature verification
    handlers.ts               # Handler functions: handleCheck, handlePay, handleFail, handleRecurrent
    types.ts                  # TypeScript interfaces for CloudPayments payloads
    client.ts                 # CloudPayments API client (for cancel subscription, etc.)
```

### HMAC Signature Verification

CloudPayments sends HMAC in `Content-HMAC` and `X-Content-HMAC` headers.

```typescript
// apps/web/src/lib/cloudpayments/verify.ts
import crypto from 'crypto';

export function verifyCloudPaymentsSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = process.env.CLOUDPAYMENTS_API_SECRET!;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
  } catch {
    return false; // Different lengths
  }
}
```

### Webhook Route Handler

```typescript
// apps/web/src/app/api/webhooks/cloudpayments/[type]/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  // 1. Read raw body (needed for HMAC before parsing)
  const rawBody = await request.text();

  // 2. Verify HMAC signature
  const hmac = request.headers.get('Content-HMAC')
            || request.headers.get('X-Content-HMAC');
  if (!verifyCloudPaymentsSignature(rawBody, hmac)) {
    return NextResponse.json({ code: 13 }); // Reject
  }

  // 3. Parse payload
  const data = parseWebhookPayload(rawBody);

  // 4. Route to type-specific handler
  switch (params.type) {
    case 'check':     return handleCheck(data);
    case 'pay':       return handlePay(data);
    case 'fail':      return handleFail(data);
    case 'recurrent': return handleRecurrent(data);
    default:
      return NextResponse.json({ code: 13 });
  }
}
```

**Critical response format:** CloudPayments expects `{ "code": 0 }` for success, `{ "code": 13 }` for rejection. NOT HTTP status codes. Always return 200 OK with the code in the JSON body.

### Idempotency Pattern

```typescript
async function handlePay(data: CloudPaymentsPayload): Promise<NextResponse> {
  const txId = String(data.TransactionId);

  // Check if already processed
  const existing = await prisma.payment.findUnique({
    where: { cpTransactionId: txId },
  });
  if (existing) {
    return NextResponse.json({ code: 0 }); // Already processed, acknowledge
  }

  // Process in transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Create payment record
    await tx.payment.create({
      data: {
        cpTransactionId: txId,
        subscriptionId: /* resolve from AccountId */,
        amount: Math.round(data.Amount * 100), // Convert to kopecks
        status: 'COMPLETED',
        cpPaymentData: data, // Full payload for audit
      },
    });

    // Update subscription
    await tx.subscription.update({
      where: { id: /* resolve */ },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: /* calculate next period */,
      },
    });
  });

  return NextResponse.json({ code: 0 });
}
```

### AccountId Convention

CloudPayments `AccountId` field identifies the user. Set it when creating the widget charge:
- Format: `{userId}:{planType}:{courseId?}`
- Example: `clx1abc:PLATFORM` or `clx1abc:COURSE:01_analytics`
- Parse in webhook to resolve subscription

### Environment Variables

```env
CLOUDPAYMENTS_PUBLIC_ID=       # For widget initialization (can be NEXT_PUBLIC_)
CLOUDPAYMENTS_API_SECRET=      # For HMAC verification + API calls (SERVER ONLY)
```

---

## 3. Prisma Schema Changes

### New Models

```prisma
// ============== BILLING ==============

enum SubscriptionStatus {
  ACTIVE        // Paid and current
  PAST_DUE      // Payment failed, in grace/retry period
  CANCELLED     // User cancelled, still active until period end
  EXPIRED       // Period ended, no access
}

enum PlanType {
  COURSE        // Single course subscription
  PLATFORM      // Full platform access
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

model Subscription {
  id                 String             @id @default(cuid())
  userId             String
  planType           PlanType
  courseId            String?            // Only for COURSE plans
  status             SubscriptionStatus @default(ACTIVE)

  // CloudPayments identifiers
  cpSubscriptionId   String?            @unique
  cpToken            String?            // Recurrent payment token

  // Billing period
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelledAt        DateTime?

  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  user               UserProfile        @relation(fields: [userId], references: [id], onDelete: Cascade)
  course             Course?            @relation(fields: [courseId], references: [id])
  payments           Payment[]

  @@index([userId])
  @@index([userId, status])
}

model Payment {
  id              String        @id @default(cuid())
  subscriptionId  String
  amount          Int           // Amount in kopecks (RUB * 100)
  currency        String        @default("RUB")
  status          PaymentStatus @default(PENDING)

  // CloudPayments data
  cpTransactionId String        @unique  // Idempotency key
  cpPaymentData   Json?         // Full webhook payload for audit trail

  createdAt       DateTime      @default(now())

  subscription    Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
}

model FeatureFlag {
  id        String   @id @default(cuid())
  key       String   @unique  // "billing_enabled", "yandex_auth_enabled"
  value     Boolean  @default(false)
  updatedAt DateTime @updatedAt
}
```

### Modifications to Existing Models

```prisma
model UserProfile {
  // ... existing fields unchanged ...
  subscriptions  Subscription[]    // ADD: relation to subscriptions
}

model Course {
  // ... existing fields unchanged ...
  price          Int?              // ADD: price in kopecks, null = not for sale individually
  isFree         Boolean @default(false) // ADD: mark entire course as free
  subscriptions  Subscription[]    // ADD: relation to subscriptions
}
```

### Design Rationale

| Decision | Why |
|----------|-----|
| Amount in kopecks (Int) | Avoid floating-point arithmetic. 100 kopecks = 1 RUB. |
| PlanType enum (COURSE/PLATFORM) | Two subscription tiers without over-engineering. |
| cpTransactionId unique | Idempotency key -- prevents duplicate processing of retried webhooks. |
| cpPaymentData Json | Full webhook payload stored for audit. Cheap insurance for debugging. |
| FeatureFlag in DB (not env) | Changeable without restart/redeploy. Admin UI toggle. |
| Subscription has status machine | ACTIVE -> PAST_DUE -> EXPIRED, or ACTIVE -> CANCELLED -> EXPIRED. |

---

## 4. Paywall Architecture

### Content Gating Logic

```
User requests lesson /learn/[id]
        |
        v
[1] Is billing enabled? (FeatureFlag "billing_enabled")
    NO  --> Grant access (current behavior, everything free)
    YES --> continue
        |
        v
[2] Is this lesson in free tier?
    - Course.isFree = true --> Grant access
    - lesson.order <= FREE_LESSONS_PER_COURSE --> Grant access
    - Otherwise --> continue
        |
        v
[3] Does user have active subscription?
    - PLATFORM plan with status ACTIVE or CANCELLED (before period end) --> Grant access
    - COURSE plan matching this courseId with same status --> Grant access
    - No match --> Return 'paywall' access level
```

### Why NOT in Middleware

| Approach | Verdict | Reason |
|----------|---------|--------|
| Middleware paywall | **Reject** | Edge runtime cannot use Prisma. Adding fetch calls adds latency to ALL routes. |
| tRPC procedure paywall | **Accept** | Runs in Node.js runtime. Only adds overhead to content endpoints. |
| Component-level check | Supplement | UI renders based on tRPC response `access` field. |

**Decision:** Paywall check lives in `learning.getLesson` tRPC procedure. Middleware stays auth-only (unchanged).

### tRPC Integration

The `learning.getLesson` procedure is modified to return an `access` field:

```typescript
// Simplified -- actual implementation in learning router
getLesson: protectedProcedure
  .input(z.object({ lessonId: z.string() }))
  .query(async ({ ctx, input }) => {
    const lesson = await ctx.prisma.lesson.findUnique({
      where: { id: input.lessonId },
      include: { course: true },
    });

    const billingEnabled = await isFeatureEnabled(ctx.prisma, 'billing_enabled');

    if (!billingEnabled) {
      return { ...lesson, access: 'granted' as const };
    }

    if (lesson.course.isFree || lesson.order <= FREE_LESSONS_PER_COURSE) {
      return { ...lesson, access: 'granted' as const };
    }

    const hasAccess = await checkSubscriptionAccess(
      ctx.prisma, ctx.user.id, lesson.courseId
    );

    return {
      ...lesson,
      access: hasAccess ? 'granted' as const : 'paywall' as const,
      // Strip sensitive content when paywalled
      videoId: hasAccess ? lesson.videoId : null,
    };
  }),
```

### Free Tier Constants

```typescript
// packages/shared/src/billing.ts
export const FREE_LESSONS_PER_COURSE = 2;  // First N lessons by .order
export const ALWAYS_FREE_ROUTES = [
  '/dashboard', '/diagnostic', '/learn', '/profile'
] as const; // Catalog browsing is free, individual lessons may be gated

export const PLATFORM_MONTHLY_PRICE_KOP = 299_00; // 299 RUB
```

### Graceful Degradation

```typescript
async function checkSubscriptionAccess(
  prisma: PrismaClient,
  userId: string,
  courseId: string
): Promise<boolean> {
  try {
    const billingEnabled = await isFeatureEnabled(prisma, 'billing_enabled');
    if (!billingEnabled) return true;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'CANCELLED'] },
        currentPeriodEnd: { gte: new Date() },
        OR: [
          { planType: 'PLATFORM' },
          { planType: 'COURSE', courseId },
        ],
      },
    });
    return !!subscription;
  } catch (error) {
    console.error('[billing] Access check failed, granting access:', error);
    return true; // FAIL OPEN -- never lock users out due to billing bugs
  }
}
```

---

## 5. Feature Flag / Testing Toggle

### Design: DB Flag with In-Memory Cache

Use `FeatureFlag` table + globalThis cache (same pattern as existing rate limiter):

```typescript
// packages/api/src/lib/feature-flags.ts
const CACHE_TTL = 60_000; // 1 minute

const flagCache: Map<string, { value: boolean; at: number }> =
  (globalThis as any).__featureFlags ??= new Map();

export async function isFeatureEnabled(
  prisma: PrismaClient,
  key: string
): Promise<boolean> {
  const cached = flagCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.value;
  }

  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  const value = flag?.value ?? false;
  flagCache.set(key, { value, at: Date.now() });
  return value;
}
```

### Admin Toggle

Add to existing admin router:

```typescript
toggleFeatureFlag: adminProcedure
  .input(z.object({ key: z.string(), value: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    // Clear cache immediately
    ((globalThis as any).__featureFlags as Map<string, unknown>)?.delete(input.key);

    return ctx.prisma.featureFlag.upsert({
      where: { key: input.key },
      update: { value: input.value },
      create: { key: input.key, value: input.value },
    });
  }),
```

### Seed Data

```sql
INSERT INTO "FeatureFlag" (id, key, value, "updatedAt")
VALUES (gen_random_uuid(), 'billing_enabled', false, now());
```

Start with billing disabled. Enable via admin UI when ready for testing.

---

## 6. Billing tRPC Router

```typescript
// packages/api/src/routers/billing.ts

export const billingRouter = router({
  // Current user's active subscription
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.subscription.findFirst({
      where: {
        userId: ctx.user.id,
        status: { in: ['ACTIVE', 'CANCELLED'] },
        currentPeriodEnd: { gte: new Date() },
      },
      include: { course: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  // Available plans
  getPlans: publicProcedure.query(async ({ ctx }) => {
    const courses = await ctx.prisma.course.findMany({
      where: { price: { not: null }, isFree: false },
      select: { id: true, title: true, price: true },
      orderBy: { order: 'asc' },
    });
    return { courses, platformPrice: PLATFORM_MONTHLY_PRICE_KOP };
  }),

  // Payment history
  getPaymentHistory: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.payment.findMany({
      where: { subscription: { userId: ctx.user.id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { subscription: { select: { planType: true, courseId: true } } },
    });
  }),

  // Cancel subscription (user action)
  cancelSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.prisma.subscription.findFirst({
        where: { id: input.subscriptionId, userId: ctx.user.id },
      });
      if (!sub) throw new TRPCError({ code: 'NOT_FOUND' });

      // 1. Cancel in CloudPayments via API
      await cancelCloudPaymentsSubscription(sub.cpSubscriptionId!);

      // 2. Update local status
      return ctx.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      // Access remains until currentPeriodEnd
    }),
});
```

Root router addition:

```typescript
// packages/api/src/root.ts
import { billingRouter } from './routers/billing';

export const appRouter = router({
  profile: profileRouter,
  diagnostic: diagnosticRouter,
  learning: learningRouter,
  ai: aiRouter,
  admin: adminRouter,
  billing: billingRouter,  // NEW
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Paywall in Middleware

**What:** Checking subscription in `middleware.ts`.
**Why bad:** Edge runtime cannot use Prisma. Adds latency to ALL routes including free pages.
**Instead:** Check in tRPC procedures for content endpoints only.

### Anti-Pattern 2: Keycloak Proxy for Yandex

**What:** Hijacking Supabase's Keycloak config with custom URLs proxying to Yandex.
**Why bad:** Undocumented hack. Breaks on any Supabase Auth update. PKCE state leaks across proxies.
**Instead:** Custom API routes + Supabase Admin API.

### Anti-Pattern 3: Subscription in JWT

**What:** Embedding subscription status in Supabase JWT claims.
**Why bad:** JWT cached until expiry. Payment/cancellation changes invisible for up to 1 hour. "Paid but paywalled" bugs.
**Instead:** Query DB per content request (fast with index on userId+status).

### Anti-Pattern 4: Client-Side Payment API Calls

**What:** Calling CloudPayments REST API from browser.
**Why bad:** Exposes API secret. Spoofable.
**Instead:** All CloudPayments API calls server-only. Browser only uses the CP widget (iframe).

### Anti-Pattern 5: Storing Card Data

**What:** Saving card numbers, CVV, or expiry in your database.
**Why bad:** PCI DSS violation. Criminal liability.
**Instead:** CloudPayments widget handles card data. Store only `cpToken` (opaque recurrent token).

### Anti-Pattern 6: Separate Auth System

**What:** Custom JWT/session system for Yandex users alongside Supabase sessions.
**Why bad:** Two session sources. All existing code (`middleware.ts`, tRPC context, `protectedProcedure`) expects Supabase session.
**Instead:** Use Supabase as the single session authority. Yandex is only for identity verification.

---

## Build Order (Dependency Chain)

```
Phase 1: Database Foundation (no dependencies)
    +-- Prisma schema: Subscription, Payment, FeatureFlag
    +-- Course model: +price, +isFree
    +-- Migration
    +-- Seed: FeatureFlag { billing_enabled: false }
    +-- Seed: Course.price values for each course

Phase 2: Feature Flag System (depends on Phase 1)
    +-- isFeatureEnabled() utility with globalThis cache
    +-- Admin toggle procedure in admin router
    +-- Admin UI: toggle switch for billing_enabled

Phase 3: Yandex ID Auth (depends only on existing auth infra)
    +-- lib/auth/yandex.ts (OAuth client)
    +-- lib/supabase/admin.ts (admin client)
    +-- /api/auth/yandex/route.ts (initiate)
    +-- /api/auth/yandex/callback/route.ts (complete)
    +-- signInWithYandex server action
    +-- Login/register page UI (replace Google button with Yandex)
    +-- Remove Google OAuth (actions.ts + Supabase dashboard)
    +-- Test: new user, existing user by email match

Phase 4: CloudPayments Webhooks (depends on Phase 1)
    +-- lib/cloudpayments/verify.ts (HMAC)
    +-- lib/cloudpayments/types.ts (payload interfaces)
    +-- lib/cloudpayments/handlers.ts (business logic)
    +-- /api/webhooks/cloudpayments/[type]/route.ts
    +-- Test with CloudPayments sandbox

Phase 5: Billing Router + UI (depends on Phase 1 + 4)
    +-- packages/api/src/routers/billing.ts
    +-- Root router: add billing
    +-- lib/cloudpayments/client.ts (cancel API)
    +-- CloudPayments widget integration (frontend)
    +-- Pricing page
    +-- Profile: subscription management section

Phase 6: Paywall (depends on Phase 1 + 2 + 5 -- MUST BE LAST)
    +-- checkSubscriptionAccess() utility
    +-- Modify learning.getLesson: add access check
    +-- Modify learning.getCourses: add lock indicators
    +-- Paywall overlay component
    +-- Free tier logic (first N lessons)
    +-- E2E: toggle billing on/off, verify access
```

**Parallelization:** Phase 3 (Yandex auth) and Phase 4 (CloudPayments webhooks) are fully independent and can run in parallel after Phase 1.

**Critical path:** Phase 1 -> Phase 4 -> Phase 5 -> Phase 6

---

## Scalability Considerations

| Concern | At 100 users | At 1K users | At 10K users |
|---------|-------------|-------------|-------------|
| Subscription DB queries | Direct Prisma, <5ms with index | Same | Consider Redis cache |
| Feature flag reads | globalThis cache (1 DB hit/min) | Same | Same |
| Webhook processing | Synchronous in route handler | Same | Async queue (BullMQ) |
| Yandex OAuth | Direct API calls | Same | Same |

Current scale does not require Redis or queues. Direct Prisma queries with proper indexes are sufficient.

---

## Sources

- [Supabase Auth providers list](https://supabase.com/docs/guides/auth) -- HIGH confidence
- [Supabase custom OAuth discussion #417](https://github.com/orgs/supabase/discussions/417) -- HIGH confidence
- [Supabase OIDC discussion #6547](https://github.com/orgs/supabase/discussions/6547) -- HIGH confidence
- [Supabase Keycloak workaround](https://tylerjulian.substack.com/p/supabase-generic-oidc-authentication) -- MEDIUM confidence
- [Supabase signInWithIdToken](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken) -- HIGH confidence
- [Yandex ID OAuth docs](https://yandex.com/dev/id/doc/en/) -- HIGH confidence
- [Yandex OAuth token endpoint](https://yandex.com/dev/id/doc/en/access) -- HIGH confidence
- [Yandex user info endpoint](https://yandex.com/dev/id/doc/en/user-information) -- HIGH confidence
- [CloudPayments developer docs](https://developers.cloudpayments.ru/en/) -- MEDIUM confidence
- [CloudPayments Node.js client](https://github.com/izatop/cloudpayments) -- MEDIUM confidence
- [Next.js paywall patterns](https://update.dev/docs/integrations/paywall-nextjs-supabase-stripe) -- MEDIUM confidence
- [Vercel nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments) -- HIGH confidence
- [HMAC webhook verification](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) -- HIGH confidence
- Existing codebase: middleware.ts, trpc.ts, auth/actions.ts, schema.prisma -- HIGH confidence

---
*Architecture research for: MAAL v1.2 Auth Rework + Billing*
*Researched: 2026-03-06*
