# EMAIL-SPEC v2: Notifications + Referral Program

**Проект:** MPSTATS Academy Adaptive Learning
**Дата:** 2026-05-06
**Версия:** 2.0
**Назначение:** Спецификация второй волны email-шаблонов — уведомления (Phases 51-54) и реферальная программа (Phase 53A)
**Провайдер:** Carrot Quest
**Базовый брендинг:** см. EMAIL-SPEC.md v1.0 (header, footer, цвета, отправитель)

> **Контекст для CQ-команды:** все события приходят через `cq.trackEvent`. Свойства для подстановки в шаблон ставятся на lead через `cq.setUserProps` **до** trigger event'а — так что в шаблоне используем lead-properties, а не event params (как в v1).

---

## Часть A — Уведомления (Phases 51-54)

7 событий. Все шлются через единый сервис `notify()` или `notifyMany()`. Перед `trackEvent` сервис всегда выставляет на lead универсальные `pa_notif_*` свойства.

### Универсальные переменные (есть у всех `pa_notif_*` событий)

| Переменная | Описание | Пример |
|---|---|---|
| `{{pa_notif_type}}` | Внутренний тип | `COMMENT_REPLY` |
| `{{pa_notif_preview}}` | Короткий превью текст (1-2 строки) | «А что насчёт DRR < 30?» |
| `{{pa_notif_cta_url}}` | Относительный путь на платформе для CTA | `/learn/abc123#comment-456` |

> CTA в письме всегда формируется как `https://platform.mpstats.academy{{pa_notif_cta_url}}`.

---

### 1. `pa_notif_comment_reply` — Ответ на твой комментарий (Phase 51 ✅)

**Получатель:** автор оригинального комментария (когда другой юзер ответил).

**Дополнительные переменные:**
| Переменная | Описание | Пример |
|---|---|---|
| `{{pa_notif_lesson_title}}` | Название урока | «Юнит-экономика на WB» |
| `{{pa_notif_author_name}}` | Имя ответившего | «Сергей К.» |

**Тон/контент:** нейтральный, информативный.

**Заголовок:** «На ваш комментарий ответили»
**Тело (структура):**
- Заголовок: `На ваш комментарий ответили в уроке «{{pa_notif_lesson_title}}»`
- Подзаголовок: `{{pa_notif_author_name}} написал:`
- Цитата: `{{pa_notif_preview}}` (в стилизованном блоке)
- CTA-кнопка: «Открыть обсуждение» → `https://platform.mpstats.academy{{pa_notif_cta_url}}`

---

### 2. `pa_notif_admin_comment_reply` — Ответ методолога (Phase 52 ✅)

**Получатель:** автор оригинального комментария (когда **админ/методолог** ответил).

**Дополнительные переменные:** те же что и в #1.

**Отличие от #1:** визуальный акцент — «Команда Academy ответила». Можно добавить иконку/badge с цветом `#FF6B16` (orange).

**Заголовок:** «Команда Academy ответила на ваш вопрос»
**Тело:**
- `Методолог {{pa_notif_author_name}} ответил вам в уроке «{{pa_notif_lesson_title}}»`
- Цитата: `{{pa_notif_preview}}`
- CTA: «Открыть обсуждение»

---

### 3. `pa_notif_content_update` — Новые материалы в курсе (Phase 52 ✅)

**Получатель:** юзеры, которые активно учат курс (есть прогресс в треке).

**Дополнительные переменные:**
| Переменная | Описание | Пример |
|---|---|---|
| `{{pa_notif_course_title}}` | Название курса | «Аналитика WB на MPSTATS» |
| `{{pa_notif_items_count}}` | Сколько новых единиц (число) | 3 |
| `{{pa_notif_items_text}}` | Готовая русская строка | «2 урока и 1 материал» |

