# Feature Landscape: Auth Rework + Billing

**Domain:** Yandex ID OAuth, CloudPayments Subscriptions, SaaS Paywall for Education Platform
**Researched:** 2026-03-06
**Market:** Russian Federation (Yandex ID, CloudPayments -- RU-specific services)
**Overall confidence:** MEDIUM-HIGH

---

## 1. YANDEX ID AUTH

### Table Stakes

Features users expect from a social login. Missing = broken or confusing auth experience.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-click OAuth login button | Users expect single-click social login on any modern platform | Low | Standard OAuth 2.0 Authorization Code flow, Yandex supports PKCE |
| Email + display name from Yandex | Profile auto-fill after login reduces friction | Low | Scopes: `login:info`, `login:email`. Returns `default_email`, `display_name`, `first_name`, `last_name` |
| Avatar from Yandex | Profile completeness | Low | Scope: `login:avatar`. Returns `default_avatar_id`, construct URL: `https://avatars.yandex.net/get-yapic/{id}/islands-200` |
| Token refresh without re-login | Session persistence | Low | Yandex OAuth returns `refresh_token` alongside `access_token`. `expires_in` field in response |
| Redirect back to original page | UX continuity after login | Low | Standard `state` parameter in OAuth flow, Yandex supports it |
| Error handling (denied, expired) | Users who cancel or have expired codes need clear messaging | Low | Confirmation code lifetime is 10 min, handle expired/denied states |
| Existing Google account migration | Current users must not lose access | High | **Critical:** current users authenticated via Google OAuth. Need account linking strategy -- match by email, or provide migration flow |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dual provider (Yandex + email/password) | Flexibility for users without Yandex accounts | Low | Already have email/password via Supabase Auth, keep it |
| Account linking (multiple providers) | User can log in via email OR Yandex to same account | Medium | Match by verified email address. Supabase supports identity linking |
| Silent token refresh | No session interruption during long study sessions | Low | Background refresh before token expiry |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Keep Google OAuth alongside Yandex | Maintaining two OAuth providers doubles complexity for tiny user base. Russian audience uses Yandex, not Google for auth | Remove Google OAuth, add Yandex. Keep email/password as fallback |
| Auth.js / NextAuth instead of Supabase Auth | Adding NextAuth means two auth systems, session conflicts, massive refactor | Use Supabase Auth. Yandex ID not natively supported but solvable via manual OAuth route |
| Phone number scope | Unnecessary PII, 152-FZ implications, not needed for education platform | Only request `login:info`, `login:email`, `login:avatar` |
| Custom auth server | Over-engineering for MVP | Leverage Supabase Auth flows, handle Yandex OAuth in API route |

### Implementation Approach: Critical Decision

**Supabase Auth does NOT natively support Yandex ID as a provider.** Three approaches:

| Approach | Complexity | Recommendation |
|----------|------------|----------------|
| **A: Manual OAuth in API route** -- handle Yandex OAuth flow in Next.js API route, exchange code for token, get user info, then create/match Supabase user | Medium | **Recommended.** Full control, no extra dependencies. Yandex OAuth is simple standard code flow. Create `/api/auth/yandex/callback` route |
| **B: Supabase custom OIDC** (public beta Nov 2025) -- configure Yandex as custom OIDC provider in Supabase dashboard | Low if available | Risky -- feature is in beta, Yandex may not be OIDC-compliant (no `.well-known/openid-configuration`). **LOW confidence this works today** |
| **C: Auth.js (NextAuth)** with Yandex provider built-in | High | **Do not use.** Would require ripping out Supabase Auth entirely. Auth.js has native Yandex provider (`next-auth/providers/yandex`) but migration cost is prohibitive |

**Verdict:** Approach A. Build manual OAuth flow in API route, exchange Yandex token for user info, then use `supabase.auth.admin.createUser()` or match existing user by email.

### Yandex OAuth Technical Details

**Confidence: HIGH** (from official Yandex docs)

- **Authorization URL:** `https://oauth.yandex.ru/authorize`
- **Token URL:** `https://oauth.yandex.ru/token`
- **User Info URL:** `https://login.yandex.ru/info?format=json`
- **Scopes:** `login:info login:email login:avatar`
- **PKCE:** Supported (recommended)
- **Confirmation code lifetime:** 10 minutes
- **App registration:** https://oauth.yandex.ru/client/new

