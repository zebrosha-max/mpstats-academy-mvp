# Phase 19: Billing UI + Payment Flow - Research

**Researched:** 2026-03-11
**Domain:** CloudPayments widget integration, billing UI, subscription management
**Confidence:** HIGH

## Summary

Phase 19 builds the user-facing billing experience: pricing page, CloudPayments Checkout popup for payment, subscription management in profile, and navigation updates. The backend foundation (Prisma models, webhook handlers, feature flags) is fully built in Phases 16-18. This phase is primarily frontend + a new billing tRPC router + one Prisma schema migration (adding PENDING to SubscriptionStatus).

CloudPayments Checkout widget (`checkout.cloudpayments.ru/bundles/checkout`) opens as a popup overlay — no PCI DSS needed. The widget handles card input, 3DS, and returns callbacks (onSuccess/onFail/onComplete). Our server creates Subscription(PENDING) + Payment(PENDING) before opening the widget, passes subscriptionId as InvoiceId and userId as AccountId. The "pay" webhook from Phase 18 transitions PENDING -> ACTIVE.

For subscription cancellation, our server calls CloudPayments API `POST https://api.cloudpayments.ru/subscriptions/cancel` with HTTP Basic Auth (PublicId:ApiSecret). CloudPayments then sends a "cancel" webhook which Phase 18's handleCancellation processes.

**Primary recommendation:** Create a dedicated `billing` tRPC router with endpoints for plans, subscription status, payment initiation, and cancellation. Keep CloudPayments JS SDK loading lazy (dynamic import or Script component). Use existing Card/Badge/Button components for pricing page.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Страница тарифов (/pricing): две карточки рядом (COURSE 2990 руб/мес, PLATFORM 4990 руб/мес), публичная страница
- При выборе "Один курс" — select/dropdown со списком 6 курсов на /pricing
- CloudPayments Checkout popup (JS SDK checkout.cloudpayments.ru)
- Перед popup: tRPC endpoint создает Subscription(PENDING) + Payment(PENDING)
- InvoiceId = subscriptionId, AccountId = userId
- Добавить PENDING в enum SubscriptionStatus (Prisma миграция)
- Подписка в профиле: Card секция под "Личные данные", статус, дата списания, отмена, история 5-10 платежей
- Отмена через CloudPayments API (POST /subscriptions/cancel)
- Пункт "Тарифы" в sidebar при billing_enabled=true
- При billing_enabled=false: скрыть sidebar пункт, скрыть секцию профиля, /pricing -> redirect на главную
- Цены из DB (SubscriptionPlan модель)
- Обновление цен: COURSE = 2990, PLATFORM = 4990 (обновить seed)

### Claude's Discretion
- Success-экран после оплаты (страница vs toast)
- Размещение кнопки "Купить курс" на странице курса (баннер сверху vs inline)
- Ссылка "Тарифы" в header лендинга — позиция и стиль
- Точная иконка для sidebar пункта "Тарифы"
- UX при одновременной COURSE и PLATFORM подписке (апгрейд flow)

### Deferred Ideas (OUT OF SCOPE)
- Диагностика при подписке на 1 курс — Phase 20
- Уведомления о событиях подписки (email) — отдельная фаза
- Admin-страница для платежей — отдельная фаза
- Промокоды и скидки (BILL-08) — v1.3
- Trial period (BILL-09) — v1.3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | CloudPayments widget интегрирован (iframe-виджет, PCI DSS не нужен) | CloudPayments Checkout popup JS SDK: `widget.charge()` с recurrent config. Script: `checkout.cloudpayments.ru/bundles/checkout` |
| BILL-05 | Управление подпиской в профиле (статус, следующее списание, отмена) | tRPC billing router с getSubscription + cancelSubscription. Cancel via CP API POST /subscriptions/cancel |
| PAY-02 | Страница тарифов с планами подписки и CTA | /pricing public page, SubscriptionPlan из DB, Card+Badge+Button компоненты |
| PAY-04 | Два режима подписки — per-course (Режим A) и full platform (Режим B) | COURSE plan с courseId select, PLATFORM plan без courseId. Оба через один widget.charge() flow |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CloudPayments Checkout JS | latest (CDN) | Payment popup widget | Official CP SDK, PCI DSS compliant |
| next/script | built-in | Lazy load CP script | Next.js standard for third-party scripts |
| tRPC 11.x | existing | Billing API endpoints | Project standard |
| Prisma 5.x | existing | DB queries for plans/subscriptions | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Card | existing | Pricing cards, profile subscription card | All billing UI sections |
| shadcn/ui Badge | existing | "Ваш план", "Активна", status badges | Subscription status display |
| lucide-react | existing (via shadcn) | CreditCard icon for sidebar | Navigation icon |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CP Checkout popup | CP iframe embed | Popup is simpler, no page layout changes |
| Dedicated /pricing page | Modal on /learn | User decision: dedicated public page |
| tRPC billing router | Extend profile router | Separate router is cleaner, billing is complex domain |

