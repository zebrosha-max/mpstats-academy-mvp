# Phase 53A — Referral Program (External Flow) · Design Spec

**Date:** 2026-05-04
**Status:** Approved (pending user spec review)
**Source brief:** `D:/GpT_docs/Egor_tasks/15.04.26 Маркетинговая стратегия платформы/REFERRAL_PROGRAM.md` (draft v1, 2026-04-15)
**Workflow:** Superpowers (brainstorming → writing-plans → executing-plans).

## Goal

Запустить пользовательскую реферальную программу: каждый юзер с подтверждённым аккаунтом (DOI или Yandex OAuth) получает уникальный `REF-*` код, может пригласить друга, друг получает trial-доступ к Платформе на 14 дней (i1) или 7 дней (i2), реферер получает накопительные «пакеты» по 14 дней, которые активирует вручную в личном кабинете.

Фаза реализует **обе итерации (i1 и i2)** в одном коде, переключение режима — через feature flag `referral_iteration` без деплоя:

- **Iteration 1 (i1, май 2026)**: пакет рефереру выдаётся в момент **регистрации** друга (DOI/OAuth confirmed). Цель — агрессивный рост testbase 140 → больше за май. Анти-фрод минимальный, экстремумы — ручная модерация.
- **Iteration 2 (i2, июнь+, permanent)**: пакет рефереру выдаётся только **после оплаты** другом первой подписки. Friend trial сокращается с 14 до 7 дней.

## Non-goals (deferred)

- **53B** — отдельная фаза не требуется: i2 включается флагом, эмитим её в этой же фазе. Если позже понадобится дописать UI или email-цепочку под i2 — делается отдельным мини-плагином.
- **53C** — внутренние коды `CARE-*` / `SALES-*` / `CON-*` / `GO-*` (трекинг сотрудников) — отдельная фаза после 53A. Не блокирует запуск пользовательской программы в мае.
- **Email-цепочка триала** (welcome other, 2-day-before-expire reminder, etc.) — события будем эмитить из кода уже сейчас, CQ rules настраиваются параллельно командой CarrotQuest. Не блокер релиза.
- **Cap-аннулирования пакета** через 180 дней неиспользования — boевая v2.
- **Leaderboard, public share-feed, CSV экспорт админу** — P2 в original brief.
- **Lending-preland для входа по реф-ссылке** — сразу на `/register?ref=`, без отдельной страницы.

## Decisions (locked)

### D1. Trial Subscription mechanism

Расширяем существующий enum:
```ts
enum SubscriptionStatus {
  active
  trial   // ← NEW
  past_due
  cancelled
  expired
}
```

Все paywall-проверки расширяем с `status === 'active'` до `(status === 'active' || status === 'trial')`. По истечении `periodEnd` cron `check-subscriptions` переводит trial → expired (тот же путь что paid).

Если друг во время трIала оплачивает: создаётся новая `Subscription` со `status='active'` через CP webhook, старая trial-запись помечается `status='cancelled'` (как существующий cancel flow). Один юзер — одна активная Subscription в любой момент.

### D2. Friend conversion gate

Friend засчитан рефереру при выполнении любого из:
- DOI прошёл (email registration → email confirmation link clicked)
- Yandex OAuth callback успешный (verified email)

**Не засчитан:** simple registration без DOI, кликнул по ссылке но не зарегистрировался.

### D3. Package model

Каждый зачёт = один объект `ReferralBonusPackage`:
```
{
  id, ownerUserId, sourceReferralId, days: 14,
  issuedAt, usedAt, status: PENDING | USED | REVOKED
}
```

Активация — атомарная операция, по одному пакету за клик. Bulk-активация запрещена. После активации `usedAt=now, status=USED`. Повторная активация невозможна.

Auto-expire пакетов в этой фазе не реализуется (отложено до boевой v2 — будет 180 дней).

### D4. Iteration switching

Feature flag в существующей таблице `FeatureFlag` (Phase 16):
```
key: 'referral_iteration'
value: 'i1' | 'i2'   (string)
default: 'i1'
```

