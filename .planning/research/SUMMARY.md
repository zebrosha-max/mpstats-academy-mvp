# Project Research Summary

**Project:** MAAL v1.2 -- Auth Rework + Billing
**Domain:** OAuth provider migration + SaaS billing for educational platform (Russian market)
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

MAAL v1.2 adds two major capabilities to an existing Next.js/Supabase education platform: replacing Google OAuth with Yandex ID authentication, and introducing CloudPayments-based subscription billing with content gating. The existing stack (Next.js 14, tRPC, Prisma, Supabase, Turborepo) is locked and well-proven through 6 completed sprints. The new work introduces exactly one new npm dependency (`cloudpayments` server-side client) and two external service integrations (Yandex OAuth, CloudPayments).

The recommended approach is conservative and pragmatic. For auth, implement a manual server-side OAuth flow via custom API routes because Supabase does not natively support Yandex ID -- this is the single most important architectural constraint. For billing, use CloudPayments (the Russian market standard) with its CDN-hosted payment widget for PCI compliance and server-side webhook processing for subscription lifecycle management. The paywall should be a soft freemium model: diagnostic and 1-2 intro lessons per course remain free, with a centralized access service gating everything else.

The primary risks are: (1) account migration from Google OAuth to Yandex ID losing user data if not handled via email-based linking, (2) webhook processing bugs (missing HMAC verification, non-idempotent handlers, state machine race conditions) corrupting subscription state, and (3) 54-FZ fiscal receipt non-compliance creating legal liability. All three are well-understood and preventable with the patterns documented in the research. The auth and billing tracks are independent and can be built in parallel, with paywall integration as the final phase.

## Key Findings

### Recommended Stack

Only one new package is needed: `cloudpayments` npm (TypeScript server-side API client). Yandex OAuth uses native `fetch` and the existing `@supabase/supabase-js` Admin API. CloudPayments widget loads from CDN (never bundled). All paywall logic uses existing Prisma, tRPC middleware, and shadcn/ui components. See [STACK.md](./STACK.md) for full details.

**Core additions:**
- **Custom API routes for Yandex OAuth**: server-side OAuth 2.0 proxy because Supabase has no Yandex provider -- manual token exchange + Supabase Admin API user creation
- **CloudPayments Widget (CDN)**: PCI-compliant payment iframe, supports Apple Pay/Google Pay/SBP, no card data touches our server
- **CloudPayments server-side client** (`cloudpayments` npm ^4.1.1): subscription create/cancel/update, TypeScript types
- **Webhook handlers** (custom API routes): HMAC-verified endpoints for Check/Pay/Fail/Recurrent/Cancel events
- **Feature flag** (DB-stored with in-memory cache): admin-toggleable billing on/off without redeploy

### Expected Features

See [FEATURES.md](./FEATURES.md) for full feature landscape.

**Must have (table stakes):**
- Yandex ID one-click OAuth login with email/avatar/name auto-fill
- Existing Google account migration (match by email, no data loss)
- CloudPayments recurring subscription (monthly charge without re-entering card)
- Subscription self-service cancellation (legal requirement)
- Webhook processing for payment lifecycle (Check, Pay, Fail, Recurrent)
- 54-FZ fiscal receipts via CloudKassir (legal requirement in Russia)
- Free diagnostic (always) + free preview lessons (1-2 per course)
- Locked lesson page with clear subscription CTA
- Server-side subscription status check (prevent client-side bypass)
- Billing toggle (enable/disable without code deploy)

**Should have (differentiators):**
- Dual auth (Yandex + email/password fallback)
- Grace period on failed payments (3-5 days before revoking access)
- Apple Pay / Google Pay in widget (higher mobile conversion)
- Subscription pause (reduce churn vs. hard cancel)
- Plan upgrade path (per-course to full platform)
- Payment history in profile

**Defer to v1.3+:**
- Proration on plan changes
- Team/corporate plans
- SBP as separate payment method
- Dynamic free content rotation
- Promo codes / discounts
- Custom admin billing dashboard

### Architecture Approach

The architecture extends the existing system with minimal surface area changes. Middleware stays auth-only (no paywall in Edge runtime -- Prisma unavailable there). Paywall enforcement lives in tRPC procedures via a centralized `checkSubscriptionAccess()` service, with a `subscribedProcedure` middleware layer. Webhooks use a single dynamic route (`/api/webhooks/cloudpayments/[type]`) with HMAC verification and idempotent processing via unique transaction ID constraints. Feature flags use a `FeatureFlag` DB table with globalThis in-memory cache (1-minute TTL). See [ARCHITECTURE.md](./ARCHITECTURE.md) for full component diagram and code patterns.

