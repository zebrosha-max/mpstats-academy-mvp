---
name: MAAL Design Backups & Sources
description: Design backup locations and Figma source URLs for MAAL UI
type: reference
---

## Design Sources (Sprint 2.5)
| Источник | URL | Использование |
|----------|-----|---------------|
| Color System | `wheel-next-22559505.figma.site` | Цветовая палитра (Blue/Green/Pink) |
| Landing Redesign | `figma.com/design/ltQb2GRetrS17SDzjSudOX` | Структура landing page |
| Brand Guideline | `figma.com/design/OmBVlWAJYzUKV3yQHywFMo` | Логотип, typography |

## v1 Backup (2025-12-23, pre-redesign)
Location: `_backup_design_v1/`

18 файлов: tailwind.config, globals.css, utils, layouts (root, auth, main), landing, ui components (button, card, input), shared (sidebar, user-nav, mobile-nav), diagnostic (Question, ProgressBar), learning (LessonCard), charts (RadarChart)

Restore: `cp -r _backup_design_v1/apps/web/* apps/web/`

## Architecture HTML Variants (2026-03-26)
- `docs/architecture-cyberpunk.html` — Cyberpunk/Terminal
- `docs/architecture-blueprint.html` — Editorial/Blueprint
- `docs/architecture-brand.html` — MPSTATS Brand
