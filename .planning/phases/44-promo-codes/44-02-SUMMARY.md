---
phase: 44-promo-codes
plan: 02
subsystem: web, pricing, profile
tags: [promo-codes, pricing, profile, ui, subscription]

requires:
  - phase: 44-promo-codes
    plan: 01
    provides: promo tRPC router (validate, activate)
provides:
  - PromoCodeInput component for /pricing page
  - Auth header on /pricing with login/profile state
  - Promo subscription badge and display in profile page
  - URL param and sessionStorage promo code preservation across auth flow
affects: [44-03-PLAN, 44-04-PLAN]

tech-stack:
  added: []
  patterns: [sessionStorage for cross-auth-flow state preservation, Suspense wrapper for useSearchParams]

key-files:
  created:
    - apps/web/src/components/pricing/PromoCodeInput.tsx
  modified:
    - apps/web/src/app/pricing/page.tsx
    - apps/web/src/app/(main)/profile/page.tsx

key-decisions:
  - "sessionStorage used to preserve promo code across login redirect (middleware redirects to /dashboard, losing URL params)"
  - "Suspense wrapper added to PricingPage for useSearchParams compatibility"
  - "Badge variant 'secondary' chosen for promo subscriptions to visually distinguish from paid 'success' variant"

patterns-established:
  - "PromoCodeInput: collapsible promo input with auth-aware activation flow"
  - "isPromoSubscription detection via subscription.promoCodeId != null"

requirements-completed: [D-03, D-04, D-10]

duration: 7min
completed: 2026-04-06
---

# Phase 44 Plan 02: Promo Code Pricing UI and Profile Badge Summary

**PromoCodeInput component on /pricing with auth header, URL param auto-fill, sessionStorage preservation, and promo badge in profile with hidden cancel button**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T19:37:50Z
- **Completed:** 2026-04-06T19:44:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PromoCodeInput component: collapsible "Есть промо-код?" link expanding to input + "Активировать" button
- Auth-aware activation: unauthenticated users redirected to /login with promo code saved in sessionStorage
- URL param ?promo= auto-fills code (for direct links or after redirect)
- Auth header on /pricing: "Войти" link for guests, profile name link for authenticated users
- Profile page: "Промо" badge (secondary variant) for promo subscriptions
- "Промо-доступ" label instead of price, "Доступ до" instead of "Следующее списание"
- Cancel button hidden for promo subscriptions

## Task Commits

1. **Task 1: Create PromoCodeInput and integrate into pricing page with auth header** - `ab22a83` (feat)
2. **Task 2: Add promo subscription badge and hide cancel in profile** - `a33c8ca` (feat)

## Files Created/Modified
- `apps/web/src/components/pricing/PromoCodeInput.tsx` - New collapsible promo code input component with trpc.promo.activate integration
- `apps/web/src/app/pricing/page.tsx` - Auth header, useSearchParams for ?promo= param, PromoCodeInput section, Suspense wrapper
- `apps/web/src/app/(main)/profile/page.tsx` - isPromoSubscription detection, "Промо" badge, "Промо-доступ" label, cancel button guard

## Decisions Made
- sessionStorage preserves promo code across auth flow because login always redirects to /dashboard (middleware behavior), losing URL params
- Suspense boundary wraps PricingPageContent to support useSearchParams (Next.js requirement)
- Badge variant 'secondary' for promo subscriptions provides visual distinction from paid subscriptions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Suspense wrapper for useSearchParams**
- **Found during:** Task 1
- **Issue:** Next.js requires useSearchParams to be inside a Suspense boundary, but the pricing page was a flat 'use client' component
- **Fix:** Extracted PricingPageContent inner component, wrapped in Suspense in the default export (follows login page pattern)
- **Files modified:** apps/web/src/app/pricing/page.tsx
- **Commit:** ab22a83

**2. [Rule 2 - Missing functionality] Added sessionStorage promo code preservation**
- **Found during:** Task 1
- **Issue:** Plan specified URL param redirect (/login?redirect=/pricing&promo=CODE) but middleware redirects authenticated users from /login to /dashboard, losing the redirect and promo params
- **Fix:** Store promo code in sessionStorage before redirect, restore on pricing page load after auth
- **Files modified:** apps/web/src/components/pricing/PromoCodeInput.tsx
- **Commit:** ab22a83

## Self-Check: PASSED

- apps/web/src/components/pricing/PromoCodeInput.tsx: FOUND
- apps/web/src/app/pricing/page.tsx: FOUND
- apps/web/src/app/(main)/profile/page.tsx: FOUND
- Commit ab22a83: FOUND
- Commit a33c8ca: FOUND

---
*Phase: 44-promo-codes*
*Completed: 2026-04-06*
