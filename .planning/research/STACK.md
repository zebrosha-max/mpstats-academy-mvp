# Technology Stack

**Project:** MAAL v1.2 — Auth Rework + Billing
**Researched:** 2026-03-06
**Scope:** Only NEW additions for Yandex ID auth, CloudPayments billing, paywall system. Existing stack (Next.js 14, tRPC, Prisma, Supabase Auth, Turborepo, shadcn/ui) is locked and not re-evaluated.

## Recommended Stack

### Yandex ID OAuth Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom Next.js API routes | N/A | Server-side OAuth 2.0 proxy for Yandex ID | Supabase has NO built-in Yandex provider. Direct API route handles the OAuth flow server-side, then creates/links Supabase user via Admin API. Simpler than Keycloak workaround, avoids dual auth systems. |
| Supabase Admin API (existing) | @supabase/supabase-js 2.x | Create/link users from Yandex tokens | `supabase.auth.admin.createUser()` and `supabase.auth.admin.generateLink()` to manage users server-side. Keeps all auth in Supabase, RLS policies continue working. |

**Confidence: MEDIUM** — Supabase does not natively support Yandex ID. The server-side proxy pattern is well-documented for other custom providers but not specifically verified for Yandex + Supabase combination.

**Yandex OAuth 2.0 Endpoints (verified via official docs):**
- Authorization: `https://oauth.yandex.ru/authorize`
- Token exchange: `https://oauth.yandex.ru/token`
- User info: `https://login.yandex.ru/info?format=json`
- App registration: `https://oauth.yandex.ru/client/new`

**Auth Flow:**
```
1. User clicks "Войти через Яндекс"
2. Frontend redirects to /api/auth/yandex
3. API route redirects to https://oauth.yandex.ru/authorize?client_id=...&response_type=code&redirect_uri=...
4. User authorizes on Yandex
5. Yandex redirects to /api/auth/yandex/callback?code=...
6. API route exchanges code for token (POST https://oauth.yandex.ru/token)
7. API route fetches user info (GET https://login.yandex.ru/info?format=json)
8. API route finds or creates Supabase user via Admin API
9. API route sets Supabase session cookies
10. Redirect to /dashboard
```

**Google OAuth removal:** Remove Google OAuth provider from Supabase dashboard. Update login page to show only Yandex + email/password. Migration script for existing Google-linked accounts (match by email, link to Yandex ID on next login).

### CloudPayments Billing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CloudPayments Widget (CDN) | Latest | Payment form UI (iframe, PCI DSS compliant) | Official embed from `widget.cloudpayments.ru`. Handles card data securely via iframe. No PCI scope on our side. Supports Apple Pay, Google Pay. |
| `cloudpayments` npm | ^4.1.1 | Server-side API client (TypeScript) | Create/cancel/update subscriptions, query payment status. Written in TypeScript with full type definitions. |
| Webhook handler (custom API route) | N/A | Process CloudPayments notifications | Pay, Fail, Recurrent, Cancel, Refund webhook types. CloudPayments retries 100 times if unreachable. |
| `crypto` (Node.js built-in) | N/A | HMAC validation of webhook signatures | Verify webhook authenticity using API secret |

**Confidence: HIGH** — CloudPayments API well-documented, npm package exists with TypeScript types, actively maintained.

**CloudPayments API Details:**
- Base URL: `https://api.cloudpayments.ru`
- Auth: HTTP Basic Auth (`publicId:apiSecret`)
- Key endpoints:
  - `POST /subscriptions/create` — create recurring subscription
  - `POST /subscriptions/update` — change plan/amount
  - `POST /subscriptions/cancel` — cancel subscription
  - `POST /subscriptions/find` — find by account ID
- Webhook types: Check, Pay, Fail, Recurrent, Cancel, Confirm, Refund
- Webhook retry: 100 attempts if merchant server unavailable or returns error

**Widget integration:**
```html
<!-- Loaded from CDN, opens as modal iframe -->
<script src="https://widget.cloudpayments.ru/bundles/checkout"></script>
```
Widget stays on page (no redirect). Collects card data in secure iframe. Returns cryptogram for server-side charge. For recurring: first payment creates token, subsequent charges are automatic.