**User info response fields:**
```json
{
  "id": "1234567890",
  "login": "username",
  "display_name": "Ivan Ivanov",
  "first_name": "Ivan",
  "last_name": "Ivanov",
  "default_email": "user@yandex.ru",
  "emails": ["user@yandex.ru"],
  "default_avatar_id": "abc123",
  "is_avatar_empty": false,
  "sex": "male",
  "birthday": "1990-01-15"
}
```

---

## 2. CLOUDPAYMENTS BILLING

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Payment widget (checkout popup) | Users expect familiar, trusted payment form without redirect | Low | CloudPayments Widget -- `<script src="https://widget.cloudpayments.ru/bundles/cloudpayments.js">`. Opens iframe overlay. **Never bundle or self-host this script** |
| Recurring subscription creation | Core billing feature -- charge monthly without re-entering card | Medium | Widget creates initial payment + subscription via `recurrent` data param |
| Subscription cancellation | Legal requirement (152-FZ, consumer protection). Must be self-service | Low | API: `/subscriptions/cancel`. Must be accessible from profile page |
| Webhook processing (Check, Pay, Fail, Recurrent) | Server must know about payment outcomes to activate/deactivate subscriptions | Medium | 4 webhook types. CloudPayments retries 100 times if no valid response. Must return `{"code": 0}` for success |
| Test mode / sandbox | Development without real charges | Low | Use `pk_test_` Public ID prefix. Test card: `4111 1111 1111 1111`, any future date, any CVV |
| 54-FZ fiscal receipts (online kassa) | **Legal requirement** in Russia for online payments | Medium | CloudKassir integration -- cloud receipt service, no physical kassa needed. Configure VAT rate per organization type. Education services may qualify for "NDS ne oblagaetsya" |
| Two subscription tiers | Project requirement -- per-course and full platform | Medium | Two separate subscription plans with different `Amount` and `Description` per plan |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Subscription pause (not just cancel) | User retains intent to continue, reduces churn | Low | CloudPayments API supports changing next charge date -- effectively a "pause" |
| Grace period on failed payment | Retry before locking content. Reduces involuntary churn | Low | CloudPayments auto-retries. Configure retry count and interval in dashboard. Use `PAST_DUE` status with 3-day window |
| Apple Pay / Google Pay in widget | Higher conversion on mobile | Low | CloudPayments widget supports both if site uses HTTPS + TLS 1.2. Already have SSL |
| SBP (Sistema Bystryh Platezhey) | Alternative payment for users without cards. Popular in Russia | Medium | CloudPayments supports SBP |
| Proration on plan upgrade | Fair pricing when switching from per-course to full platform mid-cycle | High | Not built into CloudPayments. Manual calculation needed. **Defer to v2** |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom payment form (Checkout API) | PCI DSS compliance nightmare, unnecessary complexity | Use CloudPayments Widget (iframe). They handle PCI DSS |
| Multiple payment providers (Stripe + CloudPayments) | Stripe doesn't work well in Russia post-2022. CloudPayments is the standard for RU market | CloudPayments only |
| Manual invoice / bank transfer | Small B2C amounts don't justify the overhead | Card payments only via widget |
| Crypto payments | Regulatory gray area in Russia, tiny user segment | Not worth the complexity |
| Lifetime deal pricing | Revenue model mismatch for subscription education platform | Stick to monthly/annual subscriptions |
| Complex pricing tiers (Basic/Pro/Enterprise) | Over-engineering for MVP | Two plans: COURSE and PLATFORM. Add tiers when user demand proves it |
| Annual vs monthly toggle on same subscription | Plan change mid-cycle requires proration, credit calculations | Separate subscriptions. Cancel monthly, start annual |

### CloudPayments Technical Details

**Confidence: MEDIUM** (from official docs + web search, verify exact API contracts during implementation)

**Widget integration (client-side):**
```javascript
// Load from CDN (never bundle)
// <script src="https://widget.cloudpayments.ru/bundles/cloudpayments.js"></script>

var widget = new cp.CloudPayments();
widget.pay('charge', {
    publicId: 'pk_test_xxx',
    description: 'Subscription MPSTATS Academy',
    amount: 990,
    currency: 'RUB',
    accountId: 'user@email.com',
    data: {
      cloudPayments: {
        recurrent: { interval: 'Month', period: 1 }
      }
    }
  },
  {
    onSuccess: function(options) { /* redirect to success */ },
    onFail: function(reason, options) { /* show error */ },
    onComplete: function(paymentResult, options) { /* update UI */ }
  }
);
```