**Major components:**
1. **Yandex OAuth routes** (`/api/auth/yandex/*`) -- handle OAuth flow, create/link Supabase users via Admin API, set session cookies
2. **CloudPayments webhook handler** (`/api/webhooks/cloudpayments/[type]`) -- HMAC-verified, idempotent event processing with Prisma transactions
3. **Billing tRPC router** (`packages/api/src/routers/billing.ts`) -- subscription CRUD, plans listing, payment history, cancel flow
4. **Centralized access service** (`checkSubscriptionAccess()`) -- single source of truth for content gating, checks feature flag + free tier + subscription status
5. **Feature flag system** (`packages/api/src/lib/feature-flags.ts`) -- DB-backed with cache, admin toggle in UI

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 14 pitfalls with prevention strategies.

1. **Supabase does not support Yandex ID** -- cannot use `signInWithOAuth({ provider: 'yandex' })`. Must build manual server-side OAuth with Admin API. Wrong architecture choice (NextAuth, Keycloak proxy) has HIGH recovery cost.
2. **Google OAuth users lose access on provider swap** -- existing users matched by email must be linked, not duplicated. Gradual transition required. Never disable Google silently.
3. **Webhook HMAC verification missing** -- attackers can forge payment confirmations. Implement `crypto.timingSafeEqual` HMAC check as the first line of every webhook handler.
4. **Non-idempotent webhook handlers** -- CloudPayments retries up to 100 times. Without deduplication by `TransactionId`, duplicate subscriptions and double charges result.
5. **Subscription state race conditions** -- out-of-order webhooks (Fail arriving after Pay) corrupt status. Use timestamp-based ordering with defined state transitions and pessimistic locking.
6. **54-FZ fiscal receipt non-compliance** -- legal requirement in Russia. Configure CloudKassir during initial setup. HIGH legal recovery cost if missed.

## Implications for Roadmap

Based on combined research, the work splits into 6 phases with two parallel tracks (auth and billing) converging at the paywall phase.

### Phase 1: Database Foundation
**Rationale:** All subsequent phases depend on new Prisma models. Zero external dependencies, pure schema work.
**Delivers:** Subscription, Payment, FeatureFlag models; Course.price and Course.isFree fields; UserProfile.yandexId field; migration applied; seed data (billing_enabled: false, course prices).
**Addresses:** Data layer for billing, feature flags, free content marking.
**Avoids:** Pitfall 6 (scattered access checks) by establishing data model first.

### Phase 2: Feature Flag System
**Rationale:** Needed before any billing logic so billing can be toggled. Small scope (~1 day), depends only on Phase 1.
**Delivers:** `isFeatureEnabled()` utility with globalThis cache, admin toggle procedure, admin UI switch.
**Addresses:** Testing toggle (billing on/off), dev bypass, admin override.
**Avoids:** Pitfall 11 (toggle without proper isolation).

### Phase 3: Yandex ID Auth
**Rationale:** Independent of billing. Can run in parallel with Phase 4. Auth is foundational -- users must be able to log in before paying.
**Delivers:** Full Yandex OAuth flow (initiate, callback, session creation), account linking by email for existing Google users, updated login/register UI, `handle_new_user` trigger update for multi-provider metadata.
**Addresses:** All auth table stakes from FEATURES.md.
**Avoids:** Pitfalls 1 (Supabase limitation), 2 (user lockout), 9 (trigger metadata mismatch).

### Phase 4: CloudPayments Webhooks
**Rationale:** Independent of auth. Can run in parallel with Phase 3. Webhooks must work before any UI integration.
**Delivers:** HMAC verification, idempotent webhook handlers (Check/Pay/Fail/Recurrent), Payment records, subscription lifecycle management, CloudKassir receipt configuration.
**Addresses:** All billing infrastructure table stakes.
**Avoids:** Pitfalls 3 (missing HMAC), 4 (non-idempotent handlers), 5 (state machine), 7 (Check confusion), 10 (54-FZ), 14 (rate limiter blocking webhooks).

### Phase 5: Billing Router + Payment UI
**Rationale:** Depends on Phase 1 (models) + Phase 4 (webhooks working). Builds the user-facing billing experience.
**Delivers:** billing tRPC router, CloudPayments widget integration, pricing page, subscription management in profile (status, cancel, payment history).
**Addresses:** Subscription management features, pricing display, payment flow.
**Avoids:** Pitfall 8 (hardcoded prices -- serve from DB), Pitfall 12 (widget styling -- use popup mode).

### Phase 6: Paywall + Content Gating
**Rationale:** MUST be last. Depends on Phases 1, 2, and 5. This is where all pieces converge.
**Delivers:** `checkSubscriptionAccess()` centralized service, modified `learning.getLesson` with access field, lock icons in catalog, `LessonLocked` component with CTA, free tier logic (first N lessons), E2E test of billing toggle on/off.
**Addresses:** All paywall features, free content strategy, soft gating.
**Avoids:** Pitfall 6 (scattered access checks), Pitfall 11 (toggle isolation), Pitfall 13 (mid-video expiry).

