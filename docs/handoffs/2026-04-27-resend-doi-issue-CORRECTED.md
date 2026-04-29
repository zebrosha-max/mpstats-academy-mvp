# Доставка auth-писем — корректный handoff (CORRECTED v2)

**Дата:** 2026-04-27, вечер
**Заменяет:** утреннюю версию `2026-04-27-resend-doi-issue.md` (та была неверной)
**Передаётся:** CRM-команде для расследования + информации о текущей архитектуре

---

## Важно: предыдущий документ был неверным

В первой версии (утром 27.04) я (разработчик) утверждал, что DOI-письма проваливаются из-за rate-limit Resend (30-секундный лок на free tier). **Это оказалось не так.**

Реальная картина выяснилась после того, как Егор открыл Resend dashboard и увидел **0 писем за месяц**. Я полез в Supabase auth-config и нашёл то, что пропустил утром: включён HTTPS-webhook hook `hook_send_email_enabled=true`, который перехватывает все email-операции до того, как Supabase идёт на SMTP. Resend в нашей текущей архитектуре **не используется вообще**.

Извиняюсь за путаницу. Эту версию документа можно форвардить CRM как актуальную.

---

## Реальная архитектура

```
Юзер регистрируется
    ↓
Supabase Auth создаёт user_id + token_hash
    ↓
Supabase POST'ит webhook на наш Next.js
    /api/webhooks/supabase-email
    ↓
Наш handler формирует confirmation URL
    ↓
cq.setUserProps() + cq.trackEvent('pa_doi')
    ↓
CarrotQuest получает событие, срабатывает automation rule
    ↓
CQ через свой SMTP-провайдер (Mandrill) отправляет письмо
    ↓
Юзер получает email
```

**Resend** в Supabase auth-конфиге прописан как fallback SMTP — если webhook упадёт без 200 ответа, Supabase попытается отправить через SMTP. Но webhook всегда возвращает 200 (даже на ошибки), так что Resend никогда не активируется. Отсюда 0 писем у него в дашборде — это нормально, не баг.

## Что реально пошло не так с bakaresh@yandex.ru

Юзер зарегался 2026-04-23 11:14:05 МСК. До 27.04 утра письмо подтверждения не получил. Симптомы:
- В нашей БД: `email_confirmed_at = NULL`, `confirmation_sent_at = 11:14:05` (Supabase отметил «попытка отправки была»)
- В Resend dashboard: 0 писем (потому что Resend не используется)
- В Sentry: 0 ошибок (потому что силент-дроп не попадал туда — см. ниже)

**Корень проблемы — silent-drop trap в нашем коде CQ-клиента:**

```ts
// apps/web/src/lib/carrotquest/client.ts (старая версия)
private async request(path, formFields): Promise<void> {
  try {
    const response = await fetch(...);
    if (!response.ok) {
      console.error(`[CarrotQuest] API error ${response.status}...`);
      // ← только в console.log, НЕ throw'ится наверх
    }
  } catch (error) {
    console.error(`[CarrotQuest] Network error...`, error);
    // ← аналогично, проглатывалось
  }
}
```

То есть когда CQ возвращал 4xx/5xx (rate-limit, network glitch, suppressed lead, ошибка automation rule — что-угодно):
1. CQ-клиент ронял в stdout строку `[CarrotQuest] API error...`
2. Никаких exception'ов не бросал
3. Webhook видел успешный return, отдавал Supabase 200 OK
4. Supabase помечал `confirmation_sent_at = now()` и считал работу выполненной
5. Юзер не получал ничего
6. Через рестарт Docker-контейнера логи stdout стирались — следов не оставалось

**Итог:** 30+ дней мы могли терять auth-письма по неустановленным причинам и не знать об этом.

## Что мы зафиксили на стороне разработки (27.04 вечер)

После выяснения настоящей картины задеплоил три точки наблюдения:

