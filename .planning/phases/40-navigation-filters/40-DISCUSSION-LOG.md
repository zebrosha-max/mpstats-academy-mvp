# Phase 40: Navigation & Filters - Discussion Log

> **Audit trail only.**

**Date:** 2026-03-27
**Phase:** 40-navigation-filters
**Areas:** Filter persistence, Tour repeat, Comment author, Yandex OAuth, Autoplay
**Mode:** --auto

---

## Filter Persistence (R21)

| Option | Description | Selected |
|--------|-------------|----------|
| URL searchParams | Shareable, back button works | ✓ |
| localStorage | Persists across sessions, not shareable | |
| React state only | Current broken behavior | |

**Choice:** [auto] URL searchParams (recommended)

## Tour Repeat (R46)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix localStorage check timing + hasAutoStartedRef | Minimal, targeted | ✓ |
| Debounce tour trigger | More complex | |

**Choice:** [auto] Fix timing (recommended)

## Comment Author (R43)

| Option | Description | Selected |
|--------|-------------|----------|
| name ?? 'Пользователь' | Clean, no email exposure | ✓ |
| Masked email (a***@g...) | Still reveals domain | |

**Choice:** [auto] name ?? 'Пользователь' (recommended)

## Yandex OAuth (R10)

| Option | Description | Selected |
|--------|-------------|----------|
| prompt=login | Forces account selection | ✓ |
| prompt=select_account | May not work with Yandex | |

**Choice:** [auto] prompt=login (recommended)

## Autoplay (R22)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify autoplay=false everywhere | Consistency check | ✓ |
| Add conditional autoplay | More complex | |

**Choice:** [auto] Verify off (recommended)

## Deferred Ideas
None
