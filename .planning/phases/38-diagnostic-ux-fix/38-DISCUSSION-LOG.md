# Phase 38: Diagnostic UX Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 38-diagnostic-ux-fix
**Areas discussed:** Zones display, Priority badges, Empty sections, "Результаты не найдены", Mobile overflow
**Mode:** --auto (all decisions auto-selected)

---

## Zones Display (R14)

| Option | Description | Selected |
|--------|-------------|----------|
| Count all gaps > 0 | Show total zones needing improvement | ✓ |
| Keep HIGH-only count | Less alarming, but confusing with 4 cards below | |
| Split into "priority" and "growth" | Two counts — complex | |

**User's choice:** [auto] Count all gaps > 0 (recommended default)

---

## Priority Badges (R11, R12)

| Option | Description | Selected |
|--------|-------------|----------|
| Высокий/Средний/Низкий + tooltip | Standard Russian, actionable tooltips | ✓ |
| Keep Приоритет/Низкий, add tooltip | Less change, but "Приоритет" is unclear | |
| Color-only, no text | Minimal but inaccessible | |

**User's choice:** [auto] Высокий/Средний/Низкий + tooltip (recommended default)

---

## Empty Sections (R20)

| Option | Description | Selected |
|--------|-------------|----------|
| Hide empty sections | Clean, no confusion | ✓ |
| Show with placeholder text | Visible but empty | |
| Show grayed out | Visual clutter | |

**User's choice:** [auto] Hide empty sections (recommended default)

---

## "Результаты не найдены"

| Option | Description | Selected |
|--------|-------------|----------|
| Investigate + error boundary | Find root cause, add graceful fallback | ✓ |
| Just add error boundary | Quick fix, root cause unknown | |

**User's choice:** [auto] Investigate + error boundary (recommended default)

---

## Mobile Overflow (R13)

| Option | Description | Selected |
|--------|-------------|----------|
| flex-wrap + smaller text | Standard responsive pattern | ✓ |
| Hide badge text on mobile, show icon only | More compact | |

**User's choice:** [auto] flex-wrap + smaller text (recommended default)

---

## Claude's Discretion

- Tooltip component choice (shadcn Tooltip vs native title)
- Animation on badge appearance
- Error boundary implementation

## Deferred Ideas

None