**No new npm packages needed.** CloudPayments JS loads from CDN via `<Script>` tag.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── app/
│   ├── pricing/                    # Public page (outside (main) layout)
│   │   └── page.tsx                # Pricing cards + CP widget trigger
│   └── (main)/
│       └── profile/
│           └── page.tsx            # Add subscription section
├── components/
│   └── billing/
│       ├── PricingCard.tsx         # Single plan card
│       ├── SubscriptionSection.tsx # Profile subscription management
│       └── PaymentHistory.tsx      # Payment history table
└── lib/
    └── cloudpayments/
        ├── widget.ts               # CP widget wrapper (type-safe)
        └── cancel-api.ts           # Server-side cancel API call

packages/api/src/routers/
└── billing.ts                      # New tRPC router
```

### Pattern 1: CloudPayments Widget Integration
**What:** Load CP Checkout script lazily, expose type-safe wrapper for `widget.charge()`
**When to use:** Any payment initiation flow
**Example:**
```typescript
// apps/web/src/lib/cloudpayments/widget.ts
declare global {
  interface Window {
    cp?: {
      CloudPayments: new () => {
        charge: (
          options: CPChargeOptions,
          onSuccess: (options: string) => void,
          onFail: (reason: string, options: string) => void,
          onComplete: (paymentResult: string, options: string) => void,
        ) => void;
      };
    };
  }
}

export interface CPChargeOptions {
  publicId: string;
  description: string;
  amount: number;
  currency: string;
  accountId: string;  // userId
  invoiceId: string;  // subscriptionId
  data?: {
    cloudPayments?: {
      recurrent?: {
        interval: 'Day' | 'Week' | 'Month';
        period: number;
      };
    };
  };
}

export function openPaymentWidget(options: CPChargeOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!window.cp) {
      console.error('CloudPayments script not loaded');
      resolve(false);
      return;
    }
    const widget = new window.cp.CloudPayments();
    widget.charge(
      options,
      () => resolve(true),   // onSuccess
      () => resolve(false),  // onFail
      () => {},              // onComplete
    );
  });
}
```

### Pattern 2: Pre-payment DB Record Creation
**What:** Create Subscription(PENDING) + Payment(PENDING) before opening widget
**When to use:** Every payment initiation
**Example:**
```typescript
// billing router: initiatePayment procedure
const subscription = await ctx.prisma.subscription.create({
  data: {
    userId: ctx.user.id,
    planId: plan.id,
    courseId: input.courseId ?? null,
    status: 'PENDING',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(), // placeholder, updated by webhook
  },
});

const payment = await ctx.prisma.payment.create({
  data: {
    subscriptionId: subscription.id,
    amount: plan.price,
    status: 'PENDING',
  },
});

return { subscriptionId: subscription.id, amount: plan.price };
```

### Pattern 3: Feature Flag Conditional Rendering
**What:** Hide billing UI when billing_enabled=false
**When to use:** Sidebar, profile, /pricing redirect
**Example:**
```typescript
// In billing router - check feature flag
const billingEnabled = await isFeatureEnabled('billing_enabled');
if (!billingEnabled) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing is not enabled' });
}

