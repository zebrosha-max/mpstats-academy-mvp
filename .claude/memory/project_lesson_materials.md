# Phase 49 · Lesson Materials — Project Memory

**Status:** Shipped 2026-04-27. Production: https://platform.mpstats.academy
**Phase plans:** `.planning/phases/49-lesson-materials/` (6 plans, all SUMMARY.md present)

## Schema (49-01)

- Tables: `Material`, `LessonMaterial` (many-to-many join with `order Int`)
- Enum: `MaterialType` (5 values: `PRESENTATION`, `CALCULATION_TABLE`, `EXTERNAL_SERVICE`, `CHECKLIST`, `MEMO`)
- Constants in `packages/shared/src/types/index.ts`: `MATERIAL_TYPE_LABELS`, `MATERIAL_ALLOWED_MIME_TYPES`, `MATERIAL_MAX_FILE_SIZE` (25 MB), `MATERIAL_SIGNED_URL_TTL` (3600s), `MATERIAL_STORAGE_BUCKET = 'lesson-materials'`
- Storage bucket: `lesson-materials` — private, MIME whitelist (PDF/XLSX/DOCX/CSV), 25 MB hard limit, no RLS policies, only service_role access
- **Critical lesson learned (Phase 28 echo):** schema applied via `prisma db push` PERED docker rebuild. Запускается на shared Supabase DB → видна и на staging, и на prod до рестарта контейнеров.

## tRPC Router (49-02)

`packages/api/src/routers/material.ts` — 9 procedures, 8 admin-only + 1 protected:

| Procedure | Auth | Notes |
|-----------|------|-------|
| `list` | admin | Filters by type/courseId/search/includeHidden |
| `getById` | admin | Returns lessons[] + course info |
| `create` | admin | XOR validation (externalUrl XOR storagePath) via Zod refine |
| `update` | admin | Type cannot be changed after creation |
| `delete` | admin | Soft-delete + Storage file removal |
| `attach` | admin | Adds LessonMaterial join row |
| `detach` | admin | Removes LessonMaterial join row |
| `requestUploadUrl` | admin | Returns signed PUT URL — bypasses Next.js body limit |
| `getSignedUrl` | protected | ACL: must have access to ≥1 attached lesson |

ACL gotcha: `getSignedUrl` checks `checkLessonAccess` from Phase 20 logic on attached lessons. Locked lesson → returns 403 even if material exists.

`learning.getLesson` extended to return `materials: []` for locked lessons (titles never leak in HTML stream).

## Ingest (49-03)

- Script: `scripts/ingest-materials.ts` (456 lines)
- Source: Google Sheet `1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0`, tab «Доп материалы к урокам»
- Tooling: GWS CLI (`npx --yes @googleworkspace/cli sheets ...`) — strip `Using keyring backend:` prefix line
- Idempotent: dry-run by default, `--apply` writes; composite unique key `(lessonId, materialId)` prevents duplicates on rerun
- Dedupe rule: `(title, normalizedUrl)` — D-49 trim only, preserve `?gid=...` for distinct Sheet tabs
- Fuzzy match: trim + quote/dash unify + split on `|` + ILIKE substring fallback
- Sentry custom span `ingest.lessonBlock` per lesson block (D-43) — soft-required, no-op without DSN
- **Result of first apply (2026-04-27):** 62 unique Material rows + 97 LessonMaterial links from 103/119 sheet rows
- **16 unmatched** in 10 lesson groups → documented in `.planning/phases/49-lesson-materials/49-03-NOTES.md` for manual attach via admin

## UI — Lesson Page (49-04)

- Section `<LessonMaterials>` rendered between `<CollapsibleSummary>` and `<Lesson info>` row on `/learn/[id]`
- `MaterialCard` per type: 5 distinct visual configs (icon + accent color + lucide icon)
- Empty state = no render (D-29) — section absent from DOM, not «no materials» placeholder
- Locked lesson = `materials: []` from backend → component short-circuits before DOM
- Click flow: `externalUrl` → `window.open` direct; `storagePath` → tRPC `getSignedUrl` → `window.open` signed URL
- Yandex Metrika events: `MATERIAL_OPEN` (per click) + `MATERIAL_SECTION_VIEW` (Intersection Observer threshold 0.4, one-shot via `sentRef` guard)
- Test selectors: `data-testid="lesson-materials"` on section, `data-testid="material-cta-{id}"` on each CTA button