### Phase Ordering Rationale

- **Phase 1 first:** Pure data layer, no external dependencies, blocks everything else.
- **Phase 2 early:** Small scope, enables billing toggle for all subsequent testing.
- **Phases 3 and 4 in parallel:** Auth and billing are completely independent tracks. Parallelizing halves the calendar time.
- **Phase 5 after Phase 4:** Payment UI needs working webhooks to verify end-to-end flow.
- **Phase 6 last:** Paywall is the integration layer -- it consumes auth, billing, feature flags, and content models. Building it last means all dependencies are stable.
- **Each phase can be deployed independently** to production with billing toggle disabled.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Yandex Auth):** Supabase Admin API session creation via `generateLink()` + `verifyOtp()` pattern needs sandbox validation. The exact session-setting mechanism may require experimentation.
- **Phase 4 (CloudPayments Webhooks):** Exact webhook payload format, HMAC header naming, and CloudKassir receipt configuration require sandbox testing. npm package API surface should be verified against latest version.

Phases with standard patterns (skip research-phase):
- **Phase 1 (DB Foundation):** Standard Prisma schema additions, well-documented.
- **Phase 2 (Feature Flags):** Simple DB + cache pattern, already used in codebase (globalThis pattern from rate limiter).
- **Phase 5 (Billing UI):** Standard tRPC router + widget integration, follows existing patterns.
- **Phase 6 (Paywall):** Well-documented access control patterns, architecture fully specified in research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 1 new dependency. Existing stack locked. CloudPayments npm verified. |
| Features | MEDIUM-HIGH | Yandex OAuth features well-documented. CloudPayments features confirmed via official docs. Paywall patterns from industry benchmarks. |
| Architecture | MEDIUM | Yandex + Supabase Admin API integration has no precedent examples found. CloudPayments webhook architecture follows standard patterns. Paywall architecture is straightforward. |
| Pitfalls | HIGH | 14 pitfalls identified from official docs, GitHub discussions, codebase analysis, and industry best practices. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Supabase session creation for custom OAuth:** The exact mechanism for creating a Supabase session after Yandex token exchange needs sandbox testing. `generateLink({ type: 'magiclink' })` -> extract token -> `verifyOtp()` is the documented pattern, but edge cases (existing user, email already confirmed) may surface.
- **CloudPayments webhook payload structure:** Full payload fields and types need validation against sandbox responses. The npm package TypeScript types should be cross-checked.
- **CloudKassir setup process:** Receipt configuration (taxation system, VAT rate for education services) requires CloudPayments account setup and may need accountant consultation for correct tax parameters.
- **Google OAuth deprecation timeline:** Research recommends gradual transition, but the exact timeline depends on user communication strategy -- a product decision, not a technical one.
- **Pricing structure:** Actual prices (per-course and platform monthly/annual) are business decisions. Need from product owner before Phase 5.

## Sources

### Primary (HIGH confidence)
- [Yandex ID OAuth Documentation](https://yandex.com/dev/id/doc/en/) -- OAuth endpoints, scopes, user info format
- [Yandex user info API](https://yandex.com/dev/id/doc/en/user-information) -- response fields
- [Supabase Auth providers](https://supabase.com/docs/guides/auth) -- confirmed Yandex not supported
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken) -- createUser, generateLink
- [CloudPayments Developer Docs](https://developers.cloudpayments.ru/en/) -- API, webhooks, subscriptions
- [cloudpayments npm](https://www.npmjs.com/package/cloudpayments) -- TypeScript client, v4.1.1
- [Vercel nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments) -- architecture patterns
- Codebase analysis: middleware.ts, trpc.ts, auth/actions.ts, schema.prisma

### Secondary (MEDIUM confidence)
- [Supabase custom OIDC discussions #417, #6547](https://github.com/orgs/supabase/discussions/6547) -- confirms generic OIDC not available
- [CloudPayments Node.js client (GitHub)](https://github.com/izatop/cloudpayments) -- HMAC verification patterns
- [CloudPayments 54-FZ / CloudKassir](https://cloudpayments.ru/cloud-cheki) -- receipt requirements
- [Education paywall benchmarks](https://blog.poool.fr/paywalls-for-e-learning-and-online-course-platforms/) -- conversion rates, gating strategies
- [Next.js paywall patterns](https://www.ericburel.tech/blog/static-paid-content-app-router) -- middleware vs. server-side gating

### Tertiary (LOW confidence)
- [Supabase Keycloak workaround](https://tylerjulian.substack.com/p/supabase-generic-oidc-authentication) -- confirmed as fragile, NOT recommended
- [Auth.js Yandex provider](https://authjs.dev/reference/core/providers/yandex) -- reference only, not recommended for this project

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