### Paywall / Access Control

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Prisma models (existing) | 5.x | Subscription state in DB | Single source of truth for access decisions. New `Subscription` and `PaymentEvent` models. |
| Next.js Middleware (existing) | 14.x | Route-level paywall check | Fast check before page render. Reads subscription status from cookie/session. |
| tRPC middleware (existing) | 11.x | API-level access gating | `subscribedProcedure` that checks active subscription before returning paid content. |
| Feature flag (env var) | N/A | Toggle billing on/off | `NEXT_PUBLIC_BILLING_ENABLED=true/false`. When false, all content is free. No redeploy needed for env change on VPS. |

**Confidence: HIGH** — Uses existing stack, no new dependencies. Standard access control pattern.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cloudpayments` | ^4.1.1 | CloudPayments API client (TypeScript) | All server-side payment operations |

**No new UI libraries needed.** shadcn/ui covers all billing UI requirements:
- `Dialog` for payment modal wrapper
- `Badge` for subscription status display
- `Alert` for paywall banners ("Subscribe to access")
- `Card` for pricing plans display
- `Button` for CTA actions

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Yandex Auth | Server-side OAuth proxy (API routes) | Keycloak provider hijack in Supabase | Fragile, undocumented hack. Supabase Keycloak config lets you set custom URLs, but it's meant for actual Keycloak. Breaks if Supabase changes their Keycloak implementation. |
| Yandex Auth | Server-side OAuth proxy | NextAuth.js with Yandex provider | Creates TWO auth systems. NextAuth has sessions, Supabase has sessions. RLS policies only work with Supabase sessions. Users end up with inconsistent auth state. |
| Yandex Auth | Server-side OAuth proxy | Wait for Supabase generic OIDC support | Supabase discussion #6547 shows custom OIDC is planned but no ETA for consumer-side (inbound) providers. Only OAuth 2.1 server (outbound) shipped so far. Can't wait. |
| Payment provider | CloudPayments | Stripe | Stripe works poorly for Russian market. CloudPayments is Russian, supports Russian banks, ruble payments, local acquiring, 54-FZ receipt compliance. |
| Payment provider | CloudPayments | YooKassa (YooMoney) | Both viable for Russia. CloudPayments has better developer docs, cleaner API, official TypeScript npm package. YooKassa npm ecosystem is weaker. |
| Payment widget | CDN script | `@cloudpayments/checkout` npm | CDN is officially recommended by CloudPayments. npm package exists but has fewer weekly downloads and less clear documentation. CDN always loads latest stable version. |
| Subscription DB | Prisma models in existing DB | Separate billing microservice | Over-engineering for single-product SaaS with <1000 users. Single DB simplifies access checks (JOIN subscription with user in one query). |
| Feature flags | `NEXT_PUBLIC_BILLING_ENABLED` env var | LaunchDarkly / Flagsmith / Unleash | One boolean toggle does not justify a feature flag service. Env var is zero-cost, zero-dependency, and sufficient. |
| Paywall check | tRPC middleware (`subscribedProcedure`) | Next.js Middleware only | Middleware is edge-only, can't query Prisma. Need server-side tRPC procedure for full DB access check. Middleware handles redirect logic, tRPC handles data gating. |

## Installation

```bash
# CloudPayments server-side API client (only new package)
pnpm add cloudpayments --filter=@mpstats/api

# No other new packages needed:
# - Yandex OAuth uses native fetch + existing @supabase/supabase-js
# - CloudPayments widget loaded from CDN (not npm)
# - Paywall uses existing Prisma + tRPC + middleware
# - UI uses existing shadcn/ui components
```

## Environment Variables (New)

```bash
# === Yandex OAuth ===
YANDEX_CLIENT_ID=              # From https://oauth.yandex.ru/client/new
YANDEX_CLIENT_SECRET=          # From Yandex OAuth console (NEVER expose to client)