Переключение — `UPDATE` строки руками через `/admin/settings` или прямой SQL. Никакого hardcoded date.

В коде flag читается через существующий `getFeatureFlag()` helper (Phase 16). Кешируется на запрос; cache invalidation тривиальная (rare flip).

### D5. Backfill для существующих юзеров

Миграция:
1. Добавить `UserProfile.referralCode String? @unique`.
2. Bulk-update — для каждого `UserProfile`, у которого `auth.users.email_confirmed_at IS NOT NULL` (DOI пройден) → сгенерировать `REF-` + 6 base32 chars (alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, без вводящих в заблуждение `I/L/O/0/1`), retry-on-collision.
3. Для нового юзера — код генерится в `auth/confirm` route (после DOI) либо в Yandex callback.

Все ~140 текущих DOI-confirmed юзеров получают коды миграцией. Юзеры без DOI (зарегистрированы но не подтвердили email) — не получают, увидят раздел только после DOI.

### D6. Existing-user gate

Если по `?ref=` приходит юзер, у которого `auth.users.email` уже существует в БД (даже с другим UUID после reset?), не создавать второй аккаунт — стандартное поведение Supabase auth (unique email constraint).

Если кто-то логин-аутом и регится новым email через ту же ссылку — реальный фрод-кейс, не блокируем (см. D7), мониторим экстремумы вручную.

### D7. Anti-fraud (i1)

Минимальный набор автоматических защит:

