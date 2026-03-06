# Domain Pitfalls: Auth Rework + Billing (v1.2)

**Domain:** OAuth provider migration, CloudPayments billing, paywall for educational platform
**Researched:** 2026-03-06
**Confidence:** MEDIUM (CloudPayments docs verified via WebSearch; Supabase custom OAuth limitations confirmed via GitHub discussions)

## Critical Pitfalls

### Pitfall 1: Supabase Auth Does Not Support Yandex ID as Built-in Provider

**What goes wrong:**
Supabase Auth has a fixed list of OAuth providers (Google, GitHub, Apple, Facebook, etc.). Yandex ID is NOT in that list. Attempting to call `signInWithOAuth({ provider: 'yandex' })` will fail. The `signInWithIdToken()` method also rejects custom OIDC providers with error "Custom OIDC provider not allowed".

The current codebase (`apps/web/src/lib/auth/actions.ts`) calls `supabase.auth.signInWithOAuth({ provider: 'google' })` directly. Simply swapping `'google'` to `'yandex'` will not work.

**Why it happens:**
Supabase Auth server (GoTrue) has hardcoded provider configurations. Generic OIDC support is "in progress" (auth server work done, dashboard integration pending) but not available on hosted Supabase as of March 2026.

**Consequences:**
- Cannot use Supabase's built-in OAuth flow for Yandex ID
- Must implement a custom server-side OAuth flow that manually exchanges tokens and creates/links Supabase sessions
- Or use an intermediary like Keycloak (overkill for this project)

**Prevention:**
1. Implement Yandex ID OAuth manually on server side:
   - Create `/api/auth/yandex` route that redirects to `https://oauth.yandex.ru/authorize`
   - Create `/api/auth/yandex/callback` that exchanges code for Yandex token
   - Use Yandex token to get user profile from `https://login.yandex.ru/info`
   - Call `supabase.auth.admin.createUser()` or `supabase.auth.admin.updateUserById()` with Supabase Admin API to create/link the user
   - Generate Supabase session via `supabase.auth.admin.generateLink()` or set custom claims
2. Alternative: Auth.js (NextAuth.js) has a built-in Yandex provider. Could use Auth.js for the OAuth flow and Supabase only for database/RLS. But this means rewriting the entire auth layer.
3. **Recommended approach:** Manual server-side OAuth with Supabase Admin API. Keep email/password auth via Supabase as-is. Add Yandex as a "manual" provider.

**Detection:**
- `signInWithOAuth({ provider: 'yandex' })` throws immediately
- Build-time: no TypeScript error because provider is a string union that includes arbitrary strings in some SDK versions

**Phase to address:**
Phase 1 (Auth Rework) -- design the auth architecture BEFORE writing code. This is an architectural decision, not a simple provider swap.

