# Phase 22: Transactional Email Notifications - Research

**Researched:** 2026-03-13
**Domain:** Transactional email (Carrot Quest API), Supabase Auth email hooks, in-app toast notifications
**Confidence:** MEDIUM

## Summary

Phase 22 integrates Carrot Quest (CQ) as the sole email provider for 9 types of transactional emails across billing, auth, and system domains. The phase has two distinct deliverables: (1) EMAIL-SPEC.md -- a specification document with email drafts, variables, and flows for the email design team, and (2) technical integration of CQ REST API from server code + Supabase Send Email Hook for auth emails + toast notifications in UI.

The Carrot Quest REST API (`https://api.carrotquest.io`) provides `POST /users/{id}/sendmessage` for sending messages to identified users. Auth via `Authorization: Token {api_key}`. Users are identified by internal CQ ID or synced via `user_id` (external app ID). The recommended architecture: create a thin CQ API client (`apps/web/src/lib/carrotquest/`), sync users on registration, and call CQ from existing webhook handlers and auth actions. For Supabase auth emails (confirm, reset), use the **Send Email Hook** (HTTP endpoint) which completely replaces Supabase's built-in email sending and forwards to CQ API.

**Primary recommendation:** Use Supabase Send Email Hook (HTTP endpoint pointing at a Next.js API route) to intercept auth emails and forward to CQ. Use `sonner` (shadcn/ui standard) for toast notifications. Scheduled emails (inactivity chain, expiry reminder) via GitHub Actions cron calling a Next.js API route (same pattern as supabase-keepalive).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Carrot Quest** -- single email provider for all platform emails
- Integration through CQ REST API from server code (not CQ automations)
- Email templates designed by email team in Carrot Quest dashboard
- Credentials (CQ API key) stored in `.env` / `.env.production`
- 9 email types: 4 billing + 5 auth/system (see full list in CONTEXT.md)
- EMAIL-SPEC.md is first deliverable, prepared BEFORE technical integration
- EMAIL-SPEC.md also exported as Google Doc on zebrosha@gmail.com
- Tone: business + friendly, "you" formal, SaaS-style
- Supabase auth emails (confirm, reset) migrated to CQ for unified branding

### Claude's Discretion
- Supabase auth emails: custom SMTP relay via CQ vs disabling Supabase mailer + own flow via CQ API
- Email sender address
- "Expiring soon" interval (days before period end)
- Toast component choice (existing or sonner/react-hot-toast)
- CQ API client structure (packages/notifications/ or lib/carrotquest/)

### Deferred Ideas (OUT OF SCOPE)
- Notification center (bell icon) with history
- Browser push notifications (Web Push API)
- Telegram notifications
- Email analytics (open rate, click rate, unsubscribe tracking)
- User notification preferences/settings
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Carrot Quest REST API | v1 | Send transactional emails to users | Locked decision from owner |
| sonner | ^2.0 | Toast notifications in UI | shadcn/ui standard, replaces deprecated toast component |
| Supabase Send Email Hook | - | Intercept auth emails (confirm, reset) | Official Supabase mechanism for custom email providers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons for toast notifications | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Send Email Hook | Custom SMTP relay | SMTP relay still sends from Supabase templates; Hook gives full control over email content and routing |
| sonner | react-hot-toast | sonner is shadcn/ui blessed, simpler API, better defaults |
| GitHub Actions cron | Next.js cron (Vercel) | Project deploys on VPS via Docker, not Vercel; GH Actions cron already proven |

**Installation:**
```bash
cd apps/web && pnpm add sonner
```

## Architecture Patterns

### Recommended Structure
```
apps/web/src/
├── lib/
│   └── carrotquest/
│       ├── client.ts          # CQ API client (fetch wrapper)
│       ├── types.ts           # CQ API types
│       └── emails.ts          # Email-specific helpers (sendWelcome, sendPaymentSuccess, etc.)
├── app/
│   └── api/
│       ├── webhooks/
│       │   └── supabase-email/
│       │       └── route.ts   # Send Email Hook endpoint
│       └── cron/
│           └── email-scheduler/
│               └── route.ts   # Scheduled emails (inactivity, expiry)
├── components/
│   └── ui/
│       └── sonner.tsx         # Toaster provider (shadcn pattern)
docs/
└── EMAIL-SPEC.md              # Email specification for design team
```

