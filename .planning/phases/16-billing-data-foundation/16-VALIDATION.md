---
phase: 16
slug: billing-data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test && npx prisma validate` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx prisma validate && pnpm test --run`
- **After every plan wave:** Run `pnpm test && pnpm build`
- **Before `/gsd:verify-work`:** Full suite must be green + manual admin settings page check
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | BILL-06 | schema | `npx prisma validate` | N/A | ⬜ pending |
| 16-01-02 | 01 | 1 | BILL-06 | unit | `pnpm test -- --run tests/billing-models.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | BILL-04 | unit | `pnpm test -- --run tests/feature-flags.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | BILL-04 | unit | `pnpm test -- --run tests/admin-settings.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest add switch` — if Switch component not yet installed
- [ ] `scripts/seed/seed-billing.ts` — seed script for billing data
- [ ] Schema validation: `npx prisma validate` after model changes

*Existing Vitest infrastructure covers unit test execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin settings page toggles feature flags | BILL-04 | Visual UI verification | 1. Open /admin/settings 2. Toggle billing_enabled 3. Verify toggle persists on refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
