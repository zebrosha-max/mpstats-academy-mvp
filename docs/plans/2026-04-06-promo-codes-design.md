# Промо-коды: Дизайн-документ

**Дата:** 2026-04-06
**Фаза:** 44

## Цель

Функционал промо-кодов для выдачи бесплатного доступа к платформе (партнёрства с банками, маркетинговые акции, tripwire-курсы).

## Ключевые решения

| Решение | Выбор | Причина |
|---------|-------|---------|
| Тип доступа | PLATFORM + COURSE | Зеркалит billing, нужно для tripwire-курсов |
| Активация подписки | В обход CloudPayments | Промо = подарок, не нужна привязка карты |
| Место ввода кода | /pricing | Естественный flow, одно место ввода |
| Авторизация | Хедер на /pricing | Кнопка "Войти" / аватар профиля |

## Новые модели БД

```prisma
model PromoCode {
  id            String    @id @default(cuid())
  code          String    @unique          // "BANK-2026-XXXX"
  planType      PlanType                   // PLATFORM или COURSE
  courseId      String?                    // null для PLATFORM
  durationDays  Int                        // 30, 14, 7...
  maxUses       Int       @default(1)      // сколько раз можно активировать
  currentUses   Int       @default(0)
  expiresAt     DateTime?                  // дедлайн промо-акции (null = бессрочный)
  isActive      Boolean   @default(true)
  createdBy     String                     // adminId кто создал
  createdAt     DateTime  @default(now())

  course        Course?   @relation(fields: [courseId], references: [id])
  activations   PromoActivation[]
}

model PromoActivation {
  id              String       @id @default(cuid())
  promoCodeId     String
  userId          String
  subscriptionId  String       @unique
  activatedAt     DateTime     @default(now())

  promoCode       PromoCode    @relation(fields: [promoCodeId], references: [id])
  user            UserProfile  @relation(fields: [userId], references: [id])
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])

  @@unique([promoCodeId, userId])  // один код = один раз на юзера
}
```

**Изменение Subscription:** добавить `promoCodeId String?` + relation к PromoCode.

## Логика активации

```
activatePromoCode(code: string)
│
├─ 1. Найти PromoCode по code
│     └─ Не найден или !isActive → "Промо-код не найден"
│
├─ 2. Проверить expiresAt
│     └─ Просрочен → "Срок действия промо-кода истёк"
│
├─ 3. Проверить currentUses < maxUses
│     └─ Исчерпан → "Промо-код уже использован"
│
├─ 4. Проверить @@unique(promoCodeId, userId)
│     └─ Уже активировал → "Вы уже использовали этот промо-код"
│
├─ 5. Проверить нет ли активной подписки того же типа
│     └─ Есть ACTIVE PLATFORM → "У вас уже есть активная подписка"
│     └─ Есть ACTIVE COURSE на тот же курс → "У вас уже есть доступ к этому курсу"
│
├─ 6. В транзакции:
│     ├─ Создать Subscription (ACTIVE, durationDays, promoCodeId)
│     ├─ Создать PromoActivation
│     └─ Инкрементировать currentUses
│
└─ 7. CQ событие pa_promo_activated
```

## Админка

**Новая вкладка "Промо-коды"** (ADMIN + SUPERADMIN):

**Таблица:**
| Код | Тип | Длительность | Использований | Истекает | Статус |
|-----|-----|-------------|---------------|----------|--------|
| BANK-2026-Q2 | PLATFORM | 30 дней | 47/500 | 30.06.2026 | Активен |
| GIFT-XKCD42 | COURSE (WB) | 14 дней | 1/1 | — | Использован |

**Форма создания:**
- Тип доступа: PLATFORM / COURSE (+ выбор курса)
- Длительность: пресеты 7/14/30 + ручной ввод
- Макс. активаций: 1 (индивидуальный) / N (массовый)
- Срок действия акции: дата или бессрочный
- Код: автогенерация (PROMO-XXXXX) или ручной ввод

**Действия:** деактивировать, просмотр активаций.

**Процедуры:** getPromoCodes, createPromoCode, deactivatePromoCode, getPromoActivations.

## Фронтенд

### Хедер на /pricing
- Общий хедер с auth-состоянием (логотип, "Войти" / аватар)
- Используем серверный `getUser()` из Supabase

### Блок промо-кода на /pricing
- Под тарифами: "Есть промо-код?" (раскрывающееся поле)
- Не авторизован → при нажатии "Активировать" редирект на `/login?redirect=/pricing&promo=КОД`
- Авторизован → активация, toast + редирект на /dashboard
- После логина: /pricing читает `?promo=` из URL, подставляет код

### Промо-подписка в профиле
- Бейдж "Промо" вместо "Активна"
- "Промо-доступ · Полная платформа · до 06.05.2026"
- Нет кнопки "Отменить"

## Затрагиваемые файлы

**Новые:**
- `packages/api/src/routers/promo.ts` — tRPC роутер
- `apps/web/src/app/(admin)/admin/promo/page.tsx` — админка промо-кодов
- `apps/web/src/components/pricing/PromoCodeInput.tsx` — компонент ввода

**Изменения:**
- `packages/db/prisma/schema.prisma` — PromoCode, PromoActivation, Subscription.promoCodeId
- `apps/web/src/app/pricing/page.tsx` — хедер + блок промо-кода
- `apps/web/src/app/(main)/profile/page.tsx` — отображение промо-подписки
- `apps/web/src/app/(admin)/admin/layout.tsx` — таб "Промо-коды"
- `packages/api/src/root.ts` — подключить promo роутер
- `packages/api/src/routers/admin.ts` — 4 процедуры промо-кодов

**CQ события:**
- `pa_promo_activated` (code, planType, durationDays)

## Тесты
- Unit: валидация промо-кода (все 5 проверок), создание подписки
- E2E: полный flow активации на /pricing