### Pattern 1: CQ API Client
**What:** Thin fetch wrapper around Carrot Quest REST API
**When to use:** Every email send operation
**Example:**
```typescript
// apps/web/src/lib/carrotquest/client.ts
const CQ_BASE = 'https://api.carrotquest.io/v1';

export class CarrotQuestClient {
  constructor(private apiKey: string) {}

  private async request(path: string, body: Record<string, unknown>) {
    const res = await fetch(`${CQ_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[CarrotQuest] ${path} failed:`, await res.text());
    }
    return res;
  }

  /** Send message to user by CQ user ID */
  async sendMessage(userId: string, body: string, type: string = 'email', subject?: string) {
    return this.request(`/users/${userId}/sendmessage`, {
      body, type, subject,
    });
  }

  /** Set user properties (for syncing on registration) */
  async setUserProps(userId: string, props: Record<string, unknown>) {
    return this.request(`/users/${userId}/props`, { operations: props });
  }

  /** Track event for user (alternative trigger mechanism) */
  async trackEvent(userId: string, event: string, params?: Record<string, unknown>) {
    return this.request(`/users/${userId}/events`, { event, params });
  }
}

export const cq = new CarrotQuestClient(process.env.CARROTQUEST_API_KEY!);
```

### Pattern 2: Supabase Send Email Hook
**What:** HTTP endpoint that Supabase calls instead of sending its own emails
**When to use:** For email confirmation and password reset (replacing Supabase built-in)
**Example:**
```typescript
// apps/web/src/app/api/webhooks/supabase-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cq } from '@/lib/carrotquest/client';

export async function POST(request: NextRequest) {
  // Verify hook secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SUPABASE_HOOK_SECRET}`) {
    return NextResponse.json({}, { status: 401 });
  }

  const payload = await request.json();
  const { user, email_data } = payload;
  const { email_action_type, token_hash, redirect_to, site_url } = email_data;

  // Build confirmation URL same as Supabase would
  const confirmUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

  switch (email_action_type) {
    case 'signup':
      await sendEmailConfirmation(user.email, confirmUrl);
      break;
    case 'recovery':
      await sendPasswordReset(user.email, confirmUrl);
      break;
    case 'email_change':
      await sendEmailChange(user.email, confirmUrl);
      break;
  }

  return NextResponse.json({});
}
```

### Pattern 3: Fire-and-Forget Email from Webhook Handlers
**What:** Add CQ API calls to existing subscription-service.ts functions
**When to use:** Billing events (payment success, failure, cancellation)
**Example:**
```typescript
// In subscription-service.ts, after subscription update:
export async function handlePaymentSuccess(...) {
  // ... existing logic ...
  // Fire-and-forget email (non-blocking, errors logged not thrown)
  sendPaymentSuccessEmail(subscription.userId, {
    amount: payment.amount,
    courseName: subscription.course?.title,
    periodEnd: periodEnd,
  }).catch(err => console.error('[Email] Payment success email failed:', err));
}
```

### Anti-Patterns to Avoid
- **Blocking on email send:** Never await CQ API in webhook response path. Use fire-and-forget pattern. CQ API failure should never break billing flow.
- **Storing CQ user IDs in our DB:** Avoid adding a `carrotQuestId` column. Use CQ's `user_id` property (set to our Supabase user ID) for identification via API.
- **Building email templates in code:** Templates are designed by the email team in CQ dashboard. Code only triggers sends with variables.
- **Using CQ automations instead of API:** Decision locked -- platform code controls when emails are sent, not CQ trigger rules.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom div + setTimeout | sonner via shadcn/ui | Accessibility, animations, stacking, mobile swipe |
| Auth email interception | Manual Supabase email disable + custom auth flow | Send Email Hook | Official mechanism, receives all auth context (token, redirect_to) |
| Scheduled email jobs | Custom timer service or node-cron | GitHub Actions cron + API route | Already proven pattern (supabase-keepalive), zero infra cost |
| Email template rendering | Server-side HTML generation | CQ template engine | Email team manages templates in CQ dashboard |

**Key insight:** The platform's role is purely to trigger emails with data. Template design, rendering, and delivery are CQ's responsibility. Keep the integration surface minimal.

## Common Pitfalls

### Pitfall 1: CQ User Sync Timing
**What goes wrong:** Email sent to user who doesn't exist in CQ yet (registered 1 second ago)
**Why it happens:** CQ user creation is async; if welcome email fires before user sync completes, CQ returns 404
**How to avoid:** Sync user to CQ first (set `$email`, `$name` properties), then send welcome email. Do both in sequence in the signUp flow.
**Warning signs:** 404 errors from CQ API on welcome emails

### Pitfall 2: Supabase Send Email Hook Security
**What goes wrong:** Anyone can call the hook endpoint and trigger email sends
**Why it happens:** Hook endpoint is a public API route
**How to avoid:** Verify the hook secret in the Authorization header. Set the secret in Supabase Dashboard > Auth > Hooks configuration.
**Warning signs:** Unexpected email sends, abuse of the endpoint

### Pitfall 3: Fire-and-Forget Error Silence
**What goes wrong:** Email failures go unnoticed for days/weeks
**Why it happens:** `.catch(console.error)` is easy to miss in logs
**How to avoid:** Add structured logging with `[Email]` prefix (consistent with existing `[Subscription]` and `[CloudPayments]` patterns). Consider a feature flag `email_notifications_enabled` for kill switch.
**Warning signs:** Users complaining about missing emails with no errors in monitoring

### Pitfall 4: NEXT_PUBLIC vs Server-Side ENV
**What goes wrong:** CQ API key exposed in client bundle
**Why it happens:** Using `NEXT_PUBLIC_CARROTQUEST_API_KEY` by mistake
**How to avoid:** CQ API key must be server-only: `CARROTQUEST_API_KEY` (no NEXT_PUBLIC_ prefix). All CQ calls happen in API routes and server actions only.
**Warning signs:** API key visible in browser Network tab

### Pitfall 5: Scheduled Cron Auth
**What goes wrong:** GitHub Actions cron can't call the API route on VPS
**Why it happens:** VPS API route needs auth or at least a secret token to prevent abuse
**How to avoid:** Use a shared `CRON_SECRET` env var; GH Actions sends it as Bearer token; API route verifies.
**Warning signs:** 401 errors in GH Actions logs

### Pitfall 6: Docker ARG for New ENV Vars
**What goes wrong:** New env vars not available at runtime in Docker
**Why it happens:** Same issue as CloudPayments -- Docker needs ARGs in Dockerfile for build-time vars
**How to avoid:** `CARROTQUEST_API_KEY` is server-side only, so it works via `env_file` in docker-compose (runtime). No Dockerfile ARG needed. But verify this.
**Warning signs:** Empty `process.env.CARROTQUEST_API_KEY` in container

## Code Examples

### Sonner Toast Setup (shadcn/ui pattern)
```typescript
// apps/web/src/components/ui/sonner.tsx
"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-white group-[.toaster]:text-gray-950 group-[.toaster]:border-gray-200 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-gray-500",
          actionButton: "group-[.toast]:bg-mp-blue-500 group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