**Заголовок:** «{{pa_notif_items_count}} новинок в курсе «{{pa_notif_course_title}}»»
**Тело:**
- `В курсе «{{pa_notif_course_title}}», который вы изучаете, появилось {{pa_notif_items_text}}`
- `{{pa_notif_preview}}` — список превью
- CTA: «Перейти к курсу» → `{{pa_notif_cta_url}}` (ведёт на конкретный урок если он один, иначе на /learn)

---

### 4. `pa_notif_progress_nudge` — Незавершённый урок (Phase 53 📋)

**Получатель:** юзер начал урок 72 часа назад без `completedAt`. Шлётся **вт/чт 10:00 МСК** через retention-engine cron.

**Дополнительные переменные:**
| Переменная | Описание |
|---|---|
| `{{pa_notif_lesson_title}}` | Название урока, на котором остановился |

**Тон:** дружелюбный, без давления (`«ты»`-форма).

**Заголовок:** «Продолжим с урока «{{pa_notif_lesson_title}}»?»
**Тело:**
- `Ты остановился на уроке «{{pa_notif_lesson_title}}» — давай продолжим? Это займёт ~10 минут.`
- CTA-кнопка: «Продолжить урок» → `{{pa_notif_cta_url}}`
- Доп. ссылка снизу: «Поставить напоминания на паузу на 30 дней» → `https://platform.mpstats.academy/api/notifications/pause?token={{pause_token}}` *(токен генерится backend'ом, добавим в setUserProps в Phase 53)*

---

### 5. `pa_notif_inactivity_return` — Не заходил 14 дней (Phase 53 📋)

**Получатель:** активная подписка + 14+ дней без визита.

**Дополнительные переменные:**
| Переменная | Описание | Пример |
|---|---|---|
| `{{pa_notif_days_inactive}}` | Сколько дней не было | 14 |

**Заголовок:** «Не виделись {{pa_notif_days_inactive}} дней — что нового на Academy»
**Тело:**
- `Подписка идёт, а ты не заходил уже {{pa_notif_days_inactive}} дней.`
- `{{pa_notif_preview}}` (краткий список новинок)
- CTA: «Посмотреть что нового» → `{{pa_notif_cta_url}}` (ведёт на `/dashboard`)

---

### 6. `pa_notif_weekly_digest` — Пятничный дайджест (Phase 53 📋, opt-in)

**Получатель:** только юзеры включившие в `/profile/notifications`. Шлётся **пятница 10:00 МСК**.

**Дополнительные переменные:**
| Переменная | Описание | Пример |
|---|---|---|
| `{{pa_notif_new_lessons_count}}` | Новых уроков за неделю | 5 |
| `{{pa_notif_activity_count}}` | Активность по моим обсуждениям (ответы) | 3 |

**Заголовок:** «Что нового за неделю в Academy»
**Тело:**
- `За неделю: {{pa_notif_new_lessons_count}} новых уроков, {{pa_notif_activity_count}} ответов в твоих обсуждениях.`
- `{{pa_notif_preview}}` (структурированный список)
- CTA: «Открыть платформу» → `{{pa_notif_cta_url}}`
- Footer: ссылка «Отключить дайджест» → `/profile/notifications`

---

### 7. `pa_notif_broadcast` — Маркетинговая рассылка (Phase 54 📋)

**Получатель:** сегмент юзеров выбранный админом в `/admin/notifications/broadcast`.

**Дополнительные переменные:**
| Переменная | Описание |
|---|---|
| `{{pa_notif_title}}` | Заголовок броадкаста (задаёт админ) |
| `{{pa_notif_body}}` | Тело броадкаста |
| `{{pa_notif_cta_text}}` | Текст CTA-кнопки (опционально) |

**Заголовок шаблона:** `{{pa_notif_title}}` (динамический, без префиксов)
**Тело:**
- `{{pa_notif_body}}`
- CTA-кнопка: `{{pa_notif_cta_text}}` → `{{pa_notif_cta_url}}` (показываем только если оба заданы)

---

## Часть B — Реферальная программа (Phase 53A)

3 события. Текущий режим i1 (no payment required); с 01.06 переключение в i2.

### 8. `pa_referral_trial_started` — Триал активирован (новому юзеру) ✅

**Получатель:** юзер только что зарегался по реферальной ссылке, ему создан TRIAL Subscription.

**Переменные:**
| Переменная | Описание | Пример |
|---|---|---|
| `{{pa_referral_trial_days}}` | Сколько дней триала (14 в i1, 7 в i2) | 14 |
| `{{pa_referral_trial_until}}` | До какой даты доступ | `20.05.2026 14:32` |
| `{{pa_referral_referrer_name}}` | Имя того кто пригласил | «Алексей П.» |

**Заголовок:** «Поздравляем! {{pa_referral_trial_days}} дней доступа активированы»
**Тело:**
- `{{pa_referral_referrer_name}} пригласил тебя в Academy. У тебя {{pa_referral_trial_days}} дней полного доступа до {{pa_referral_trial_until}}.`
- `Начни с диагностики — за 10 минут получишь персональный план.`
- CTA-кнопка: «Пройти диагностику» → `https://platform.mpstats.academy/diagnostic`
- Доп. CTA: «Открыть платформу» → `https://platform.mpstats.academy/dashboard`

---

### 9. `pa_referral_friend_registered` — Друг зарегался (рефереру, i1 mode) ✅

**Получатель:** реферер; пакет уже создан в `/profile/referral` со статусом PENDING.

**Переменные:**
| Переменная | Описание |
|---|---|
| `{{pa_referral_friend_name}}` | Имя нового друга |
| `{{pa_referral_package_days}}` | Сколько дней начислили (14) |

**Заголовок:** «У тебя новый друг! +{{pa_referral_package_days}} дней начислены»
**Тело:**
- `{{pa_referral_friend_name}} зарегался по твоей реферальной ссылке.`
- `Тебе начислены +{{pa_referral_package_days}} дней доступа — активируй их в личном кабинете.`
- CTA-кнопка: «Активировать пакет» → `https://platform.mpstats.academy/profile/referral`

---

### 10. `pa_referral_friend_paid` — Друг оплатил (рефереру, i2 mode) 📅 (после 01.06)

**Получатель:** реферер; в i2-режиме пакет создаётся только когда друг оплатил подписку.

**Переменные:** те же что в #9.

**Заголовок:** «Твой друг оплатил подписку — +{{pa_referral_package_days}} дней тебе»
**Тело:**
- `{{pa_referral_friend_name}} оплатил подписку — спасибо что приглашаешь!`
- `Тебе начислены +{{pa_referral_package_days}} дней доступа.`
- CTA-кнопка: «Активировать пакет» → `https://platform.mpstats.academy/profile/referral`

---

## Часть C — Доделка Phase 33

### 11. `pa_email_change` — Подтверждение нового email (пропущено в Phase 33-03) ⚠️

**Получатель:** юзер, которому саппорт инициировал смену email через Supabase Admin API (без auto-confirm). Self-service смены email в UI нет — `/profile` показывает email read-only с подсказкой «напишите в поддержку».

**Сценарий:** юзер пишет в support → саппорт меняет email через Admin → Supabase шлёт webhook на наш `/api/webhooks/supabase-email` → стреляет `pa_email_change` на новый адрес → юзер подтверждает кликом.

**Переменные** (уже выставляются в коде):
| Переменная | Описание |
|---|---|
| `{{pa_new_email}}` | Новый email который надо подтвердить |
| `{{pa_confirm_url}}` | Ссылка подтверждения (`/auth/confirm?token_hash=...`) |

**Заголовок:** «Подтвердите новую почту в Academy»
**Тело:**
- `По запросу в поддержку для вашего аккаунта Academy инициирована смена email на {{pa_new_email}}.`
- `Для подтверждения нового адреса нажмите на кнопку ниже. Ссылка действительна 24 часа.`
- CTA-кнопка: «Подтвердить новый email» → `{{pa_confirm_url}}`
- Footer: `Если вы не обращались в поддержку и не запрашивали смену — напишите нам на support@mpstats.academy. Это может означать что кто-то получил несанкционированный доступ к аккаунту.`

---

## Сводная таблица для Carrot Quest

| # | CQ event | Phase | Получатель | Когда | Переменные | Шаблон в CQ |
|---|---|---|---|---|---|---|
| 1 | `pa_notif_comment_reply` | 51 | Автор коммента | На ответ другого юзера | `pa_notif_preview, pa_notif_cta_url, pa_notif_lesson_title, pa_notif_author_name` | ❌ TBD |
| 2 | `pa_notif_admin_comment_reply` | 52 | Автор коммента | На ответ админа | те же | ❌ TBD |
| 3 | `pa_notif_content_update` | 52 | Изучающий курс | Новый урок в курсе | `pa_notif_*, pa_notif_course_title, pa_notif_items_count, pa_notif_items_text` | ❌ TBD |
| 4 | `pa_notif_progress_nudge` | 53 | Юзер | 72ч простоя на уроке | `pa_notif_*, pa_notif_lesson_title` | ❌ TBD |
| 5 | `pa_notif_inactivity_return` | 53 | Юзер с подпиской | 14 дней без визита | `pa_notif_*, pa_notif_days_inactive` | ❌ TBD |
| 6 | `pa_notif_weekly_digest` | 53 | opt-in | Пятница 10:00 | `pa_notif_*, pa_notif_new_lessons_count, pa_notif_activity_count` | ❌ TBD |
| 7 | `pa_notif_broadcast` | 54 | Сегмент | Админская рассылка | `pa_notif_*, pa_notif_title, pa_notif_body, pa_notif_cta_text` | ❌ TBD |
| 8 | `pa_referral_trial_started` | 53A | Новый юзер | Регистрация по `?ref=` | `pa_referral_trial_days, pa_referral_trial_until, pa_referral_referrer_name` | ❌ TBD |
| 9 | `pa_referral_friend_registered` | 53A | Реферер | Друг зарегался (i1) | `pa_referral_friend_name, pa_referral_package_days` | ❌ TBD |
| 10 | `pa_referral_friend_paid` | 53A | Реферер | Друг оплатил (i2) | те же | ❌ TBD |
| 11 | `pa_email_change` | 33 | Юзер | Смена email в профиле | `pa_new_email, pa_confirm_url` | ❌ TBD |

**Всего шаблонов под верстку: 11**

---

## Инструкция для CQ-команды

1. Создать 11 HTML-шаблонов в брендинге Academy 4.0 (см. `Мастер-шаблон Academy 4.0/`).
2. Все CTA-ссылки строить как `https://platform.mpstats.academy{{...путь...}}` где путь — относительный из `pa_notif_cta_url` или абсолютный из `pa_referral_*`.
3. Создать 11 automation rules в дашборде CQ:
   - Trigger: соответствующий `pa_*` event
   - Action: «Отправить email» с привязкой к шаблону
   - Условие доставки: lead-property `email` существует
4. Для `pa_notif_*` событий: lead-properties уже выставляются нашим backend'ом до trigger event'а. В preview-режиме CQ можно вручную задать тестовые значения.
5. Для `pa_notif_broadcast`: учитывать что title/body динамические — preview покажет placeholder, реальный текст — у юзера на lead'е во время рассылки.
6. После загрузки шаблонов отписаться в этом тикете — мы прогоним E2E тестовое событие на staging аккаунте.

---

## Open issues

- **`pause_token` для `pa_notif_progress_nudge`**: сейчас в коде не генерится. Добавим в Phase 53 (retention engine) — token-link для one-click паузы на 30 дней.
- **`pa_notif_broadcast` preview**: title/body динамические per-broadcast. CQ template должен показывать `{{pa_notif_title}}` буквально.
- **i2 переключение реферальной программы**: 01.06.2026, Егор переключит DB feature flag `referral_pay_gated=true` + `NEXT_PUBLIC_REFERRAL_PAY_GATED=true` в env. До этой даты `pa_referral_friend_paid` НЕ стреляет (всегда i1).