**Confidence:** HIGH (verified via Supabase GitHub discussions #417, #6547, and official docs)

---

### Pitfall 2: Existing Google OAuth Users Lose Access After Provider Swap

**What goes wrong:**
Current users authenticated via Google OAuth have `auth.users.raw_app_meta_data.provider = 'google'`. Their `UserProfile.id` matches the Supabase `auth.users.id` (UUID). If Google OAuth is disabled and only Yandex ID is enabled:
- Existing users cannot log in anymore (no Google button, no Yandex account linked)
- User data (diagnostic sessions, learning progress, watch history) is orphaned
- The Supabase trigger `handle_new_user` may create duplicate UserProfile rows if the same person registers with Yandex using a different email

**Why it happens:**
OAuth providers use different user identifiers. Google returns a Google-specific sub claim. Yandex returns a Yandex-specific UID. Even if the email is the same, Supabase treats these as separate identities unless explicitly linked.

**Consequences:**
- Data loss for existing users (progress, diagnostics, skill profiles)
- Duplicate accounts for the same person
- Admin panel shows ghost users

**Prevention:**
1. **Keep Google OAuth active** during transition period (weeks/months). Add Yandex ID as an additional auth method, don't replace.
2. **Implement account linking:** When a user logs in with Yandex ID and an account with the same email already exists (from Google), link the identities:
   - Look up existing user by email in `auth.users`
   - Use `supabase.auth.admin.updateUserById()` to add Yandex identity to the existing user
   - Do NOT create a new user
3. **Email as the canonical identifier:** Match users by verified email, not by provider UID
4. **Migration script:** For existing Google-only users, send an email asking them to also link their Yandex account (or set a password for email/password fallback)
5. **Never disable Google OAuth silently.** Show UI prompt: "We're switching to Yandex ID. Please link your account."

**Detection:**
- `UserProfile` count increases without corresponding new real users
- Users report "my progress is gone"
- Admin panel shows users with 0 lessons completed who previously had progress

**Phase to address:**
Phase 1 (Auth Rework) -- account linking logic must be designed first. The transition must be gradual, not a hard cutover.

**Confidence:** HIGH (standard OAuth migration pattern, verified against Supabase auth.users schema)

---

### Pitfall 3: CloudPayments Webhook Without HMAC Verification

**What goes wrong:**
CloudPayments sends webhook notifications (Check, Pay, Fail, Recurrent, Cancel, Refund) to your endpoint. Each request includes `X-Content-HMAC` and `Content-HMAC` headers calculated using HMAC-SHA256 with your API secret. If you don't verify these signatures:
- An attacker can forge webhook calls to your endpoint
- They can mark any user's subscription as "paid" without actual payment
- They can trigger fake refund/cancel events to lock users out of content

CloudPayments sends notifications from specific IPs (130.193.70.192, 185.98.85.109, 91.142.84.0/27, 87.251.91.160/27, 185.98.81.0/28), but IP filtering alone is insufficient (can be spoofed from within those ranges or if CloudPayments adds new IPs).

**Why it happens:**
Webhook endpoints are public URLs. Developers often skip signature verification during development ("it works, I'll add security later") and forget to add it before production.

**Consequences:**
- Unauthorized access to paid content
- Revenue loss
- Subscription state corruption

**Prevention:**
1. **Always verify HMAC signature** on every webhook request:
   ```typescript
   import crypto from 'crypto';

   function verifyCloudPaymentsWebhook(body: string, hmacHeader: string, apiSecret: string): boolean {
     const calculated = crypto.createHmac('sha256', apiSecret).update(body).digest('base64');
     return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hmacHeader));
   }
   ```
2. Use `crypto.timingSafeEqual` (not `===`) to prevent timing attacks
3. Return HTTP 200 with `{ "code": 0 }` only after verification passes
4. Log failed verification attempts for monitoring
5. **IP allowlist as defense-in-depth** (not sole protection): configure Nginx to restrict webhook endpoint to CloudPayments IPs

**Detection:**
- Webhook endpoint accessible without any auth headers
- Subscriptions appearing for users who never paid
- No failed webhook verification logs

**Phase to address:**
Phase 2 (Billing) -- implement HMAC verification as the FIRST step of webhook handler, before any business logic.

**Confidence:** HIGH (CloudPayments official docs confirm HMAC headers on all notifications)

---

### Pitfall 4: Non-Idempotent Webhook Handlers Cause Double-Charging or Double-Access

**What goes wrong:**
CloudPayments retries webhook delivery up to 100 times with increasing intervals if it doesn't receive `{ "code": 0 }` response. Common failures:
1. Your server returns 500 (temporary error) -- CloudPayments retries, your handler processes the same payment twice, creating duplicate subscription records
2. Your handler succeeds but returns non-zero code due to a bug in the response format -- CloudPayments retries, user gets charged again on retry
3. Network timeout -- your handler completed the operation but response didn't reach CloudPayments, so it retries

Without idempotency, each retry creates a new subscription record, extends access period, or charges the user again.

**Why it happens:**
Webhook handlers are often written as "receive event -> do work -> return success" without checking if the event was already processed.

**Consequences:**
- Duplicate subscription records in database
- Users charged multiple times for the same period
- Inconsistent subscription state (two active subscriptions for the same user+course)

**Prevention:**
1. **Store processed transaction IDs:** Create a `WebhookEvent` table:
   ```sql
   CREATE TABLE webhook_event (
     id TEXT PRIMARY KEY,           -- CloudPayments TransactionId
     event_type TEXT NOT NULL,      -- 'pay', 'fail', 'recurrent', 'cancel'
     processed_at TIMESTAMPTZ DEFAULT NOW(),
     payload JSONB
   );
   ```
2. **Check before processing:** At handler start, `SELECT id FROM webhook_event WHERE id = $transactionId`. If exists, return `{ "code": 0 }` immediately without re-processing.
3. **Use CloudPayments `X-Request-ID` header** (or `TransactionId` from payload) as the idempotency key
4. **Wrap handler in a database transaction** with a unique constraint on the event ID -- the DB prevents duplicates even under concurrent retries
5. **Return `{ "code": 0 }` AFTER committing** to DB, not before

**Detection:**
- Multiple `Subscription` records for the same user+plan with overlapping dates
- CloudPayments dashboard shows 100 delivery attempts for a single webhook
- Users complain about double charges

**Phase to address:**
Phase 2 (Billing) -- idempotency must be built into the webhook handler from day one, not retrofitted.

**Confidence:** HIGH (CloudPayments docs confirm 100 retries; idempotency is standard webhook practice)

---

### Pitfall 5: Subscription State Inconsistency (Race Conditions)

**What goes wrong:**
Multiple events can arrive nearly simultaneously for the same subscription:
1. User opens lesson page (checks subscription status)
2. CloudPayments sends `Fail` webhook (payment failed)
3. CloudPayments retries and sends `Pay` webhook (payment succeeded on retry)
4. User navigates to another lesson (checks subscription status again)

If the Fail webhook is processed after the Pay webhook (out of order), the subscription is incorrectly marked as inactive. The user loses access to content they paid for.

Another scenario: User cancels subscription via `my.cloudpayments.ru/unsubscribe`. The Cancel webhook arrives. But a pre-scheduled Recurrent charge was already in flight. The Pay webhook for the last charge arrives after Cancel. User's subscription is reactivated when it should be cancelled.

**Why it happens:**
Webhooks are delivered asynchronously and can arrive out of order. CloudPayments does not guarantee event ordering. HTTP is not a reliable message queue.

**Consequences:**
- Users lose access to paid content (false negative)
- Cancelled users retain access (false positive, revenue leakage)
- Support tickets about "I paid but can't access"

**Prevention:**
1. **Use timestamps, not event order:** Each webhook contains a payment date/time. Compare with the last known state timestamp:
   ```typescript
   if (event.createdAt <= subscription.lastEventAt) {
     // This is an older event, ignore it
     return { code: 0 };
   }
   ```
2. **State machine for subscriptions:** Define valid transitions:
   - `ACTIVE` -> `PAST_DUE` (fail) -> `ACTIVE` (successful retry) or `CANCELLED` (max retries exceeded)
   - `ACTIVE` -> `CANCELLED` (user cancel) -- no going back to ACTIVE from CANCELLED without new payment
   - `PAST_DUE` -> `ACTIVE` (successful retry)
3. **Pessimistic locking:** When processing a webhook, lock the subscription row with `SELECT ... FOR UPDATE` to prevent concurrent modifications
4. **Grace period for failed payments:** Don't revoke access immediately on first Fail. CloudPayments retries daily. Give 3-5 days grace period before downgrading.

**Detection:**
- Subscription status flips between active/inactive rapidly
- Webhook processing logs show out-of-order events
- Users report intermittent access loss

**Phase to address:**
Phase 2 (Billing) -- design the state machine before implementing webhook handlers.

**Confidence:** MEDIUM (based on general payment system patterns; CloudPayments-specific retry behavior confirmed via docs)

---

### Pitfall 6: Content Access Check Not Separated from Subscription State

**What goes wrong:**
Developers often check subscription status directly in the lesson page component or tRPC router:
```typescript
// BAD: Checking subscription inline
const subscription = await getSubscription(userId);
if (!subscription || subscription.status !== 'ACTIVE') {
  throw new TRPCError({ code: 'FORBIDDEN' });
}
```

This creates problems:
1. **No caching:** Every page load hits the DB to check subscription status
2. **No grace period logic:** Binary active/inactive, no room for "past due but still has access"
3. **Scattered access control:** Paywall logic duplicated across lesson page, video endpoint, AI chat, summary endpoint
4. **Testing nightmare:** Can't test content access without a real subscription

**Why it happens:**
It's the simplest implementation -- check and block. But access control is a cross-cutting concern that needs centralization.

**Consequences:**
- Inconsistent paywall behavior (some endpoints check, others don't)
- Performance degradation (N+1 subscription queries)
- Difficult to change paywall rules (e.g., "first 2 lessons free" requires touching every endpoint)
- A/B testing billing plans becomes impossible

**Prevention:**
1. **Create a centralized access service:**
   ```typescript
   // packages/api/src/services/access.ts
   export async function canAccessLesson(userId: string, lessonId: string): Promise<{
     allowed: boolean;
     reason: 'free_content' | 'active_subscription' | 'grace_period' | 'no_subscription' | 'trial';
   }> { ... }
   ```
2. **Create a tRPC middleware** that injects access level into context:
   ```typescript
   export const paidProcedure = protectedProcedure.use(async ({ ctx, next }) => {
     const access = await checkAccess(ctx.user.id);
     return next({ ctx: { ...ctx, access } });
   });
   ```
3. **Define free content explicitly:** Diagnostic is free. First 1-2 lessons per course are free. Everything else requires subscription.
4. **Cache subscription status** in context per-request (not per-endpoint). One DB query per request, not per endpoint call.
5. **Feature flag for billing toggle:** `BILLING_ENABLED=false` bypasses all access checks (for testing/staging).

**Detection:**
- Multiple `getSubscription()` calls in a single page load (check tRPC batch queries)
- Some lessons accessible without subscription while others are blocked (inconsistency)
- No way to toggle billing off for testing

**Phase to address:**
Phase 3 (Paywall) -- design the access service BEFORE implementing paywall UI.

**Confidence:** HIGH (architectural pattern, confirmed by codebase analysis showing no existing access control layer)

---

## Moderate Pitfalls

### Pitfall 7: CloudPayments Check Webhook Misunderstood

**What goes wrong:**
CloudPayments sends a "Check" notification BEFORE processing a payment to verify the order is valid. The expected response is `{ "code": 0 }` to approve or `{ "code": 10-13 }` to reject. Developers often:
1. Skip implementing the Check handler entirely (CloudPayments still processes payments, but you lose fraud prevention)
2. Always return `{ "code": 0 }` without validating the user/amount/order
3. Confuse Check with Pay and start granting access in the Check handler

**Prevention:**
1. In the Check handler, validate: user exists, amount matches expected price, currency is RUB, subscription plan is valid
2. Do NOT grant access or create subscription records in Check -- only in Pay
3. Return error codes for invalid requests:
   - `{ "code": 10 }` -- declined (invalid data)
   - `{ "code": 11 }` -- declined (currency mismatch)
   - `{ "code": 13 }` -- declined (amount mismatch)

**Phase to address:** Phase 2 (Billing)

---

### Pitfall 8: Hardcoded Prices in Frontend Without Server Validation

**What goes wrong:**
Prices displayed on the frontend (e.g., "999 RUB/month") are hardcoded in React components. But the actual charge amount comes from CloudPayments API. If these diverge:
- User sees "999 RUB" but gets charged "1499 RUB" (price changed in CloudPayments but not in frontend)
- Or worse: attacker modifies the payment widget amount parameter to "1 RUB" and your Check webhook approves it because it doesn't validate amount

**Prevention:**
1. **Store prices in DB** (or at minimum in server-side config, not frontend)
2. **Validate amount in Check webhook** against the expected price for the subscription plan
3. **Use CloudPayments subscription plans** (not ad-hoc amounts) for recurring payments -- the plan defines the amount, not the frontend
4. **Display prices from server** via a tRPC endpoint, not hardcoded in components

**Phase to address:** Phase 2 (Billing) + Phase 3 (Paywall UI)

---

### Pitfall 9: Supabase `handle_new_user` Trigger Breaks with Manual Auth Flow

**What goes wrong:**
The existing Supabase trigger `handle_new_user` fires on `INSERT` into `auth.users` and creates a `UserProfile` row. When implementing manual Yandex OAuth via `supabase.auth.admin.createUser()`, the trigger fires. But:
1. If using `supabase.auth.admin.updateUserById()` to link Yandex identity to existing user, the trigger does NOT fire (it's an UPDATE, not INSERT), which is correct
2. If accidentally calling `createUser()` when user already exists, Supabase may return an error or create a duplicate, depending on the email uniqueness constraint
3. The trigger uses `NEW.raw_user_meta_data->>'full_name'` for the name field. Yandex returns user data in a different format (`real_name`, `first_name`, `last_name`) than Google (`full_name`, `name`)

**Prevention:**
1. Update `handle_new_user` trigger to handle multiple provider metadata formats:
   ```sql
   COALESCE(
     NEW.raw_user_meta_data->>'full_name',
     NEW.raw_user_meta_data->>'real_name',
     NEW.raw_user_meta_data->>'name',
     NEW.raw_user_meta_data->>'display_name',
     'User'
   )
   ```
2. Use `ensureUserProfile()` (already exists in `packages/api/src/utils/ensure-user-profile.ts`) as a safety net -- it creates the profile if missing
3. Test the trigger with Yandex metadata format before deploying

**Phase to address:** Phase 1 (Auth Rework)

---

### Pitfall 10: CloudPayments Recurring Without Receipt (54-FZ Compliance)

**What goes wrong:**
Russian law (54-FZ) requires issuing an electronic receipt (chek) for every online payment. CloudPayments has a built-in CloudKassir integration for this. If you create recurring subscriptions without configuring receipt generation:
- Tax authorities can fine the business
- Users don't receive receipts
- CloudPayments may block the account for non-compliance

**Prevention:**
1. Configure CloudKassir (built into CloudPayments, no separate integration needed)
2. Include `CloudPayments.Receipt` object in payment request with correct tax parameters:
   - `taxationSystem` (taxation system code)
   - `items` array with description, price, quantity, tax rate
3. Test receipt generation in CloudPayments sandbox before going live
4. Verify receipts arrive at the user's email after each recurring charge

**Phase to address:** Phase 2 (Billing) -- must be configured during initial CloudPayments setup, not retroactively.

**Confidence:** HIGH (54-FZ is mandatory for Russian online payments)

---

### Pitfall 11: Testing Toggle Implemented as Feature Flag Without Proper Isolation

**What goes wrong:**
The project requirement mentions "testing toggle: enabling/disabling billing without deploy." A naive implementation (`if (process.env.BILLING_ENABLED === 'false') return true` in access check) creates risks:
1. Toggle accidentally left disabled in production -- all content is free
2. Toggle state inconsistency between server instances (if using multiple containers/processes)
3. No audit trail of toggle changes
4. Toggle doesn't reset subscription state -- when re-enabled, users who accessed content during "free mode" might have inconsistent progress/history

**Prevention:**
1. Store toggle state in the database, not in environment variables (env vars require restart)
2. Admin panel toggle with confirmation dialog and audit log
3. When billing is disabled, still track what would have been blocked (shadow mode):
   ```typescript
   if (!billingEnabled) {
     // Log that this user would have been blocked, but allow access
     console.log(`[BILLING_SHADOW] User ${userId} accessing paid lesson ${lessonId}`);
     return { allowed: true, reason: 'billing_disabled' };
   }
   ```
4. Clear cache/state when toggling billing on/off

**Phase to address:** Phase 3 (Paywall) -- design toggle as part of the access service, not as an afterthought.

---

## Minor Pitfalls

### Pitfall 12: CloudPayments Widget Styling Conflicts with shadcn/ui

**What goes wrong:**
CloudPayments payment widget (iframe or popup) injects its own CSS. If the widget is embedded inline (not popup), its styles can conflict with Tailwind CSS / shadcn/ui components. Button styles, input styles, and z-index issues are common.

**Prevention:**
1. Use CloudPayments popup mode (separate window), not inline iframe
2. If using checkout widget, isolate it in a page without the main layout
3. Test widget rendering on mobile -- popup may be blocked by mobile browsers

**Phase to address:** Phase 2 (Billing)

---

### Pitfall 13: Missing Subscription Expiry Handling on Lesson Page

**What goes wrong:**
User has an active subscription, opens a lesson, starts watching a 60-minute video. Subscription expires during the video (e.g., it was the last day). The video continues playing (already loaded), but any API calls (chat, summary) fail with 403. User experience is confusing.

**Prevention:**
1. Don't interrupt active video playback -- let the user finish the current video
2. On the next navigation (going to another lesson), show the paywall
3. For API calls (chat/summary), check access but show a graceful message: "Subscription expired. Renew to continue using AI assistant."
4. Cache lesson summary so it remains available even after subscription expires (it was already generated)

**Phase to address:** Phase 3 (Paywall)

---

### Pitfall 14: Rate Limiter in globalThis Breaks Billing Webhook Reliability

**What goes wrong:**
The existing rate limiter (`packages/api/src/middleware/rate-limit.ts`) uses `globalThis.Map`. CloudPayments webhook retries come from the same IPs at CloudPayments. If the webhook endpoint is rate-limited, CloudPayments gets 429 responses and retries 100 times, all failing. Subscription state is never updated.

**Prevention:**
1. Exempt webhook endpoints from rate limiting entirely (they're protected by HMAC, not rate limits)
2. Or create a separate rate limit tier for webhook endpoints with a much higher limit
3. Webhook endpoint should be at `/api/webhooks/cloudpayments`, separate from the tRPC API routes

**Phase to address:** Phase 2 (Billing)

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 1: Auth Rework | Yandex ID not supported by Supabase (Pitfall 1) | Manual server-side OAuth + Supabase Admin API |
| Phase 1: Auth Rework | Existing users locked out (Pitfall 2) | Gradual transition, account linking by email |
| Phase 1: Auth Rework | Trigger metadata mismatch (Pitfall 9) | Update `handle_new_user` SQL for multi-provider |
| Phase 2: Billing | Missing HMAC verification (Pitfall 3) | Implement as first line of webhook handler |
| Phase 2: Billing | Non-idempotent handlers (Pitfall 4) | WebhookEvent table + transaction ID dedup |
| Phase 2: Billing | State machine missing (Pitfall 5) | Design subscription states before coding |
| Phase 2: Billing | Check webhook confusion (Pitfall 7) | Validate but don't grant access in Check |
| Phase 2: Billing | No receipts / 54-FZ (Pitfall 10) | Configure CloudKassir from day one |
| Phase 2: Billing | Rate limiter blocking webhooks (Pitfall 14) | Exempt webhook endpoints |
| Phase 3: Paywall | Scattered access checks (Pitfall 6) | Centralized access service + middleware |
| Phase 3: Paywall | Hardcoded prices (Pitfall 8) | Server-side price source + Check validation |
| Phase 3: Paywall | Testing toggle leak (Pitfall 11) | DB-stored toggle with audit log |
| Phase 3: Paywall | Mid-video expiry (Pitfall 13) | Graceful degradation, don't interrupt playback |

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Yandex ID architecture wrong (Pitfall 1) | HIGH | Rewrite auth flow; if using NextAuth.js, must migrate all session handling |
| Users locked out (Pitfall 2) | HIGH | Manual account linking via SQL; communicate with affected users; potential data loss |
| Missing HMAC (Pitfall 3) | LOW (if no exploit) | Add verification, rotate API secret, audit subscription records for fraud |
| Duplicate subscriptions (Pitfall 4) | MEDIUM | Deduplicate records, refund double charges, add idempotency |
| State inconsistency (Pitfall 5) | HIGH | Manual audit of all subscriptions, reconcile with CloudPayments dashboard |
| Scattered access checks (Pitfall 6) | MEDIUM | Refactor to centralized service, may break existing endpoint behavior |
| 54-FZ non-compliance (Pitfall 10) | HIGH (legal) | Retroactively configure CloudKassir, issue missing receipts, potential fines |

## "Looks Done But Isn't" Checklist (v1.2)

- [ ] **Yandex OAuth flow:** Server-side token exchange works, not just redirect to Yandex
- [ ] **Account linking:** Same-email Google+Yandex users merge into one UserProfile, not two
- [ ] **HMAC verification:** Webhook handler rejects requests with invalid signature (test with tampered payload)
- [ ] **Idempotency:** Same webhook delivered twice creates only one subscription record
- [ ] **State machine:** Subscription transitions follow defined rules; out-of-order webhooks handled
- [ ] **Check webhook:** Returns error codes for invalid amounts/currencies (test with modified widget)
- [ ] **CloudKassir receipts:** User receives email receipt after payment (test in sandbox)
- [ ] **Access service:** `canAccessLesson()` is the SINGLE source of truth for content access
- [ ] **Billing toggle:** Admin can disable billing; re-enabling correctly enforces paywall
- [ ] **Free content:** Diagnostic + first lessons accessible without subscription
- [ ] **Rate limit exclusion:** Webhook endpoints not rate-limited
- [ ] **Prices from server:** Frontend displays prices from tRPC, not hardcoded values
- [ ] **Grace period:** Failed payment doesn't instantly revoke access (3-5 day grace)

## Sources

- [Supabase Custom OAuth providers discussion #417](https://github.com/orgs/supabase/discussions/417) -- confirms Yandex ID not supported, workarounds discussed
- [Supabase generic OIDC discussion #6547](https://github.com/orgs/supabase/discussions/6547) -- generic OIDC provider support "in progress"
- [Auth.js Yandex provider](https://authjs.dev/reference/core/providers/yandex) -- confirms Auth.js supports Yandex natively
- [NextAuth.js Yandex provider](https://next-auth.js.org/providers/yandex) -- alternative auth library with Yandex support
- [CloudPayments Developer Documentation](https://developers.cloudpayments.ru/en/) -- HMAC verification, webhook types, retry policy (100 attempts), subscription API
- [CloudPayments recurrent payments](https://cloudpayments.ru/features/recurrent) -- subscription management, retry on failed payments
- [CloudPayments notifications](https://cloudpayments.ru/docs/notifications) -- Check, Pay, Fail, Recurrent, Cancel webhook types
- [Payment Webhook Best Practices (Apidog)](https://apidog.com/blog/payment-webhook-best-practices/) -- idempotency, signature verification patterns
- [Webhooks Best Practices (Medium)](https://medium.com/@xsronhou/webhooks-best-practices-lessons-from-the-trenches-57ade2871b33) -- retry handling, idempotency keys
- Codebase analysis: `apps/web/src/lib/auth/actions.ts` -- current Google OAuth implementation
- Codebase analysis: `apps/web/src/middleware.ts` -- current route protection
- Codebase analysis: `packages/api/src/trpc.ts` -- protectedProcedure, no access/subscription check
- Codebase analysis: `packages/db/prisma/schema.prisma` -- no Subscription model exists yet

---
*Pitfalls research for: MAAL v1.2 Auth Rework + Billing -- Yandex ID, CloudPayments, Paywall*
*Researched: 2026-03-06*