```

### Using Toast in Payment Flow
```typescript
// In a client component after successful payment:
import { toast } from 'sonner';

// After CloudPayments widget success callback:
toast.success('Оплата прошла успешно', {
  description: 'Подписка активирована. Доступ к урокам открыт.',
});

// After subscription cancellation:
toast('Подписка отменена', {
  description: `Доступ сохраняется до ${formatDate(currentPeriodEnd)}`,
});
```

### Email Helper Functions
```typescript
// apps/web/src/lib/carrotquest/emails.ts
import { cq } from './client';

// Carrot Quest identifies users by their CQ internal ID.
// We use trackEvent approach: send event with data, CQ triggers configured template.
// Alternative: direct sendMessage if CQ supports template-based sending.

export async function sendPaymentSuccessEmail(userId: string, data: {
  amount: number;
  courseName?: string;
  periodEnd: Date;
}) {
  // Option A: Track event (CQ triggers email template based on event)
  await cq.trackEvent(userId, '$payment_success', {
    amount: data.amount,
    course_name: data.courseName ?? 'Полный доступ',
    period_end: data.periodEnd.toISOString(),
  });
}

export async function sendWelcomeEmail(userId: string, data: {
  name: string;
  email: string;
}) {
  await cq.trackEvent(userId, '$user_registered', {
    name: data.name,
    email: data.email,
  });
}
```

## Decisions (Claude's Discretion)

### 1. Supabase Auth Emails: Send Email Hook (not SMTP relay)
**Recommendation:** Use Supabase Send Email Hook (HTTP endpoint).

**Rationale:**
- Custom SMTP relay still sends Supabase's built-in HTML templates -- you can customize them in the dashboard, but they won't match CQ's branded templates
- Send Email Hook completely bypasses Supabase email rendering -- your endpoint receives the raw token/type/redirect data and forwards to CQ
- Hook is configured in Supabase Dashboard > Auth > Hooks > Send Email, pointing to `https://platform.mpstats.academy/api/webhooks/supabase-email`
- This gives full control: CQ handles rendering with the same branded templates as all other platform emails