1. **Self-ref guard:** при попытке зарегистрироваться по своему же `REF-*` коду (referrer.userId === friend.userId либо совпадение email из `auth.users` referrer'а) → `Referral { status='BLOCKED_SELF_REF' }`, пакет НЕ выдаётся, friend получает trial всё равно (не его вина что лажанул, опыт не должен ломаться).

2. **Cap 5 friends/неделя:** если у реферера за последние 7 дней (rolling) уже ≥5 зачётов — новые `Referral` пишутся со статусом `PENDING_REVIEW`, пакет не выдаётся, ждёт ручной модерации. Friend trial всё равно создаётся.

3. **Sentry alert:** на каждый `BLOCKED_SELF_REF` или достижение cap → `Sentry.captureMessage('referral.fraud_signal', { level: 'info', extra: {...} })`. Мониторим выявление экстремумов.

4. **Уникальный email** — из коробки в `auth.users`.

Никакого fingerprinting, IP-checks, throttling по cookies. Принимаем баланс «фрод-дыры в i1 vs скорость роста».

### D8. Click-source attribution window

Cookie `referral_code` ставится HttpOnly, SameSite=Lax, TTL 30 дней. Если юзер пришёл по `?ref=A` и через неделю по `?ref=B` — последняя выигрывает (cookie перезаписывается). При успешной DOI/OAuth — cookie вычитывается, потом удаляется.

### D9. Trial replacement on paid

Когда trial-юзер платит первый раз через CP webhook `pay`:
1. Старая trial Subscription → `cancelled`.
2. Новая Subscription → `active` со стандартным `periodEnd` от CP.
3. **В режиме i2:** дополнительно ищем `Referral { referredUserId=friend, status='PENDING' }` → mark `CONVERTED, convertedAt=now` → создаём `ReferralBonusPackage { ownerUserId=referrer }`.

### D10. UI placement

Новый таб «Рефералка» в существующей странице `/profile` (рядом с табами «Профиль», «Подписка», «Уведомления»). Внутри:
- Моя ссылка (HTML inline copy button)
- Счётчик: приведено друзей · оплатили · накопленных пакетов
- Список PENDING пакетов с кнопкой «Активировать +14 дней» на каждом
- История USED пакетов с датой активации и connection с другом (имя если есть consent, иначе anonymized)
- Текст с правилами (динамически по флагу: «За регистрацию друга» в i1, «За оплату друга» в i2)

## Architecture

### File layout

```
packages/db/prisma/schema.prisma           # MIGRATE: enum + Referral + ReferralBonusPackage + UserProfile.referralCode

packages/api/src/routers/
└── referral.ts                            # NEW tRPC router:
                                           #   - getMyState (code, counters, packages)
                                           #   - activatePackage(packageId)
                                           #   - validateCode(code) — for register page

apps/web/src/lib/referral/
├── code-generator.ts                      # NEW: REF-* generation w/ collision retry
├── activation.ts                          # NEW: pure logic for package activation (testable)
├── attribution.ts                         # NEW: cookie read/write, validation
└── fraud-checks.ts                        # NEW: self-ref + cap-rate-limit

apps/web/src/middleware.ts                 # MODIFY: parse ?ref= → set cookie

apps/web/src/app/auth/confirm/route.ts     # MODIFY: hook for i1/i2 — issue Referral + Package + Trial
apps/web/src/app/api/auth/yandex/callback/route.ts  # MODIFY: same hook for OAuth path

apps/web/src/app/api/webhooks/cloudpayments/route.ts # MODIFY: i2 trigger — find PENDING Referral, issue package

apps/web/src/app/(main)/profile/
├── referral/page.tsx                      # NEW: profile referral tab
└── _components/
    ├── ReferralCodeBlock.tsx              # NEW: code + copy button
    ├── PackageList.tsx                    # NEW: PENDING + USED lists
    └── ActivatePackageButton.tsx          # NEW: optimistic activation

apps/web/src/app/(auth)/register/page.tsx  # MODIFY: read cookie, show inline banner if valid ref code

packages/api/src/services/billing/
└── trial-subscription.ts                  # NEW: createTrialSubscription, replaceTrialOnPay
```

### Data flow — i1 happy path

```
Referrer copies REF-X7K2P1 from /profile/referral
  ↓
Friend clicks https://platform.mpstats.academy/?ref=REF-X7K2P1
  ↓
middleware.ts: validate code (validateCode tRPC, server-side via fetch)
  → if valid: set cookie {referral_code: 'REF-X7K2P1'}, ttl 30d
  → continue render homepage as usual
  ↓
Friend goes to /register, sees inline banner
  "Тебе подарили 14 дней бесплатного доступа к Платформе"  (text varies by i1/i2)
  ↓
Friend submits registration → Supabase signUp → DOI link emailed
  ↓
Friend clicks DOI link → /auth/confirm route
  → verifyOtp (existing Phase 50 logic)
  → NEW: read cookie referral_code, lookup UserProfile by code
    → fraud-checks: self-ref? referrer cap exceeded? blocked email?
    → ok: prisma.$transaction([
        Referral.create({status: 'CONVERTED', trigger: 'registration'}),
        ReferralBonusPackage.create({owner: referrer.id, days: 14, status: 'PENDING'}),
        Subscription.create({user: friend.id, status: 'trial', tier: 'PLATFORM', periodEnd: now+14d}),
      ])
    → emit CQ event pa_referral_trial_started (friend), pa_referral_friend_registered (referrer)
  → clear cookie
  → redirect /learn (как обычно)
  ↓
Referrer at next visit /profile/referral sees +1 PENDING package
  ↓
Click "Активировать +14 дней" → tRPC referral.activatePackage(id)
  → activation.ts pure function:
    if currentSub active/trial: periodEnd += 14d
    if no sub or expired: create new trial 14d
  → mark package USED
  → emit pa_referral_package_activated
```

### Data flow — i2 happy path

Identical через шаг «Friend clicks DOI». Разница в `/auth/confirm` хуке:
- В i2 mode: создаём `Referral { status='PENDING' }`, **не создаём** `ReferralBonusPackage` (это произойдёт после оплаты).
- Создаём trial Subscription на **7** дней, не 14.

CP webhook `pay` для friend:
- Standard subscription creation (existing flow).
- NEW: ищем `Referral { referredUserId=friend, status='PENDING' }`. Если есть → mark `CONVERTED, convertedAt=now`, создаём пакет рефереру, эмитим `pa_referral_friend_paid`.

### `activatePackage` pseudocode

```ts
async function activatePackage(packageId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const pkg = await tx.referralBonusPackage.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.ownerUserId !== userId || pkg.status !== 'PENDING') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Package unavailable' });
    }

    const sub = await tx.subscription.findFirst({
      where: { userId, status: { in: ['active', 'trial'] } },
      orderBy: { periodEnd: 'desc' },
    });

    if (sub && sub.periodEnd > new Date()) {
      // Extend existing
      await tx.subscription.update({
        where: { id: sub.id },
        data: { periodEnd: new Date(sub.periodEnd.getTime() + pkg.days * 86400_000) },
      });
    } else {
      // Create fresh trial
      await tx.subscription.create({
        data: {
          userId,
          status: 'trial',
          tier: 'PLATFORM',
          periodEnd: new Date(Date.now() + pkg.days * 86400_000),
          // ... other defaults
        },
      });
    }

    await tx.referralBonusPackage.update({
      where: { id: packageId },
      data: { usedAt: new Date(), status: 'USED' },
    });
  });
}
```

### Anti-fraud checks (in `/auth/confirm` hook)

```ts
async function shouldIssuePackage(referrerId: string, friendId: string) {
  // 1. Self-ref by userId
  if (referrerId === friendId) return { issue: false, reason: 'BLOCKED_SELF_REF' };

  // 2. Self-ref by email
  const [referrer, friend] = await Promise.all([
    supabase.auth.admin.getUserById(referrerId),
    supabase.auth.admin.getUserById(friendId),
  ]);
  if (referrer?.email === friend?.email) {
    return { issue: false, reason: 'BLOCKED_SELF_REF' };
  }

  // 3. Cap 5/week — count Referral rows, не Package, чтобы работало и в i2
  // (где пакета нет до оплаты, но cap всё равно действует на стадии регистрации)
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const recentCount = await prisma.referral.count({
    where: {
      referrerUserId: referrerId,
      createdAt: { gt: weekAgo },
      status: { notIn: ['BLOCKED_SELF_REF'] },
    },
  });
  if (recentCount >= 5) {
    return { issue: false, reason: 'PENDING_REVIEW' };
  }

  return { issue: true };
}
```

### REF code generation

```ts
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I L O 0 1
function generateRefCode(): string {
  const chars = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  return `REF-${chars.join('')}`;
}

async function generateUniqueRefCode(maxRetries = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateRefCode();
    const exists = await prisma.userProfile.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  throw new Error('Could not generate unique ref code after retries');
}
```

`UserProfile.referralCode` имеет `@unique` constraint, plus retry на коллизию (вероятность с 30^6 ≈ 730M комбинаций при 100K юзеров — ~0.013% коллизия). 5 попыток покрывают.

### Backfill migration

Скрипт `scripts/backfill-referral-codes.ts`:
```ts
const users = await prisma.userProfile.findMany({
  where: { referralCode: null },
  select: { id: true },
});
for (const user of users) {
  // Check DOI confirmed via Supabase admin API (or skip — assume all UserProfile rows = DOI'd)
  const code = await generateUniqueRefCode();
  await prisma.userProfile.update({ where: { id: user.id }, data: { referralCode: code } });
}
```

Запускается один раз в проде после деплоя миграции. Идемпотентен — повторный запуск пропустит уже размеченных.

## Edge cases

### EC1. Friend регистрируется БЕЗ ?ref= cookie (no referral)
Стандартный flow без изменений. Никакого пакета, никакого Referral row. Trial subscription тоже не создаётся — friend идёт в paywall как обычный нерефералный юзер.

### EC2. Friend регистрируется по ?ref=, но уже **существует** аккаунт с этим email
Supabase signUp возвращает «existing user» error. Никаких side effects. UI показывает «такой аккаунт уже есть, войдите».

### EC3. Friend регистрируется, не активирует DOI 24 часа
Cookie `referral_code` остаётся в браузере (TTL 30d). Если друг через неделю всё-таки кликнет DOI — хук срабатывает, всё ок. Если друг забивает — `Referral` row не создаётся, `auth.users.email_confirmed_at IS NULL`, нет события.

### EC4. Реферер делитом аккаунт после регистрации друга
Каскад: при удалении `UserProfile`-реферера `Referral.referrerUserId` → `ON DELETE SET NULL` (referrer становится null), пакеты пользователя удаляются (`ON DELETE CASCADE`). Никаких orphan'ов. Friend свой trial сохраняет.

### EC5. Реферер активирует пакет, у него СЕЙЧАС cancelled подписка с periodEnd в прошлом
По логике `activatePackage`: подписка с `status='cancelled'` не попадает в фильтр `{ status: { in: ['active', 'trial'] } }` → создаётся новая trial PLATFORM на 14d с now. Это может выглядеть странно для юзера который раньше платил. Решение: text в UI делает явным «Активируется новый 14-дневный триал PLATFORM с сегодня».

### EC6. Friend активирует свою trial-подписку и сразу платит за COURSE-уровень
По D9: trial cancelled, новая active Subscription PLATFORM или COURSE как заказал. Если COURSE — friend теряет PLATFORM-уровень доступа (был на trial), но получил то за что заплатил. CP webhook `pay` обрабатывается без особых хитростей.

В i2: при оплате friend → реферер получает пакет. Если friend оплатил COURSE — пакет всё равно выдаётся (любая first paid subscription = конверсия).

### EC7. Multiple referrer codes within session (multi-tab)
Cookie перезаписывается last-write-wins. Только последний `?ref=` кладётся. Никакого split.

### EC8. Existing user (logged-out) кликает по `?ref=`, заходит в /register, видит «уже зарегистрированы»
Cookie `referral_code` остаётся. Если потом этот юзер логинится — никакого зачёта (его аккаунт уже existed, не «приглашённый»). Cookie expired через 30d или будет затёрт следующим ?ref. OK to leave.

## Tests

### Unit (Vitest)

**`code-generator.test.ts`** (3 cases):
1. Generates code in correct format `REF-` + 6 chars from alphabet.
2. Excludes ambiguous characters (no I, L, O, 0, 1).
3. Retries on collision, throws after maxRetries.

**`activation.test.ts`** (5 cases):
1. Active paid sub: periodEnd extends by 14d, package marked USED.
2. Active trial sub: periodEnd extends by 14d.
3. No active sub (cancelled past): new trial 14d created.
4. No subscription record at all: new trial 14d created.
5. Package already USED: throws BAD_REQUEST.

**`fraud-checks.test.ts`** (4 cases):
1. Self-ref by userId → returns BLOCKED_SELF_REF.
2. Self-ref by email → returns BLOCKED_SELF_REF.
3. Cap reached (5 in 7 days) → returns PENDING_REVIEW.
4. All clean → returns issue=true.

**`attribution.test.ts`** (3 cases):
1. Set cookie on valid ?ref= → cookie present with correct value.
2. Read cookie → returns code or null.
3. Clear cookie after consume → cookie absent.

### Integration

**`referral-flow.integration.test.ts`** (4 cases):
1. i1 mode: full flow registration → Referral + Package + Trial all created.
2. i1 mode: self-ref blocked → trial created but no Referral, no Package.
3. i2 mode: registration → Referral PENDING + Trial 7d, no Package.
4. i2 mode: friend pays → Referral CONVERTED + Package issued.

### E2E (env-gated)

`tests/e2e/phase-53a-referral.spec.ts`:
1. Login as test user A → copy ref code from /profile/referral.
2. Logout → visit /?ref=CODE → register as new user B with email signup → confirm DOI link.
3. Login as B → confirm trial subscription is active.
4. Login as A → see +1 PENDING package → click activate → confirm subscription extended/created.

## Risks

### R1. Trial subscription mechanism — широкая поверхность change
Новый enum-значение `trial` затрагивает все paywall-проверки, потенциально 20+ мест в коде. Риск: пропустить место → trial-юзер ходит в платный контент или, наоборот, не ходит.

**Митигация:** grep по `status === 'active'` и `status: 'active'` в начале фазы, составить полный список мест, обновить все за один проход. Тесты на trial-доступ к разным разделам.

### R2. Backfill ~140 кодов сразу — DB lock concern
Update 140 строк — мгновенно на Postgres. Риск минимальный.

### R3. Self-ref by email check requires Supabase admin API call
В hook `/auth/confirm` мы пишем 2x `supabase.auth.admin.getUserById` — добавляет latency. Допустимо (DOI уже не на горячем пути).

### R4. CP webhook integration в i2
`pa_referral_friend_paid` event: нужно встроить в существующий webhook handler `/api/webhooks/cloudpayments` без поломки idempotency. Риск: повторный webhook → повторный пакет рефереру.

**Митигация:** unique constraint на `Referral.referredUserId` + check `status === 'PENDING'` перед conversion. Повторный webhook увидит CONVERTED → no-op.

### R5. Cookie referral_code persistence
HttpOnly cookie не доступен JavaScript, но если пользователь чистит cookies — теряем атрибуцию. Принимаем как ожидаемое поведение.

### R6. Feature flag `referral_iteration` — race condition при flip
Если переключаем `i1 → i2` в момент когда юзер прошёл DOI: hook читает `i1`, создаёт пакет. Юзер в это же время — hook читает `i2`, не создаёт. Боли нет — система consistent для каждого индивидуального flow. Не митигируем.

## Success criteria

1. Все 140 текущих DOI-confirmed юзеров получают `REF-*` код миграцией. Проверка: `SELECT count(*) FROM "UserProfile" WHERE referral_code IS NOT NULL` ≈ 140.
2. Друг с `?ref=` регистрируется → DOI confirmed → у реферера в `/profile/referral` появляется +1 PENDING пакет (i1) или +1 PENDING Referral (i2).
3. Реферер активирует пакет → подписка PLATFORM extended на 14d, либо новый trial PLATFORM на 14d создан.
4. Self-ref попытка (тот же email через `?ref=` своего кода) → trial создан (другу), но пакет реферер НЕ получает.
5. ≥5 рефералов за 7 дней → 6-й идёт в `PENDING_REVIEW`, не выдаёт пакет автоматически.
6. Переключение `referral_iteration` через `UPDATE FeatureFlag SET value='i2'` — следующая регистрация не выдаёт пакет до оплаты.
7. CP webhook `pay` для друга в i2 mode → `Referral.status='CONVERTED'`, пакет рефереру выдан.
8. Все CQ events эмитятся (даже без настроенных правил со стороны CQ): `pa_referral_trial_started`, `pa_referral_friend_registered` (i1) / `pa_referral_friend_paid` (i2), `pa_referral_package_activated`.

## Open questions for implementation

1. **Schema location of FeatureFlag for referral_iteration:** есть ли нужная таблица в БД, или придётся добавить запись через seed? — проверить в коде Phase 16 на этапе миграции.
2. **Subscription tier enum** — в текущей `Subscription` модели есть `tier` поле или плановое отображение (`COURSE` / `PLATFORM` через `SubscriptionPlan` foreign key)? — узнаем при первой задаче, скорее всего FK на `SubscriptionPlan`.
3. **Referral codeType enum в этой фазе** — только `EXTERNAL_USER` нужен, остальные значения (`INTERNAL_*`) добавить «впрок» с placeholder'ами или ждать 53C? — лучше «впрок», т.к. enum с миграцией дешёвый.
4. **Профиль страница layout** — сейчас `/profile` имеет табы или одностраничный layout? — посмотрим при первой UI задаче.
5. **Authorization для `referral.activatePackage`** — protectedProcedure (юзер сам активирует свои пакеты). Дополнительная проверка ownership внутри транзакции (см. pseudocode).

---

**Next step:** invoke `superpowers:writing-plans` to break this design into atomic implementation tasks.
