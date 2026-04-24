# Deferred Items — Phase 48

## Pre-existing test failures (out of scope for 48-02)

Обнаружены при прогоне `pnpm --filter @mpstats/web test` во время Phase 48-02.
Воспроизводятся на чистом master (до моих изменений) — НЕ вызваны работой по staging.

| Test | File | Status |
|------|------|--------|
| YandexProvider.authorizeUrl returns correct Yandex OAuth URL with all params | tests/auth/oauth-provider.test.ts | fail pre-existing |
| YandexProvider.getUserInfo GETs Yandex user info with OAuth header | tests/auth/oauth-provider.test.ts | fail pre-existing |
| Yandex OAuth Callback Route > handles full OAuth flow | tests/auth/yandex-oauth.test.ts | fail pre-existing |

Вероятная причина: изменения после Phase 44 (`force_confirm=yes`, `login:default_phone` scope, fetchWithRetry) — тесты не обновлены под новую авторизационную сигнатуру.

**Decision:** out of scope для 48-02 (staging environment). Требует отдельной задачи "Обновить Yandex OAuth unit-тесты". Задокументировано здесь, не блокирует Phase 48.