**Confidence:** HIGH (official Supabase feature, well-documented)

### 2. Toast Component: sonner
**Recommendation:** Use `sonner` via `npx shadcn@latest add sonner`.

**Rationale:**
- shadcn/ui's old Toast component is deprecated in favor of sonner
- Project already uses shadcn/ui for all UI components
- sonner has excellent defaults: accessible, mobile-friendly, stacking, promise integration
- Zero config beyond adding `<Toaster />` to root layout

**Confidence:** HIGH

### 3. CQ Client Location: `apps/web/src/lib/carrotquest/`
**Recommendation:** Place in `lib/carrotquest/` (not a separate package).

**Rationale:**
- CQ is only called from server-side code within the web app (API routes, server actions, webhook handlers)
- No other package needs CQ access
- Follows existing patterns: `lib/cloudpayments/`, `lib/supabase/`, `lib/auth/`
- If needed later, easy to extract to `packages/notifications/`

**Confidence:** HIGH

### 4. "Expiring Soon" Interval: 3 days before period end
**Recommendation:** Send reminder 3 days before `currentPeriodEnd` for CANCELLED subscriptions.

**Rationale:**
- 3 days gives user enough time to re-subscribe without being annoying
- Only for CANCELLED subscriptions (users who explicitly cancelled)
- ACTIVE subscriptions auto-renew, no reminder needed

**Confidence:** MEDIUM (product decision, may need adjustment)

### 5. Email Sender Address: noreply@mpstats.academy
**Recommendation:** `noreply@mpstats.academy` with sender name "MPSTATS Academy".

**Rationale:**
- Domain matches the platform URL
- CQ dashboard and DNS (SPF/DKIM) configuration needed by owner
- "noreply" is standard for transactional emails

**Confidence:** LOW (depends on DNS/CQ configuration by owner)

## CQ API Integration: Two Approaches

### Approach A: Event-Based (Recommended)
Track custom events via `POST /users/{id}/events`, then configure CQ triggered messages in dashboard to send email templates on those events.

**Pros:** Template changes don't require code deploy. Email team configures triggers in CQ dashboard.
**Cons:** Requires CQ dashboard setup for each event-to-template mapping.

**Events to track:**
| Event Name | Trigger Point | Variables |
|------------|--------------|-----------|
| `$payment_success` | webhook pay | amount, course_name, period_end |
| `$payment_failed` | webhook fail | - |
| `$subscription_cancelled` | webhook cancel / tRPC cancel | access_until |
| `$user_registered` | signUp action | name, email |
| `$diagnostic_completed` | diagnostic results | scores, recommended_path |

### Approach B: Direct sendMessage
Use `POST /users/{id}/sendmessage` with pre-built HTML body.

**Pros:** No CQ dashboard trigger configuration needed.
**Cons:** HTML templates in code = no design team control. Defeats the purpose.

**Verdict:** Use Approach A (event-based). The email team designs templates in CQ, maps them to events. Code only tracks events with variables.

## Scheduled Emails Architecture