// In sidebar (client) - fetch flag via tRPC
const { data: billingEnabled } = trpc.billing.isEnabled.useQuery();
// Conditionally render "Тарифы" nav item
```

### Pattern 4: Server-Side Cancel via CloudPayments API
**What:** Cancel subscription by calling CP API from our server
**When to use:** User clicks "Отменить подписку"
**Example:**
```typescript
// apps/web/src/lib/cloudpayments/cancel-api.ts
export async function cancelCloudPaymentsSubscription(
  subscriptionId: string,
): Promise<boolean> {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID!;
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET!;
  const auth = Buffer.from(`${publicId}:${apiSecret}`).toString('base64');

  const response = await fetch('https://api.cloudpayments.ru/subscriptions/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ Id: subscriptionId }),
  });

  const result = await response.json();
  return result.Success === true;
}
```

**Note:** The cancel API needs the CloudPayments subscription ID. Since we use InvoiceId=subscriptionId, CloudPayments creates its own internal subscription ID on the "recurrent" event. We may need to store the CP subscription token/ID from the recurrent webhook. This is a potential gap -- see Open Questions.

### Anti-Patterns to Avoid
- **Loading CP script globally:** Use `next/script` with `strategy="lazyOnload"` only on pages that need it (/pricing, /profile)
- **Storing card data:** Never. CP widget handles everything.
- **Calling CP cancel API from client:** Server-only. API secret must not be exposed.
- **Skipping PENDING state:** Always create DB records before opening widget to avoid orphaned payments.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment form | Card input fields | CloudPayments Checkout popup | PCI DSS compliance, fraud protection |
| Subscription state machine | Custom status transitions | Phase 18 handlers (handlePaymentSuccess, etc.) | Already built, tested logic |
| Feature flag checking | Manual DB queries | `isFeatureEnabled()` utility | Already exists in `packages/api/src/utils/feature-flags.ts` |
| Price formatting | String concatenation | `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })` | Correct locale formatting |

## Common Pitfalls

### Pitfall 1: PENDING Subscriptions Accumulating
**What goes wrong:** User opens widget but abandons payment. PENDING subscriptions pile up in DB.
**Why it happens:** Widget callback fires onFail but we can't reliably clean up (user may close tab).
**How to avoid:** Either: (a) cleanup PENDING subscriptions older than 1 hour via a cron/scheduled task, or (b) accept the clutter and filter by status in queries. For MVP, option (b) is fine -- always filter by status IN ('ACTIVE', 'PAST_DUE') for active subscriptions.
**Warning signs:** Queries returning unexpected subscription counts.

### Pitfall 2: CloudPayments Script Not Loaded
**What goes wrong:** User clicks "Оформить" but window.cp is undefined.
**Why it happens:** Script loaded with lazyOnload, user clicked before script finished loading.
**How to avoid:** Check `window.cp` existence before calling, show loading state if not ready. Use `onReady` callback from next/script.
**Warning signs:** Console errors about undefined cp object.

### Pitfall 3: Pricing Page Outside Auth Layout
**What goes wrong:** /pricing should be public but still show user state (current plan badge).
**Why it happens:** Page is outside (main) layout, no sidebar/auth context by default.
**How to avoid:** Use optional auth check -- try to get user session, show personalized content if logged in, generic content if not. Use `supabase.auth.getUser()` in a client component with graceful fallback.
**Warning signs:** Logged-in user sees generic pricing without "Ваш план" badge.

### Pitfall 4: CloudPayments Cancel API vs Our Cancel
**What goes wrong:** Confusion between CloudPayments internal subscription ID and our Subscription.id.
**Why it happens:** CP creates its own subscription record on "recurrent" events. Cancel API needs CP's ID, not ours.
**How to avoid:** Store the CloudPayments Token (from recurrent webhook payload) on our Subscription model, use it for cancel API calls. OR: use a simpler approach -- call cancel on CP's side using their subscription management endpoint with AccountId.
**Warning signs:** Cancel API returning "subscription not found."

### Pitfall 5: Race Condition Between Widget Callback and Webhook
**What goes wrong:** Widget onSuccess fires before webhook arrives. Frontend shows "success" but subscription is still PENDING.
**Why it happens:** Webhook delivery has latency (typically 1-5 seconds).
**How to avoid:** After onSuccess callback, poll or wait briefly then redirect to profile. Don't rely on instant status change. Show optimistic "Оплата принята, подписка активируется..." message.
**Warning signs:** User sees "Подписка: Ожидание" right after successful payment.

## Code Examples

### CloudPayments Script Loading (Next.js)
```typescript
// In pricing/page.tsx or a layout
import Script from 'next/script';

