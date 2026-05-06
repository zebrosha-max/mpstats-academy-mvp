---
name: MAAL CarrotQuest Integration
description: CarrotQuest API gotchas, event names, email automation for MAAL
type: reference
---

## CQ App ID
`57576-5a5343ec7aac68d788dabb2569`

## API Gotchas (critical)
- API = `application/x-www-form-urlencoded`, NOT JSON
- Event names with `$` are reserved (system) — use plain names
- Props = `operations` param with JSON array `[{op, key, value}]`
- Свойства через `setUserProps` на лида, НЕ через `params` в `trackEvent`
- Паттерн: `setUserProps(userId, { pa_course_name: '...' })` → `trackEvent(userId, 'pa_payment_success')`
- `by_user_id=true` создаёт нового лида по UUID, не проверяя email → дубликаты

## Events (12, pa_ prefix)
pa_doi, pa_registration_completed, pa_payment_success, pa_password_reset, и др.

## Email Properties
- `pa_course_name`, `pa_amount`, `pa_period_end` (DD.MM.YYYY HH:MM МСК), `pa_access_until`
- `pa_period_end_tech`, `pa_access_until_tech` — ISO 8601 для автоматизаций
- `pa_name`, `pa_doi`, `pa_password_link`

## Cron Jobs
- `/api/cron/check-subscriptions` — 3-day window before expiry
- `/api/cron/inactive-users` — 7/14/30d windows
- GitHub Action `daily-cron.yml` — 06:00 UTC
- CRON_SECRET + SITE_URL в GitHub Secrets

## Open Issue
CQ склейка лидов: нужен рефакторинг — при первом контакте искать существующего лида по email

## Key Files
- `apps/web/src/lib/carrotquest/client.ts` — API client (form-encoded)
- `apps/web/src/lib/carrotquest/emails.ts` — 6 email functions + formatDateRu
- `apps/web/src/lib/carrotquest/types.ts` — event names
- `apps/web/src/app/api/webhooks/supabase-email/route.ts` — Standard Webhooks
- `apps/web/src/components/shared/CarrotQuestIdentify.tsx` — frontend HMAC auth
