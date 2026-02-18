# Kinescope Upload Script Fix Plan

## Status
Upload script `scripts/kinescope-upload.ts` was partially rewritten but NOT tested yet.
The old version used wrong endpoint/format. New version uses correct TUS protocol discovered via browser network interception.

## Critical Discovery: Correct Kinescope Upload API Format

### What was WRONG (old script):
- Endpoint: `https://upload.new.video` (doesn't exist)
- Method: Single multipart POST
- No workspace ID header

### What is CORRECT (discovered via browser DevTools interception):

**Two-step TUS protocol:**

#### Step 1: Init (POST, no body)
```
POST https://eu-ams-uploader.kinescope.io/v2/init
Headers:
  Authorization: Bearer {KINESCOPE_API_KEY}
  Tus-Resumable: 1.0.0
  X-Workspace-ID: fe0bcafb-8b2f-4e7d-b043-ca5afc445504
  Upload-Length: {file_size_bytes}
  Upload-Metadata: parent_id {base64(project_id)},init_id {base64(uuid)},type {base64("video")},title {base64(title)},filename {base64(filename)},filesize {base64(file_size_string)}

Response: 201 with Location header → upload URL
```

#### Step 2: Upload (PATCH, binary body)
```
PATCH {location_url_from_step1}
Headers:
  Authorization: Bearer {KINESCOPE_API_KEY}
  Tus-Resumable: 1.0.0
  X-Workspace-ID: fe0bcafb-8b2f-4e7d-b043-ca5afc445504
  Upload-Offset: 0
  Content-Type: application/offset+octet-stream
Body: raw file bytes
```

### Upload-Metadata format (TUS spec):
Each field: `key base64value` separated by commas (no spaces after comma).
Required fields:
- `parent_id` — base64 of KINESCOPE_PROJECT_ID (= project UUID)
- `init_id` — base64 of a random UUID (becomes the video ID!)
- `type` — base64 of "video"
- `title` — base64 of video title
- `filename` — base64 of filename with extension
- `filesize` — base64 of file size as string

### Video ID:
The `init_id` you generate becomes the Kinescope video ID.
Confirmed: uploaded video via browser had id = `7bac744d-c5be-4721-b787-34b9b6c3120e` which matched the init_id in metadata.

## Environment Variables (already in apps/web/.env)
```
KINESCOPE_API_KEY=6756bfa2-08cc-4340-a72a-ddbcc7741655
KINESCOPE_PROJECT_ID=ad127c11-6187-4fe2-bbfa-16f0d708a41c
KINESCOPE_WORKSPACE_ID=fe0bcafb-8b2f-4e7d-b043-ca5afc445504
```

## Current State of Upload Script

File: `scripts/kinescope-upload.ts`
- Already rewritten with correct TUS two-step protocol
- Added `dotenv` loading from `apps/web/.env`
- Added `randomUUID()` for init_id generation
- NOT YET TESTED — need to run `npx tsx scripts/kinescope-upload.ts --limit 1`

## Tasks Remaining

### 1. Test upload script (--limit 1)
```bash
cd MAAL && npx tsx scripts/kinescope-upload.ts --limit 1
```
Expected: uploads smallest video (9.4 MB), prints videoId, updates Lesson.videoId in DB.

### 2. If test passes — bulk upload all 405 videos
```bash
npx tsx scripts/kinescope-upload.ts
```
This will take a long time (~212 GB). Consider running in background.
Progress saves to `scripts/kinescope-upload-progress.json` for resume.

### 3. Clean up test files
- Delete `scripts/test-tus-upload.ts` (test file, no longer needed)
- Remove `tus-js-client` from root devDeps (was added for testing)

### 4. Commit changes
Files changed:
- `scripts/kinescope-upload.ts` — rewritten with correct TUS protocol
- `apps/web/.env` — added KINESCOPE_WORKSPACE_ID

## Test Video Already in Kinescope
One video was manually uploaded via Dashboard during debugging:
- File: `06_express/c02_seo/m02_keywords/003_generator_opisaniya_ai.mp4`
- Kinescope ID: `7bac744d-c5be-4721-b787-34b9b6c3120e`
- Status: done (transcoded)
- This video should be SKIPPED by upload script (already has videoId if DB was updated)
- NOTE: DB was NOT updated for this manual upload — may need manual fix:
  ```sql
  UPDATE "Lesson" SET "videoId" = '7bac744d-c5be-4721-b787-34b9b6c3120e'
  WHERE id = '06_express_c02_seo_m02_keywords_003';
  ```
  (verify exact lesson_id first)

## Smallest Files for Testing (from E:\Academy Courses)
1. `06_express/c02_seo/m02_keywords/003_generator_opisaniya_ai.mp4` — 9.4 MB (already uploaded manually)
2. `06_express/c04_product_choice/m01_start/002_3_materialy_i_vneshnie_ssylki.mp4` — 10.1 MB
3. `03_ai/m01_intro/002_2_besplatnyy_vpn_ustanovka_rasshireniya.mp4` — 12.5 MB