## Admin (49-05)

- `/admin/content/materials` — list page with filters (type chips, course select, search, includeHidden)
- `/admin/content/materials/new` and `/admin/content/materials/[id]` — single page handles both modes via `params.id === 'new'` discriminator
- `MaterialForm` — XOR source toggle (URL XOR upload), type chips disabled in edit mode
- `MaterialFileUpload` — drag-n-drop, frontend MIME + size validation, XHR PUT direct to signed URL (fetch lacks upload progress)
- `LessonMultiAttach` — combobox with in-memory filter on full `learning.getCourses` payload (~422 lessons, no extra endpoint)
- `MaterialsTable` — soft-delete confirmation modal, isHidden inline toggle
- Sidebar: «Materials» nav item between Content and Comments (`AdminSidebar.tsx`)

## Polish (49-06)

- E2E Playwright spec: `apps/web/tests/e2e/lesson-materials.spec.ts` — 3 scenarios, env-var gated for fixture flexibility
- Cron `/api/cron/orphan-materials` — daily 03:00 UTC, deletes files older than 24h with no DB reference, Sentry checkin slug `orphan-materials` (margin 180min for GH Actions schedule drift)
- GitHub Action: `.github/workflows/orphan-materials-cleanup.yml`
- Methodologist guide: `docs/admin-guides/lesson-materials.md` (1-page, autonomous workflow)

## Gotchas

- **`prisma db push` ALWAYS before docker build** — stale Prisma client crashes the new code (Phase 28 lesson, recurring).
- **File upload:** signed PUT URL direct to Supabase Storage. Going through Next.js App Router caps at 4 MB body — D-11 routes around this.
- **External URL trust boundary:** Google Drive «share by link» is open by default. Mitigation = lesson access controls visibility in UI; the link itself is leakable. Documented compromise (D-38).
- **`requestUploadUrl` uses upload-id (Date.now+random), not materialId** — material does not exist yet at upload time. Two-roundtrip alternative (create row first → upload → patch storagePath) was rejected for UX reasons. See inline comment in `material.ts`.
- **Yandex Metrika events:** `MATERIAL_OPEN` per click + `MATERIAL_SECTION_VIEW` per session (Intersection Observer threshold 0.4, `sentRef` one-shot guard).
- **Cron orphan logic:** walks bucket recursively (top-level type/{idDir}/{filename}), uses `Material.storagePath` set as known-set source. Files older than 24h with no DB ref → deleted.
- **Locked lesson defence-in-depth:** backend `getLesson` returns empty array; frontend `LessonMaterials` short-circuits before observer/DOM setup. Both layers prevent material-name leakage.

## Methodologist Workflow

`docs/admin-guides/lesson-materials.md` covers:
- How to log into `/admin/content/materials`
- Create / Edit / Hide / Delete materials
- Multi-attach to lessons (key feature: «Plugin MPSTATS» on 9+ lessons)
- What user sees (subscriber vs locked)
- Troubleshooting (FORBIDDEN, file size, MIME)

After Phase 49 the Sheet is no longer source of truth — all edits via admin UI.

## Future work (out of scope this phase)

- Library catalog of standalone materials (`isStandalone` flag stored, UI not built) — candidate for Phase 47 hub-layout
- RAG indexation of material content (PDF/Sheet parsing → embeddings → AI chat) — explicitly cut as overengineering
- Bulk CSV import in admin — not needed; admin form is fast enough
- Material versioning / edit history
- External-link health check (404 detection on Google Drive)
- Watermark / PDF protection for paid content
- Public sharing of standalone materials as lead magnet

## Related docs

- `.planning/phases/49-lesson-materials/49-CONTEXT.md` — full phase context with all 53 decisions
- `.planning/phases/49-lesson-materials/49-0{1..6}-SUMMARY.md` — per-plan summaries
- `.planning/phases/49-lesson-materials/49-03-NOTES.md` — methodologist handoff for unmatched materials
- `docs/admin-guides/lesson-materials.md` — methodologist-facing user guide