**Webhook endpoints (server-side, Next.js API routes):**
- `POST /api/billing/check` -- "Can this user pay?" Return `{"code": 0}` to allow
- `POST /api/billing/pay` -- Payment succeeded. Activate subscription in DB
- `POST /api/billing/fail` -- Payment failed. Log, notify user if needed
- `POST /api/billing/recurrent` -- Recurring charge status update
- `POST /api/billing/cancel` -- Subscription cancelled

**Subscription API (server-to-server, Basic Auth):**
- `POST /subscriptions/create` -- Create recurring subscription
- `POST /subscriptions/update` -- Change amount, interval, next charge date
- `POST /subscriptions/cancel` -- Cancel subscription
- `POST /subscriptions/get` -- Get subscription details
- `POST /subscriptions/find` -- Find subscriptions by accountId

**Authentication:** HTTP Basic Auth with `PublicId:ApiSecret`.

**Node.js package:** `npm i cloudpayments` (TypeScript support, `ClientService` class).

---

## 3. PAYWALL / CONTENT GATING

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Free diagnostic (always) | Users need to experience AI value before paying. Diagnostic is the hook | Low | No gating on `/diagnostic` routes |
| Free preview lessons (1-2 per course) | "Try before you buy" is expected. Show enough to demonstrate value | Low | Mark specific lessons as `isFreePreview: true` in DB. Show lock icon on paid lessons |
| Locked lesson page with CTA | Clear "subscribe to unlock" instead of 404 or empty page | Low | `LessonLocked.tsx` component with pricing CTA and value proposition |
| Blur/preview of locked content | Users see content exists but can't access it. Creates desire | Low | Show lesson title, duration, description. Hide video + AI panels |
| Subscription status check (server-side) | Prevent bypass. Check on every protected resource load | Medium | tRPC `subscribedProcedure` middleware. Check `Subscription` table |
| Clear pricing page | Transparent plans, pricing, what's included | Low | Two plans: per-course (cheaper) and full platform (value). Highlight savings |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Progress preservation after subscription | Free content progress carries over. No "start from scratch" | Low | Already tracking `LessonProgress`. Subscription just unlocks more content |
| "My Track" shows locked + free recommendations | AI path recommends both free and paid content. Shows full potential | Low | Existing adaptive path logic, annotate locked items with lock icon |
| Annual discount | Higher LTV, lower churn. Standard SaaS pattern | Low | 2 months free on annual. Show monthly equivalent price |
| Dynamic free content rotation | Occasionally unlock different free lessons to show breadth | Medium | **Defer.** Start with fixed free lessons |
| Team/corporate plans | B2B revenue stream for marketplace companies | High | **Defer to v2.** Needs admin panel extensions, bulk licensing |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Hard paywall on everything | Zero free value = zero conversions | Soft paywall: diagnostic free + 1-2 lessons per course free |
| Time-limited free trial (7 days full access) | Content consumed once. After trial, user already watched what they needed | Feature-based gating (free lessons vs paid), not time-based |
| Metered paywall (X free lessons/month) | Complex, confusing. Education content is consumed sequentially | Binary: lesson is free or paid. Simple |
| Ads on free tier | Damages brand credibility for B2B education | Subscription-only monetization |
| Pay-per-lesson (microtransactions) | Decision fatigue on every lesson. Low revenue per transaction | Subscription bundles only |
| DRM / download prevention | Kinescope already handles video protection | Trust Kinescope's built-in protection |

### Paywall UX Patterns and Benchmarks

**Confidence: MEDIUM** (from industry research, education platform benchmarks)

**Conversion benchmarks:**
- Freemium model: 2-5% conversion rate (median)
- Users who experience value before paywall: 30% more likely to convert
- Education apps: 3-7% free-to-paid
- Hard paywall: 12% conversion but requires strong brand recognition

**Recommended gating strategy for MAAL:**

```
FREE (always):
  - Landing page
  - Registration + profile
  - AI Diagnostic (full flow, unlimited retakes)
  - Radar chart results + skill profile
  - "My Track" recommendations (can see locked items)
  - 1-2 introductory lessons per course (with video + AI summary + chat)
  - Dashboard (shows progress on free content)

PAID (per-course subscription):
  - All lessons in one specific course
  - Full AI chat history for that course

PAID (full platform subscription):
  - All 6 courses, all 80+ lessons
  - Full AI chat across all content
  - Priority in future features
```