### Inactivity Chain (7/14/30 days)
```
GitHub Actions cron (daily) → POST /api/cron/email-scheduler
  → Query users with no LessonProgress update in 7/14/30 days
  → Track CQ event: $inactive_7d / $inactive_14d / $inactive_30d
  → CQ sends configured template
```

### Expiring Soon (3 days before period end)
```
GitHub Actions cron (daily) → POST /api/cron/email-scheduler
  → Query CANCELLED subscriptions where currentPeriodEnd - 3 days = today
  → Track CQ event: $subscription_expiring
  → CQ sends configured template
```

**Auth:** Shared `CRON_SECRET` in GH secrets and `.env.production`. API route validates `Authorization: Bearer ${CRON_SECRET}`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase built-in emails | Send Email Hook | Supabase 2024 | Full control over auth email content and delivery |
| shadcn/ui Toast | sonner (shadcn wrapper) | 2024 | Simpler API, better accessibility |
| Self-hosted email (Nodemailer) | SaaS email providers (CQ, Resend, etc.) | Industry trend | No SMTP maintenance, better deliverability |

## Open Questions

1. **CQ API `sendmessage` exact parameters for email type**
   - What we know: Endpoint exists at `POST /users/{id}/sendmessage`, PHP wrappers reference `type` and `body` params
   - What's unclear: Exact parameter names for email subject, whether template IDs can be passed, how email type is specified
   - Recommendation: Owner obtains CQ API key, we test the endpoint. Event-based approach (Approach A) sidesteps this by using triggered messages instead of direct sends.

2. **CQ User Identification**
   - What we know: CQ uses internal IDs. External `user_id` can be set for cross-reference.
   - What's unclear: Whether we can use `user_id` directly in API calls or must first resolve to CQ internal ID
   - Recommendation: On user registration, create CQ user with `user_id` = Supabase user ID and `$email` property. Use CQ internal ID for subsequent API calls. Test during implementation.

3. **CQ SMTP for Supabase**
   - What we know: CQ may or may not offer SMTP relay credentials
   - What's unclear: Whether CQ has SMTP endpoint that Supabase could use as custom SMTP
   - Recommendation: Irrelevant since we chose Send Email Hook approach (bypasses SMTP entirely)

4. **Google Doc Export**
   - What we know: EMAIL-SPEC.md must also be a Google Doc on zebrosha@gmail.com
   - What's unclear: Whether automated export is expected or manual copy-paste is fine
   - Recommendation: Manual copy-paste. Automating Google Docs creation requires OAuth + Google Docs API, massive overkill for a one-time document.

## Sources

### Primary (HIGH confidence)
- [Supabase Send Email Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) - Hook payload structure, configuration
- [Supabase Custom SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp) - SMTP alternative, rate limits
- [Supabase Email Templates docs](https://supabase.com/docs/guides/auth/auth-email-templates) - Template variables
- [shadcn/ui Sonner docs](https://ui.shadcn.com/docs/components/radix/sonner) - Toast component setup

### Secondary (MEDIUM confidence)
- [Carrot Quest Web API](https://developers.carrotquest.io/webapi/) - Base URL, auth method, endpoint structure
- [Carrot Quest Web API Endpoints](https://developers.carrotquest.io/webapi/endpoints/) - sendmessage, user props, events endpoints
- [Carrot Quest User Object](https://developers.carrotquest.io/objects/user/) - User ID, user_id, properties structure
- [Carrot Quest Web API Auth](https://developers.carrotquest.io/webapi/auth/) - Token-based auth

### Tertiary (LOW confidence)
- [veksa/carrot-api PHP wrapper](https://github.com/veksa/carrot-api) - sendMessage method signature (limited detail)
- [Carrot Quest Help: Triggered Email](https://help.carrotquest.io/article/191) - Triggered messages concept (page 404'd but concept confirmed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sonner and Supabase hooks are well-documented, CQ API structure is known
- Architecture: MEDIUM - CQ API exact parameters need validation during implementation
- Pitfalls: HIGH - based on real patterns from existing CloudPayments integration in this project
- CQ specifics: LOW - API documentation is sparse online; exact sendmessage parameters unverified

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (CQ API is stable, Supabase hooks are GA)
