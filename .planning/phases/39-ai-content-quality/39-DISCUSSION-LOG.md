# Phase 39: AI & Content Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-27
**Phase:** 39-ai-content-quality
**Areas discussed:** Brand names, Timecode seek, Footnote scroll, Duplicate lessons
**Mode:** --auto

---

## Brand Names (R42)

| Option | Description | Selected |
|--------|-------------|----------|
| System prompt only | Simple but LLM may ignore | |
| Post-processing regex only | Guaranteed but doesn't teach LLM | |
| Both prompt + regex | Double protection | ✓ |

**User's choice:** [auto] Both (recommended)

## Timecode Seek (R17)

| Option | Description | Selected |
|--------|-------------|----------|
| Wire onSeek to postMessage + scrollIntoView | Complete fix with feedback | ✓ |
| Disable play icons | Hide broken feature | |

**User's choice:** [auto] Wire onSeek (recommended)

## Footnote Scroll (R18)

| Option | Description | Selected |
|--------|-------------|----------|
| seekTo + scrollIntoView + highlight | Full fix | ✓ |
| Remove footnote links | Hide broken feature | |

**User's choice:** [auto] Full fix (recommended)

## Duplicate Lessons (R35)

| Option | Description | Selected |
|--------|-------------|----------|
| Script with dry-run, keep lowest order | Safe, logged | ✓ |
| Manual SQL delete | Risky, no audit trail | |

**User's choice:** [auto] Script with dry-run (recommended)

## Deferred Ideas

None