**Paywall trigger points (where to show upgrade CTA):**
1. **Lesson page** -- user clicks locked lesson, sees `LessonLocked` component
2. **Learn catalog** -- lock icons on paid lessons, "Unlock all" banner at top
3. **Diagnostic results** -- "Your weak areas: subscribe to access personalized learning"
4. **Dashboard** -- "X lessons available, unlock Y more"

---

## 4. TESTING TOGGLE (BILLING ON/OFF)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Feature flag for billing | Enable/disable billing without code deploy | Low | Env var `NEXT_PUBLIC_BILLING_ENABLED` or DB-backed flag in admin panel |
| Bypass paywall in dev mode | Developers need full content access | Low | `NODE_ENV === 'development'` bypasses all gating |
| Admin override | Admin users always have full access regardless of billing state | Low | Check `isAdmin` flag in subscription middleware |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Admin panel toggle | Non-developer can switch billing on/off from admin UI | Low | Add toggle to existing admin dashboard. Saves value in `SystemConfig` table |
| Per-user subscription override | Grant free access to specific users (employees, testers, partners) | Low | `Subscription` record with `type: 'manual'` and no payment reference |
| Gradual rollout (% of users) | A/B test paywall conversion before full launch | Medium | **Defer.** Start with global on/off toggle |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Compile-time feature flags | Requires rebuild + redeploy to change | Runtime flag (env var or DB) |
| Complex feature flag service (LaunchDarkly) | Over-engineering for a single toggle | Simple DB flag + admin UI |

---

