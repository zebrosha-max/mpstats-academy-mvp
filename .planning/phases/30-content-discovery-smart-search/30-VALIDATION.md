---
phase: 30
slug: content-discovery-smart-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test && pnpm build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | DISC-01 | build | `pnpm build` | ✅ | ⬜ pending |
| 30-01-02 | 01 | 1 | DISC-02 | build | `pnpm build` | ✅ | ⬜ pending |
| 30-02-01 | 02 | 2 | DISC-03 | build | `pnpm build` | ✅ | ⬜ pending |
| 30-02-02 | 02 | 2 | DISC-04 | build | `pnpm build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Semantic search returns relevant results | DISC-01 | Requires real embeddings + DB | Enter "как увеличить продажи" — verify top results are relevant |
| Filter UI responsiveness | DISC-03 | Visual verification | Apply multiple filters, check instant response |
| Search results with timecodes | DISC-02 | Requires Kinescope player | Click timecode fragment, verify seekTo works |
| Track badge marking | DISC-04 | Requires diagnostic completion | Complete diagnostic, search — verify "В вашем треке" badges |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