# === CloudPayments ===
CLOUDPAYMENTS_PUBLIC_ID=       # From CloudPayments dashboard (safe for client)
CLOUDPAYMENTS_API_SECRET=      # From CloudPayments dashboard (NEVER expose to client)

# === Feature Flag ===
NEXT_PUBLIC_BILLING_ENABLED=false  # Toggle paywall on/off. "false" = all content free.
```

**Security notes:**
- `YANDEX_CLIENT_SECRET` and `CLOUDPAYMENTS_API_SECRET` must NOT have `NEXT_PUBLIC_` prefix
- `CLOUDPAYMENTS_PUBLIC_ID` is safe for client (used in widget initialization)
- Add to `.env.example`, `.env.production` on VPS, and GitHub Actions secrets

## Prisma Schema Additions

```prisma
// ============== BILLING ==============

enum SubscriptionStatus {
  TRIAL         // Free trial period (if applicable)
  ACTIVE        // Paid and current
  PAST_DUE      // Payment failed, grace period
  CANCELLED     // User cancelled, access until currentPeriodEnd
  EXPIRED       // Period ended, no access
}

enum SubscriptionPlan {
  COURSE        // Single course access
  PLATFORM      // Full platform access (all courses)
}

model Subscription {
  id                  String             @id @default(cuid())
  userId              String
  plan                SubscriptionPlan
  status              SubscriptionStatus @default(ACTIVE)
  courseId             String?            // Only for COURSE plan, null for PLATFORM
  cloudpaymentsSubId  String?            @unique // CloudPayments subscription ID
  cloudpaymentsToken  String?            // Recurring payment token from first charge
  amount              Decimal            // Price in RUB
  interval            String             @default("Month") // "Month" or "Year"
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime
  cancelledAt         DateTime?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  user   UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course?     @relation(fields: [courseId], references: [id])
  events PaymentEvent[]

  @@index([userId])
  @@index([status])
  @@index([cloudpaymentsSubId])
}

model PaymentEvent {
  id                String   @id @default(cuid())
  subscriptionId    String?
  transactionId     String   // CloudPayments transaction ID
  type              String   // "Pay", "Fail", "Recurrent", "Cancel", "Refund"
  amount            Decimal
  currency          String   @default("RUB")
  status            String   // "Completed", "Declined", "Authorized"
  rawPayload        Json     // Full webhook payload for audit trail
  createdAt         DateTime @default(now())

  subscription Subscription? @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId])
  @@index([transactionId])
}
```

**Existing model additions:**

```prisma
// UserProfile — add fields:
model UserProfile {
  // ... existing fields ...
  yandexId       String?        @unique  // Yandex user ID for account linking
  subscriptions  Subscription[]
}

// Course — add fields:
model Course {
  // ... existing fields ...
  price          Decimal?       @default(0)   // Price in RUB per month, 0 = free
  isFree         Boolean        @default(false) // Explicitly free course (overrides paywall)
  subscriptions  Subscription[]
}

// Lesson — add field:
model Lesson {
  // ... existing fields ...
  isFreePreview  Boolean        @default(false) // Available without subscription (first 1-2 lessons per course)
}
```

## Integration Points with Existing System

### 1. Supabase Auth Integration

Yandex OAuth creates Supabase users via Admin API. Key integration:

```typescript
// api/auth/yandex/callback — simplified flow
const yandexUser = await fetchYandexUserInfo(accessToken);

// Find existing user by email or yandexId
let supabaseUser = await findUserByEmail(yandexUser.default_email);

if (!supabaseUser) {
  // Create new Supabase auth user
  const { data } = await supabaseAdmin.auth.admin.createUser({
    email: yandexUser.default_email,
    email_confirm: true, // Yandex already verified email
    user_metadata: {
      name: yandexUser.display_name,
      avatar_url: yandexUser.default_avatar_id
        ? `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`
        : null,
      yandex_id: yandexUser.id,
    },
  });
  supabaseUser = data.user;
}

// Update UserProfile with yandexId
await prisma.userProfile.upsert({
  where: { id: supabaseUser.id },
  update: { yandexId: String(yandexUser.id) },
  create: { id: supabaseUser.id, yandexId: String(yandexUser.id), name: yandexUser.display_name },
});

