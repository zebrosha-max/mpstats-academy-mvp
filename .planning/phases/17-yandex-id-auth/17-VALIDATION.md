---
phase: 17
slug: yandex-id-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | apps/web/vitest.config.ts |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | AUTH-01 | integration | `pnpm test -- --run tests/auth/yandex-oauth.test.ts` | No - W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | AUTH-04 | unit | `pnpm test -- --run tests/auth/oauth-provider.test.ts` | No - W0 | ⬜ pending |
| 17-02-01 | 02 | 2 | AUTH-03 | unit | `pnpm test -- --run tests/auth/no-google.test.ts` | No - W0 | ⬜ pending |
| 17-02-02 | 02 | 2 | AUTH-02 | manual | Manual verification in Supabase dashboard | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/tests/auth/yandex-oauth.test.ts` — stubs for AUTH-01 (mock Yandex API, test callback handler)
- [ ] `apps/web/tests/auth/oauth-provider.test.ts` — stubs for AUTH-04 (YandexProvider interface compliance)
- [ ] `apps/web/tests/auth/no-google.test.ts` — stubs for AUTH-03 (verify no Google imports/references)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin account for Egor Vasilev | AUTH-02 | Requires Supabase dashboard verification | Check UserProfile.isAdmin=true after Yandex login |
| End-to-end Yandex OAuth login | AUTH-01 | Requires real Yandex OAuth app credentials | Click "Войти с Яндекс ID", complete flow, verify redirect to /dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
