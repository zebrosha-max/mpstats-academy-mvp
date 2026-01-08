# Design Backup v1

**Created:** 2025-12-23
**Purpose:** Backup before Sprint 2.5 UI Redesign

## What's backed up

### Config
- `apps/web/tailwind.config.ts` — Tailwind configuration

### Styles
- `apps/web/src/styles/globals.css` — Global CSS

### UI Components
- `button.tsx`, `card.tsx`, `input.tsx` — shadcn/ui base components

### Shared Components
- `sidebar.tsx` — Main navigation sidebar
- `user-nav.tsx` — User dropdown menu
- `mobile-nav.tsx` — Mobile navigation

### Feature Components
- `diagnostic/` — Question, ProgressBar
- `learning/` — LessonCard
- `charts/` — RadarChart

### Layouts
- `app/layout.tsx` — Root layout
- `app/page.tsx` — Landing page
- `app/(auth)/layout.tsx` — Auth pages layout
- `app/(main)/layout.tsx` — Protected pages layout

## How to restore

```bash
# From MAAL directory
cp -r _backup_design_v1/apps/web/* apps/web/
```

## Current design state

- Colors: Default Tailwind palette (blue-600, gray-*, etc.)
- Typography: Default system fonts
- Components: shadcn/ui defaults
- Layout: Sidebar + TopNav pattern
