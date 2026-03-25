---
phase: 25-legal-cookie-consent
plan: 02
subsystem: web-frontend
tags: [legal, consent, registration, cookies, ui]
dependency_graph:
  requires: [25-01]
  provides: [registration-consent, cookie-consent-banner]
  affects: [register-page, root-layout]
tech_stack:
  added: ["@radix-ui/react-checkbox"]
  patterns: [shadcn-checkbox, localStorage-consent, toggle-switch]
key_files:
  created:
    - apps/web/src/components/ui/checkbox.tsx
    - apps/web/src/components/shared/CookieConsent.tsx
  modified:
    - apps/web/src/app/(auth)/register/page.tsx
    - apps/web/src/app/layout.tsx
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "Used @radix-ui/react-checkbox (shadcn pattern) for registration checkboxes"
  - "Cookie consent is informational only -- does not conditionally block scripts in this phase"
  - "Toggle switches (custom button) for cookie categories instead of checkboxes"
  - "Cookie consent defaults analytics and marketing to ON (opt-out model)"
metrics:
  duration: "3m 29s"
  completed: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
requirements: [LEGAL-03, LEGAL-04]
---

# Phase 25 Plan 02: Registration Checkboxes + Cookie Consent Summary

Registration form with 3 legal consent checkboxes (offer+PD required, ads optional) and cookie consent banner with category toggles in root layout.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Registration form checkboxes | 4614f14 | register/page.tsx, checkbox.tsx |
| 2 | Cookie consent banner | 4614f14 | CookieConsent.tsx, layout.tsx |

## Implementation Details

### Task 1: Registration Checkboxes
- Added shadcn/ui `Checkbox` component with `@radix-ui/react-checkbox` and mp-blue-600 checked state
- 3 checkboxes on registration form: offer (required), PD consent (required), advertising (optional)
- Submit button disabled until both required checkboxes are checked (`canSubmit = acceptOffer && acceptPdn && !loading`)
- Required checkboxes marked with red asterisk
- Links to `/legal/offer`, `/legal/pdn`, `/legal/adv` open in new tab (`target="_blank"`)
- `adv_consent` value passed in FormData for future CQ integration

### Task 2: Cookie Consent Banner
- `CookieConsent` client component renders fixed bottom banner on first visit
- 1-second delay before showing to avoid layout shift
- "Принять все" saves full consent to localStorage and hides banner
- "Настроить" expands category panel with 3 toggles:
  - Необходимые (always on, disabled)
  - Аналитика / Яндекс Метрика (toggleable)
  - Маркетинг / Carrot Quest (toggleable)
- Custom `Toggle` switch component (accessible with role="switch" and aria-checked)
- Consent saved as JSON in `localStorage.cookie_consent` with timestamp
- Added to root layout after Toaster, before YandexMetrika
- Uses existing `animate-slide-up` CSS animation from globals.css

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functionality is wired and operational.

## Self-Check: PASSED

- All 4 key files exist on disk
- Commit 4614f14 verified in git log
- `acceptOffer` found in register page (3 occurrences)
- `cookie_consent` found in CookieConsent component (2 occurrences)
- `CookieConsent` import found in root layout
