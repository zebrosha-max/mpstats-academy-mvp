---
phase: 06-production-deploy
plan: 02
subsystem: infra
tags: [github-actions, cd, ssh, docker, e2e, production, prisma]

requires:
  - phase: 06-production-deploy
    provides: Dockerfile with openssl fix, /api/health endpoint, CI workflow
  - phase: 05.1-vps-infrastructure-setup
    provides: VPS with Docker/Nginx/SSL, academyal.duckdns.org domain
provides:
  - CD pipeline (push to master triggers auto-deploy via SSH)
  - Verified production E2E flow (all pages, OAuth, RAG, diagnostic)
affects: []

tech-stack:
  added: [appleboy/ssh-action]
  patterns:
    - "CD pipeline: SSH into VPS, git pull, docker compose rebuild"

key-files:
  created:
    - .github/workflows/cd.yml
  modified: []

key-decisions:
  - "appleboy/ssh-action@v1 for CD — simple SSH-based deploy, no Docker registry needed"
  - "Prisma binaryTargets added linux-musl-openssl-3.0.x alongside openssl package for reliability"
  - "Prisma engine binaries explicitly copied to standalone output in Dockerfile"

patterns-established:
  - "CD deploy: git pull + docker compose down/build/up via SSH action"

requirements-completed: [DEPLOY-04, DEPLOY-07]

duration: 45min
completed: 2026-02-24
---

# Phase 06 Plan 02: CD Pipeline & E2E Verification Summary

**GitHub Actions CD pipeline with SSH deploy and full E2E production verification across all pages including OAuth, RAG chat, and diagnostic flow**

## Performance

- **Duration:** ~45 min (including deploy wait times and human verification)
- **Started:** 2026-02-24T14:15:00Z
- **Completed:** 2026-02-24T15:03:00Z
- **Tasks:** 2
- **Files modified:** 3 (cd.yml created, Dockerfile and schema.prisma fixed during deploy)

## Accomplishments
- Created CD pipeline that auto-deploys on push to master via SSH + docker compose
- Fixed Prisma engine binary copying in Dockerfile (standalone output was missing binaries)
- Added linux-musl-openssl-3.0.x to Prisma binaryTargets for Alpine compatibility
- Full E2E verification passed: landing, auth, dashboard, learn (405 lessons), RAG chat with citations, diagnostic session, profile

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CD workflow and deploy** - `7c74f66` (feat)
2. **Task 2: Verify full E2E flow** - human-verify checkpoint (approved)

Additional fixes during deploy:
- `e579b22` - fix(db): add linux-musl-openssl-3.0.x binary target for Prisma on Alpine
- `692d6b1` - fix(docker): copy Prisma engine binaries to standalone output

## Files Created/Modified
- `.github/workflows/cd.yml` - CD pipeline using appleboy/ssh-action, triggers on push to master + workflow_dispatch
- `Dockerfile` - Added explicit copy of Prisma engine binaries to runner stage
- `packages/db/prisma/schema.prisma` - Added linux-musl-openssl-3.0.x to binaryTargets

## Decisions Made
- Used `appleboy/ssh-action@v1` for deployment — simple, no Docker registry or complex CI/CD infrastructure needed
- Added Prisma `binaryTargets` in schema.prisma alongside `apk add openssl` — belt-and-suspenders for engine availability
- Explicit `COPY` of Prisma engine binaries in Dockerfile because Next.js standalone output doesn't include them automatically

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma binary target missing for Alpine**
- **Found during:** Task 1 (deploy verification)
- **Issue:** Prisma couldn't find query engine on Alpine — binaryTargets didn't include linux-musl-openssl-3.0.x
- **Fix:** Added `"linux-musl-openssl-3.0.x"` to binaryTargets in schema.prisma
- **Files modified:** packages/db/prisma/schema.prisma
- **Verification:** Container started successfully with DB connected
- **Committed in:** `e579b22`

**2. [Rule 3 - Blocking] Prisma engine binaries not in standalone output**
- **Found during:** Task 1 (deploy verification after first fix)
- **Issue:** Next.js standalone output didn't include Prisma engine binaries, causing runtime crash
- **Fix:** Added explicit COPY of .prisma/client directory to runner stage in Dockerfile
- **Files modified:** Dockerfile
- **Verification:** /api/health returns database: connected
- **Committed in:** `692d6b1`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were essential for Prisma to work in Alpine Docker. No scope creep.

## Issues Encountered
- Prisma in Alpine Docker required both the openssl package AND explicit binary targets + manual copy of engine files. The plan only covered the openssl package; the additional binary target and COPY were discovered during deploy testing.

## User Setup Required
None - GitHub secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY) were already configured.

## E2E Verification Results

| Check | Status |
|-------|--------|
| Health /api/health | OK (database: connected) |
| Landing page | OK (hero, CTA, stats) |
| Login page | OK (form + Google OAuth) |
| Auth middleware | OK (redirects unauthenticated) |
| Google OAuth | OK (login successful) |
| Dashboard | OK (stats cards, radar chart) |
| Learn /learn | OK (405 lessons, 6 courses) |
| Lesson page | OK (RAG summary with citations) |
| AI Chat | OK (answers with sources + timecodes) |
| Diagnostic intro | OK (5 categories, 15 questions) |
| Diagnostic session | OK (questions + progress bar) |
| Profile | OK (user info, radar chart) |

## Next Phase Readiness
- Production is live and verified at https://academyal.duckdns.org
- CD pipeline will auto-deploy future pushes to master
- Phase 06 (Production Deploy) is complete
- Remaining milestone work: Phase 2 (AI Questions), Phase 4 (Access Control), Phase 5 (Security)

## Self-Check: PASSED

- [x] `.github/workflows/cd.yml` exists
- [x] `06-02-SUMMARY.md` exists
- [x] Commit `7c74f66` found
- [x] Commit `e579b22` found
- [x] Commit `692d6b1` found

---
*Phase: 06-production-deploy*
*Completed: 2026-02-24*