| Файл | Изменение |
|------|-----------|
| `apps/web/src/lib/carrotquest/client.ts` | `request()` теперь бросает `CQApiError` на 4xx/5xx и `CQNetworkError` на fetch-исключение. Не молчит больше |
| `apps/web/src/lib/carrotquest/emails.ts` | Все 6 email-функций теперь зовут `Sentry.captureException(error, { tags: { area: 'carrotquest-email', stage: '<функция>' }, extra: { userId } })` |
| `apps/web/src/app/api/webhooks/supabase-email/route.ts` | Перед обработкой выставляются `Sentry.setTags({ email_action_type, 'auth.user_id' })` и `Sentry.setUser({ id, email })`. Catch ловит CQ-ошибки и помечает их `area: 'supabase-email-hook'` |

Auth-flow при этом не изменён — webhook всё ещё возвращает 200 на ошибки (иначе Supabase сломает регистрацию). Но любая такая ошибка теперь попадает в Sentry в течение секунд с понятными тэгами.

**После деплоя:** при следующем тикете «не пришло письмо» — за 1 минуту в Sentry видно, был ли вызван webhook, отвалилась ли CQ, для какого юзера, какой email_action_type.

## Что нужно от CRM-команды

### 1. Проверить bakaresh@yandex.ru в CarrotQuest

CRM-инструкция, что искать в дашборде CQ — в отдельном документе/сообщении. Краткая суть:
- Найти лид по email
- Посмотреть события — должно быть `pa_doi` 23.04 в 11:14 (или его отсутствие)
- Проверить настройку automation rule для `pa_doi` (триггер, шаблон, фильтры)
- Проверить deliverability и suppression list

Это даст ответ, что именно сломалось 23.04: webhook не дошёл, CQ не приняла событие, automation rule не сработал, или письмо ушло и было отвергнуто Yandex.

### 2. Проверить, что все 11 наших automation rules настроены и работают

Полный список наших событий:

| Event | Триггер | Что должно отправляться |
|-------|---------|-------------------------|
| `pa_doi` | Регистрация | «Подтверди email» |
| `pa_password_reset` | «Забыл пароль» | «Сброс пароля» |
| `pa_email_change` | Смена email | «Подтверди новый email» |
| `pa_registration_completed` | После DOI | Welcome email |
| `pa_payment_success` | После оплаты | Чек |
| `pa_payment_failed` | Платёж не прошёл | «Платёж не прошёл» |
| `pa_subscription_cancelled` | Юзер отменил | «Подписка отменена» |
| `pa_subscription_expiring` | За 3 дня до истечения | Напоминание |
| `pa_inactive_7` | 7 дней без логина | Reactivation drip 1 |
| `pa_inactive_14` | 14 дней без логина | Reactivation drip 2 |
| `pa_inactive_30` | 30 дней без логина | Win-back |

Для каждого — убедиться, что в CQ есть рабочий automation rule с подключённым шаблоном и без suppression-фильтров, которые могут случайно отрезать аудиторию.

### 3. Когда возможно — настроить Sentry alert на нашу сторону

Не критично, но полезно: если CRM-команда хочет получать пинг при сбоях email-канала, можно настроить Sentry alert rule на условие `tags:area:carrotquest-email OR tags:area:supabase-email-hook` с уведомлением в их Telegram/email. Это инструмент совместного дежурства за каналом.

## Что больше не нужно решать

- **Решение про апгрейд Resend** — не актуально, Resend нами не используется
- **Решение про миграцию на CQ** — мы уже на CQ для всех auth-писем, просто не было документации и наблюдаемости

## Открытые вопросы для следующей итерации

1. **Retry-логика в CQ-клиенте** — сейчас один шот, на 5xx отдаём ошибку Sentry'ю, но повторно не пытаемся. Стоит добавить exponential backoff (3 попытки по 1с/3с/5с) для auth-критичных событий.
2. **Resend как реальный fallback** — Supabase его теоретически использует если webhook упадёт без 200. Но мы 200 возвращаем всегда. Имеет смысл подумать про фактический fallback — например, при `area:supabase-email-hook` ошибке альтернативно попробовать отправить через Resend SMTP.
3. **Deliverability мониторинг** — у CQ есть webhook'и про bounce/spam complaints. Имеет смысл их ловить и помечать юзеров suppressed на нашей стороне.

---

**Подготовил:** Claude Code (по просьбе Егора Гордеева, разработчика MAAL)
**Связанные документы:** `docs/email-architecture.html` (визуальная схема, версия 2.0)