## 5. SUBSCRIPTION MANAGEMENT IN PROFILE

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Current plan display | User must know what they're paying for | Low | Show plan name, price, next charge date |
| Cancel subscription button | Legal requirement + user expectation | Low | Calls CloudPayments cancel API. End-of-period cancellation (don't cut off mid-month) |
| Payment history | Receipts and past charges | Medium | Store webhook `Pay` events in `PaymentEvent` model. Display in profile |
| Next charge date | Transparency about upcoming billing | Low | From CloudPayments subscription data or cached in DB |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Plan upgrade/downgrade | Switch between per-course and full platform | Medium | Cancel old + create new subscription. No proration in v1 |
| Update payment method | Change card without cancelling | Low | CloudPayments widget can update card for existing subscription |
| Cancellation reason survey | Churn analytics, product improvement | Low | Simple dropdown on cancel confirmation modal |
| "Pause subscription" option | Reduce churn. User keeps intent to return | Low | Reschedule next charge date via CloudPayments API |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Self-service refunds | Financial risk, abuse potential | Manual refund via admin panel or CloudPayments dashboard |
| Automatic plan recommendations | Premature optimization, may feel pushy | Let users choose their plan |

---

## Feature Dependencies

```
AUTH track (independent):
  Yandex OAuth App Registration (external)
    -> Yandex Login Button + API Route
      -> Account Migration from Google (match by email)

BILLING track (independent, parallel with auth):
  CloudPayments Account Setup (external)
    -> Widget Integration (client-side)
    -> Webhook Handlers (server-side: Check, Pay, Fail, Recurrent, Cancel)
      -> Subscription + PaymentEvent DB models
        -> subscribedProcedure tRPC middleware

PAYWALL track (depends on BILLING):
  Free Lesson Marking (DB: isFreePreview flag)
    -> LessonLocked Component
    -> Paywall check in lesson page + AI endpoints
      -> Pricing Page with CloudPayments widget
        -> Subscription Status in Profile
          -> Cancel/Pause flow

TOGGLE track (standalone):
  BILLING_ENABLED env var or admin DB flag
    -> Admin panel toggle UI
```

**Critical path:** Auth and Billing are independent tracks that can be built in parallel. Paywall depends on working billing infrastructure.

---

## MVP Recommendation

### Phase A: Auth Rework (can start immediately)
1. Register app in Yandex OAuth (`oauth.yandex.ru/client/new`)
2. Build manual OAuth flow in API route (`/api/auth/yandex/*`)
3. Match Yandex users to existing accounts by email
4. Remove Google OAuth provider from Supabase dashboard
5. Test migration path with existing users

### Phase B: Billing Infrastructure (can start in parallel with Phase A)
1. Register CloudPayments account, get `pk_test_` and API keys
2. Add `Subscription`, `PaymentEvent` models to Prisma schema
3. Build webhook endpoints (Check, Pay, Fail, Recurrent, Cancel)
4. Build `subscribedProcedure` tRPC middleware
5. Start with platform-wide plan only (simpler than per-course)

### Phase C: Paywall + Content Gating (depends on Phase B)
1. Mark free lessons in DB (`isFreePreview` flag on Lesson model)
2. Build `LessonLocked` component with subscription CTA
3. Build pricing page with CloudPayments widget integration
4. Add paywall check to lesson page and AI endpoints
5. Add admin toggle for billing on/off (env var + admin panel)

### Phase D: Profile + Polish (depends on Phases B-C)
1. Subscription status display in profile
2. Cancel/pause subscription flow
3. Payment history display
4. Per-course subscription option (if demand exists)

### Defer to v1.3+:
- **Proration** on plan changes -- complex, low initial value
- **Team/corporate plans** -- needs admin panel extensions
- **SBP payments** -- secondary payment method, add when volume justifies
- **Dynamic free content rotation** -- nice but complex
- **Promo codes / discounts** -- needs PromoCode model, validation logic
- **Admin billing dashboard** -- use CloudPayments dashboard until volume justifies custom

---

## Sources

### Yandex ID OAuth
- [Yandex ID OAuth Documentation](https://yandex.com/dev/id/doc/en/) -- HIGH confidence
- [Yandex OAuth Implementation Guide](https://yandex.ru/dev/id/doc/en/concepts/ya-oauth-intro) -- HIGH confidence
- [Yandex User Information API](https://yandex.com/dev/id/doc/en/user-information) -- HIGH confidence
- [Auth.js Yandex Provider](https://authjs.dev/getting-started/providers/yandex) -- HIGH confidence (reference only, not recommended)
- [Yandex App Registration](https://yandex.com/dev/id/doc/en/register-client) -- HIGH confidence
- [Supabase Custom OAuth Providers Discussion](https://github.com/orgs/supabase/discussions/6547) -- MEDIUM confidence

### CloudPayments
- [CloudPayments Developer Documentation](https://developers.cloudpayments.ru/) -- HIGH confidence
- [CloudPayments English Docs](https://developers.cloudpayments.ru/en/) -- HIGH confidence
- [CloudPayments Widget Integration](https://cloudpayments.ru/integration/widget) -- HIGH confidence
- [CloudPayments Recurring Payments](https://cloudpayments.ru/features/recurrent) -- HIGH confidence
- [CloudPayments Subscriptions Service](https://cloudpayments.ru/subscriptions) -- HIGH confidence
- [CloudPayments EdTech Solutions](https://cloudpayments.ru/edtech/) -- MEDIUM confidence
- [CloudPayments 54-FZ Cloud Receipts](https://cloudpayments.ru/cloud-cheki) -- MEDIUM confidence
- [CloudPayments Node.js Package (npm)](https://www.npmjs.com/package/cloudpayments) -- MEDIUM confidence
- [CloudPayments Node.js Client (GitHub)](https://github.com/izatop/cloudpayments) -- MEDIUM confidence

### Paywall Patterns
- [E-learning Paywall Patterns (Poool)](https://blog.poool.fr/paywalls-for-e-learning-and-online-course-platforms/) -- MEDIUM confidence
- [Education App Paywalls (Purchasely)](https://www.purchasely.com/blog/education-app-paywalls) -- MEDIUM confidence
- [State of Subscription Apps 2025 (RevenueCat)](https://www.revenuecat.com/state-of-subscription-apps-2025/) -- MEDIUM confidence
- [Strategic Paywall Placement (Foundational Edge)](https://foundationaledge.com/strategic-paywalls-where-and-when-to-gate-your-saas-features/) -- MEDIUM confidence
- [Freemium Conversion Rate Guide (Userpilot)](https://userpilot.com/blog/freemium-conversion-rate/) -- MEDIUM confidence
- [Paywall UX Design Patterns (Refero)](https://refero.design/p/paywall-examples/) -- MEDIUM confidence

---
*Feature research for: MAAL v1.2 -- Auth Rework + Billing*
*Researched: 2026-03-06*