// Generate session and set cookies
```

### 2. tRPC Router Structure

```typescript
// New router: packages/api/src/routers/billing.ts
billingRouter = {
  getSubscriptions: protectedProcedure,     // User's active subscriptions
  getPlans: publicProcedure,                 // Available pricing plans
  createCheckout: protectedProcedure,        // Initiate CloudPayments widget
  cancelSubscription: protectedProcedure,    // Cancel recurring
  webhookHandler: publicProcedure,           // CloudPayments webhooks (HMAC validated)
}

// New middleware: subscribedProcedure
// Checks user has active subscription for requested content
subscribedProcedure = protectedProcedure.use(({ ctx, next }) => {
  // Check BILLING_ENABLED flag first
  // If disabled, pass through (all content free)
  // If enabled, verify active subscription
});
```

### 3. Middleware Paywall Flow

```typescript
// middleware.ts additions
// Lesson pages: check subscription before rendering
// Free content: diagnostic, first lessons (isFreePreview), profile
// Paid content: all other lessons, RAG chat (optional)
```

## What NOT to Add

| Avoid | Why | What Exists Instead |
|-------|-----|---------------------|
| NextAuth.js | Creates dual auth system, breaks Supabase RLS, doubles session management | Server-side Yandex OAuth proxy + Supabase Admin API |
| Stripe | Poor Russian market support, no local acquiring, no 54-FZ compliance | CloudPayments (Russian payment processor) |
| Redis for subscription caching | Overkill for <1000 users. Prisma query with index is fast enough | Direct Prisma query on `Subscription` table |
| Separate billing database | Single DB is simpler, allows JOINs for access checks | Prisma models in existing Supabase PostgreSQL |
| Webhook queue (Bull/BullMQ) | Webhook volume is low (<100/day for MVP). Direct processing is fine | Synchronous webhook handler in API route |
| Payment analytics dashboard | Admin panel already exists. Add subscription stats there | Extend existing admin routes |
| Multi-currency support | All users are Russian, all payments in RUB | `currency: "RUB"` default |

## Sources

- [Supabase signInWithIdToken docs](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken) — HIGH confidence
- [Supabase custom OIDC discussion #6547](https://github.com/orgs/supabase/discussions/6547) — MEDIUM confidence (confirms no native Yandex support)
- [Supabase Keycloak workaround article](https://tylerjulian.substack.com/p/supabase-generic-oidc-authentication) — MEDIUM confidence (not recommended but documented)
- [Yandex OAuth documentation](https://yandex.com/dev/id/doc/en/concepts/ya-oauth-intro) — HIGH confidence
- [Yandex user info endpoint](https://yandex.com/dev/id/doc/en/user-information) — HIGH confidence
- [Auth.js Yandex provider source](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/providers/yandex.ts) — HIGH confidence (confirms endpoints)
- [CloudPayments developer docs](https://developers.cloudpayments.ru/en/) — HIGH confidence
- [cloudpayments npm package](https://www.npmjs.com/package/cloudpayments) — HIGH confidence
- [@cloudpayments/checkout npm](https://www.npmjs.com/package/@cloudpayments/checkout) — MEDIUM confidence
- [CloudPayments Node.js client (GitHub)](https://github.com/izatop/cloudpayments) — HIGH confidence
- [CloudPayments notification handler source](https://github.com/izatop/cloudpayments/blob/master/src/Api/notification.ts) — HIGH confidence
- [Next.js paywall patterns](https://www.ericburel.tech/blog/static-paid-content-app-router) — MEDIUM confidence
- [Vercel nextjs-subscription-payments repo](https://github.com/vercel/nextjs-subscription-payments) — HIGH confidence (pattern reference, uses Stripe but architecture applies)
- [Supabase custom OAuth providers discussion #417](https://github.com/orgs/supabase/discussions/417) — MEDIUM confidence

---
*Stack research for: MAAL v1.2 — Yandex ID Auth, CloudPayments Billing, Paywall*
*Researched: 2026-03-06*