<Script
  src="https://widget.cloudpayments.ru/bundles/checkout"
  strategy="lazyOnload"
  onReady={() => setWidgetReady(true)}
/>
```

### Billing Router Structure
```typescript
// packages/api/src/routers/billing.ts
export const billingRouter = router({
  // Public: check if billing is enabled
  isEnabled: publicProcedure.query(async ({ ctx }) => {
    return isFeatureEnabled('billing_enabled');
  }),

  // Public: get available plans
  getPlans: publicProcedure.query(async ({ ctx }) => {
    const enabled = await isFeatureEnabled('billing_enabled');
    if (!enabled) return [];
    return ctx.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }),

  // Protected: get user's active subscription
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.subscription.findFirst({
      where: {
        userId: ctx.user.id,
        status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] },
      },
      include: { plan: true, course: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  // Protected: initiate payment (create PENDING records)
  initiatePayment: protectedProcedure
    .input(z.object({
      planType: z.enum(['COURSE', 'PLATFORM']),
      courseId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate, create Subscription(PENDING) + Payment(PENDING)
      // Return { subscriptionId, amount, planName }
    }),

  // Protected: get payment history
  getPaymentHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.payment.findMany({
        where: { subscription: { userId: ctx.user.id } },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: { subscription: { include: { plan: true } } },
      });
    }),

  // Protected: cancel subscription
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    // Find active subscription, call CP cancel API, update local status
  }),
});
```

### Price Formatting Utility
```typescript
export function formatPrice(rubles: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(rubles);
}
// formatPrice(2990) => "2 990 RUB" (or similar locale format)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CP separate URLs per event | Single catch-all webhook route (Phase 18) | Phase 18 decision | Widget config uses single webhook URL |
| In-memory mock data | Real Prisma models | Phase 16 | Plans/subscriptions in PostgreSQL |

**Deprecated/outdated:**
- seed-billing.ts has COURSE price = 4990 but CONTEXT.md says 2990. Must update seed.

## Open Questions

1. **CloudPayments Cancel API: which ID to use?**
   - What we know: CP cancel API needs the CP-internal subscription ID, not our DB subscription ID
   - What's unclear: Whether the recurrent webhook payload contains a CP subscription ID that we should store
   - Recommendation: Check CP webhook payload `Token` field. If it contains the CP subscription ID, add a `cloudPaymentsToken` field to our Subscription model. Alternatively, use CP's `accountId`-based lookup if available. For MVP, we can also direct users to `https://my.cloudpayments.ru/unsubscribe` as a fallback.

2. **Widget recurrent configuration**
   - What we know: `data.cloudPayments.recurrent` with `interval: 'Month', period: 1` enables recurring
   - What's unclear: Whether CP creates the recurrent automatically or we need to call a separate API
   - Recommendation: Based on CP docs, passing recurrent config in widget.charge() auto-creates the subscription on CP side. Verify in sandbox.

3. **Pricing page routing: public vs (main) layout**
   - What we know: /pricing is public (no auth required) but should show personalized state for logged-in users
   - What's unclear: Whether to put it under root layout or create a hybrid layout
   - Recommendation: Place under `app/pricing/page.tsx` (root, outside (main)), add its own minimal header. Use optional session check for personalization.

## Sources

### Primary (HIGH confidence)
- CloudPayments Developer Docs (https://developers.cloudpayments.ru/en/) - Checkout widget API, recurrent config, cancel API
- Project codebase - Phase 18 webhook route, subscription-service.ts, types.ts, schema.prisma

### Secondary (MEDIUM confidence)
- CloudPayments Widget page (https://cloudpayments.ru/integration/widget) - Widget features overview
- CloudPayments Checkout docs (https://cloudpayments.ru/Docs/Checkout) - Checkout script integration

### Tertiary (LOW confidence)
- Cancel API exact request format -- needs sandbox verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, CP SDK is well-documented CDN script
- Architecture: HIGH - follows existing tRPC router patterns, clear integration points identified
- Pitfalls: HIGH - based on real analysis of webhook flow, widget lifecycle, and DB state machine
- Cancel API specifics: MEDIUM - CP docs confirm endpoint exists but exact subscription ID handling needs sandbox testing

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable domain, no fast-moving dependencies)
