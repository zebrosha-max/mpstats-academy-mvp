# Phase 20: Paywall + Content Gating - Research

**Researched:** 2026-03-12
**Domain:** Content access control, subscription-based gating, tRPC middleware patterns
**Confidence:** HIGH

## Summary

Phase 20 implements content gating for the MAAL platform: blocking paid lessons behind a subscription paywall while keeping the first 2 lessons per course free. The existing billing infrastructure (Phase 16-19) provides all subscription data models and feature flags needed. The core work is a centralized access check service in tRPC that determines whether a user can access a given lesson, plus frontend lock UI components.

The architecture is straightforward: a utility function `checkLessonAccess()` queries the user's subscriptions and the lesson's order within its course, returning `{ hasAccess: boolean, reason: string }`. This function is called from existing tRPC procedures (`getLesson`, `getCourses`, `getPath`) to annotate responses with `locked` flags. Frontend components conditionally render lock UI or full content based on these flags.

**Primary recommendation:** Build a single `checkLessonAccess(userId, lessonId, prisma)` utility in `packages/api/src/utils/access.ts` that encapsulates all gating logic (feature flag check, free lesson threshold, subscription status, COURSE vs PLATFORM type). Call it from existing learning router procedures -- do NOT create a separate middleware or new router.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Первые 2 урока каждого курса (order=1, order=2) бесплатны автоматически -- без ручной настройки
- Бесплатный урок = полный опыт: видео + AI Summary + Chat + таймкоды -- без ограничений
- Регистрация обязательна для просмотра любых уроков (включая бесплатные) -- protectedProcedure сохраняется
- На бесплатных уроках -- мягкий баннер под видео: "Вам доступно ещё N уроков -- оформите подписку" с CTA -> /pricing
- Вместо видео -- блок с замком, названием урока и CTA "Оформить подписку" -> /pricing
- Название и описание урока видны, AI панель (Summary + Chat) скрыта
- Навигация prev/next работает -- можно листать между залоченными уроками
- Прямой URL на залоченный урок -> показывает lock UI (не редирект)
- Все уроки видны в каталоге, платные помечены иконкой замка на LessonCard
- LessonCard с замком кликабельна -- открывает страницу урока с lock UI
- Под курсом (после бесплатных уроков) -- мини-баннер "Ещё N уроков доступны по подписке -> /pricing"
- COURSE-подписка: все уроки купленного курса открыты. В других курсах -- превью (первые 2) + замки
- PLATFORM-подписка: все уроки всех курсов открыты + персональный трек "Мой трек"
- Диагностика бесплатна всем независимо от подписки
- Персональный трек "Мой трек" = фича PLATFORM: без подписки -- превью (первые 3 урока трека видны, остальные blur + CTA)
- Таб "Мой трек" на /learn виден всегда (если диагностика пройдена), но без PLATFORM показывает превью + CTA
- При billing_enabled=false: весь контент доступен без ограничений, замки не показываются, баннеры скрыты
- Централизованный access service в tRPC (не middleware) -- Edge Runtime не может использовать Prisma
- При покупке PLATFORM -- существующие COURSE-подписки автоматически отменяются
- Множественные COURSE-подписки на разные курсы разрешены

### Claude's Discretion
- Точный дизайн lock UI блока (цвета, иконка, размер)
- Стиль мягкого баннера на бесплатных уроках
- Стиль мини-баннера под курсом в каталоге
- Реализация blur-эффекта для превью трека
- Архитектура access service (отдельная утилита vs middleware в tRPC)

### Deferred Ideas (OUT OF SCOPE)
- Proration при апгрейде COURSE -> PLATFORM
- Автоматическая отмена COURSE при покупке PLATFORM через CP API (только локальная)
- Настраиваемое количество бесплатных уроков per-course
- AI (Summary/Chat) как отдельная premium-фича
- Уведомления о событиях подписки (Phase 22)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | Content gating -- 1-2 бесплатных урока на курс, остальные заблокированы | `checkLessonAccess()` utility checks lesson.order <= FREE_LESSON_THRESHOLD (2), subscription status (ACTIVE/CANCELLED with valid period), and plan type (COURSE vs PLATFORM) |
| PAY-03 | Lock UI на платных уроках (замки, баннер "Оформи подписку") | Frontend: `LockOverlay` component on lesson page, `locked` prop on LessonCard, upsell banners on free lessons and course listings |
| PAY-05 | Централизованный access service в tRPC (не в middleware) | `packages/api/src/utils/access.ts` with `checkLessonAccess()` called from learning router procedures; respects billing_enabled feature flag |
</phase_requirements>

## Architecture Patterns

### Access Check Flow

```
User requests lesson/course data
    |
    v
tRPC protectedProcedure (auth check -- already exists)
    |
    v
checkLessonAccess(userId, lesson, prisma)
    |
    +-- isFeatureEnabled('billing_enabled') == false? -> hasAccess: true (all open)
    |
    +-- lesson.order <= 2? -> hasAccess: true (free preview)
    |
    +-- Has ACTIVE PLATFORM subscription? -> hasAccess: true
    |
    +-- Has ACTIVE COURSE subscription for lesson.courseId? -> hasAccess: true
    |
    +-- Has CANCELLED subscription with currentPeriodEnd > now? -> hasAccess: true
    |
    +-- else -> hasAccess: false, reason: 'subscription_required'
```

### Recommended File Structure

```
packages/api/src/
├── utils/
│   ├── access.ts              # NEW: checkLessonAccess(), getUserSubscriptions()
│   └── feature-flags.ts       # EXISTS: isFeatureEnabled()
├── routers/
│   ├── learning.ts            # MODIFY: add locked field to responses
│   └── billing.ts             # EXISTS: no changes needed
apps/web/src/
├── components/
│   └── learning/
│       ├── LockOverlay.tsx        # NEW: full lock UI for lesson page
│       ├── PaywallBanner.tsx      # NEW: soft upsell banner for free lessons
│       ├── CourseLockBanner.tsx   # NEW: mini-banner under course in catalog
│       ├── TrackPreviewGate.tsx   # NEW: blur + CTA for "Мой трек" without PLATFORM
│       ├── LessonCard.tsx         # MODIFY: add locked prop, lock icon
│       └── DiagnosticGateBanner.tsx # EXISTS: reference pattern for gate banners
├── app/(main)/
│   ├── learn/
│   │   ├── page.tsx               # MODIFY: pass locked flags, add banners
│   │   └── [id]/page.tsx          # MODIFY: conditional lock UI vs video
│   └── diagnostic/
│       └── results/page.tsx       # MODIFY: track preview with blur
```

### Pattern: Access Utility (not middleware)

**What:** A pure function that checks subscription access for a lesson.
**Why not middleware:** Edge Runtime cannot use Prisma. The decision from CONTEXT.md is explicit: tRPC utility, not middleware.
**Why not a separate router:** Access checks should enrich existing data responses, not require separate API calls.

```typescript
// packages/api/src/utils/access.ts

const FREE_LESSON_THRESHOLD = 2; // lessons with order <= 2 are free

interface AccessResult {
  hasAccess: boolean;
  reason: 'free_lesson' | 'platform_subscription' | 'course_subscription' | 'billing_disabled' | 'subscription_required';
  hasPlatformSubscription: boolean;
}

export async function checkLessonAccess(
  userId: string,
  lesson: { order: number; courseId: string },
  prisma: PrismaClient
): Promise<AccessResult> {
  // 1. Check feature flag
  const billingEnabled = await isFeatureEnabled('billing_enabled');
  if (!billingEnabled) {
    return { hasAccess: true, reason: 'billing_disabled', hasPlatformSubscription: false };
  }

  // 2. Free lesson check
  if (lesson.order <= FREE_LESSON_THRESHOLD) {
    return { hasAccess: true, reason: 'free_lesson', hasPlatformSubscription: false };
  }

  // 3. Query user subscriptions (ACTIVE or CANCELLED with valid period)
  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
      status: { in: ['ACTIVE', 'CANCELLED'] },
      currentPeriodEnd: { gt: now },
    },
    include: { plan: true },
  });

  const hasPlatform = subscriptions.some(s => s.plan.type === 'PLATFORM');
  if (hasPlatform) {
    return { hasAccess: true, reason: 'platform_subscription', hasPlatformSubscription: true };
  }

  const hasCourse = subscriptions.some(
    s => s.plan.type === 'COURSE' && s.courseId === lesson.courseId
  );
  if (hasCourse) {
    return { hasAccess: true, reason: 'course_subscription', hasPlatformSubscription: false };
  }

  return { hasAccess: false, reason: 'subscription_required', hasPlatformSubscription: false };
}
```

### Pattern: Batch Access Check for Course Listings

For the `/learn` page that lists all courses with all lessons, calling `checkLessonAccess()` per-lesson would be N+1 queries. Instead, fetch subscriptions once and check in memory:

```typescript
export async function getUserActiveSubscriptions(userId: string, prisma: PrismaClient) {
  const now = new Date();
  return prisma.subscription.findMany({
    where: {
      userId,
      status: { in: ['ACTIVE', 'CANCELLED'] },
      currentPeriodEnd: { gt: now },
    },
    include: { plan: true },
  });
}

export function isLessonAccessible(
  lesson: { order: number; courseId: string },
  subscriptions: SubscriptionWithPlan[],
  billingEnabled: boolean
): boolean {
  if (!billingEnabled) return true;
  if (lesson.order <= FREE_LESSON_THRESHOLD) return true;
  if (subscriptions.some(s => s.plan.type === 'PLATFORM')) return true;
  if (subscriptions.some(s => s.plan.type === 'COURSE' && s.courseId === lesson.courseId)) return true;
  return false;
}
```

### Pattern: Enriching tRPC Responses

The `getLesson` and `getCourses` procedures already return lesson data. Add `locked: boolean` to each lesson in the response:

```typescript
// In getCourses handler, after fetching courses:
const subs = await getUserActiveSubscriptions(ctx.user.id, ctx.prisma);
const billingEnabled = await isFeatureEnabled('billing_enabled');

// Map lessons with locked flag
lessons: course.lessons.map((l) => ({
  ...existingMapping,
  locked: !isLessonAccessible(
    { order: l.order, courseId: course.id },
    subs,
    billingEnabled
  ),
})),
```

### Pattern: Conditional Content on Lesson Page

```typescript
// In lesson page component:
if (data.lesson.locked) {
  return (
    <>
      {/* Breadcrumb + Header (always visible) */}
      <LockOverlay lessonTitle={lesson.title} />
      {/* Navigation prev/next (always works) */}
    </>
  );
}
// else: render full video + AI panels
```

### Anti-Patterns to Avoid

- **Client-side only gating:** Never hide content with just CSS/JS. The tRPC response must NOT include videoId for locked lessons (or the access check must be server-side). The user could inspect network responses to get the video URL.
- **Separate access check API call:** Don't make frontend call a separate `checkAccess` endpoint. Enrich existing responses with `locked` flag.
- **Prisma in middleware:** Edge Runtime cannot use Prisma -- this is why access checks must be in tRPC procedures.
- **N+1 subscription queries:** Don't call `checkLessonAccess()` per-lesson in loops. Batch-fetch subscriptions once, then check in memory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature flag checking | Custom flag logic | `isFeatureEnabled('billing_enabled')` | Already exists, safe-default pattern |
| Subscription queries | Raw SQL | Prisma `findMany` with status/date filters | Already have model + indexes |
| Lock icon SVG | Custom SVG | Lucide `Lock` icon or inline SVG from DiagnosticGateBanner | Consistent with existing lock pattern |
| Gate banner pattern | New design from scratch | Copy `DiagnosticGateBanner.tsx` structure | Proven pattern, mp-blue gradient, same layout |
| Blur effect | Custom CSS filter | Tailwind `blur-sm` + `pointer-events-none` on blurred items | Standard Tailwind utility |

## Common Pitfalls

### Pitfall 1: VideoId Leaking in Locked Responses
**What goes wrong:** tRPC returns `videoId` for locked lessons, user extracts Kinescope embed URL from network tab.
**How to avoid:** Set `videoId: null` and `videoUrl: ''` for locked lessons in the tRPC response mapper. The access check must strip sensitive data server-side.

### Pitfall 2: CANCELLED Subscription Still Granting Access
**What goes wrong:** Treating CANCELLED as "no access" when it should have access until `currentPeriodEnd`.
**How to avoid:** The access check must include CANCELLED status with `currentPeriodEnd > now()` filter. This is already the established pattern from Phase 18.

### Pitfall 3: Feature Flag Cache Stale
**What goes wrong:** `isFeatureEnabled()` reads from DB on every request. If caching is added, toggling billing_enabled won't take effect immediately.
**How to avoid:** Current implementation has no caching (reads fresh from DB each time). Keep it this way for now -- the overhead is minimal (1 query) and correctness matters more than the microseconds saved.

### Pitfall 4: Lesson Order Assumption
**What goes wrong:** Assuming lesson `order` starts at 1. If some course has lessons starting at 0, the free threshold breaks.
**How to avoid:** Verify all courses have `order` starting at 1. The schema uses `@default(0)` but the seed data may use 1-based. Check with a query: `SELECT DISTINCT "order" FROM "Lesson" ORDER BY "order" LIMIT 5`.
**Mitigation:** Use `order <= FREE_LESSON_THRESHOLD` which handles 0-based (0,1 free) or 1-based (1,2 free) -- either gives 2 free lessons.

### Pitfall 5: Multiple COURSE Subscriptions
**What goes wrong:** User has COURSE subscription for course A and course B. Access check only finds the first one.
**How to avoid:** Use `findMany` (not `findFirst`) for subscriptions and check if ANY subscription grants access to the requested course.

### Pitfall 6: "Мой трек" Gating Complexity
**What goes wrong:** The track view mixes lessons from multiple courses. Each lesson may have different access based on per-course subscriptions.
**How to avoid:** Apply the same `isLessonAccessible()` check per-lesson in the track view. For PLATFORM gating of the track itself (preview 3 lessons + blur), this is a separate frontend concern -- the backend still returns all track lessons, frontend applies the blur based on `hasPlatformSubscription` flag.

## Code Examples

### Lock Overlay Component

```typescript
// apps/web/src/components/learning/LockOverlay.tsx
// Based on DiagnosticGateBanner pattern (gradient card with icon + CTA)

interface LockOverlayProps {
  lessonTitle: string;
}

export function LockOverlay({ lessonTitle }: LockOverlayProps) {
  return (
    <Card className="shadow-mp-card border-mp-gray-200">
      <CardContent className="py-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-6">
          {/* Lock SVG icon */}
        </div>
        <h2 className="text-heading text-mp-gray-900 mb-2">
          Урок доступен по подписке
        </h2>
        <p className="text-body text-mp-gray-500 mb-6 max-w-md mx-auto">
          Оформите подписку, чтобы получить доступ к этому и другим урокам
        </p>
        <Link href="/pricing">
          <Button size="lg">Оформить подписку</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

### Soft Upsell Banner (Free Lessons)

```typescript
// Muted banner, does not interrupt viewing
interface PaywallBannerProps {
  remainingFreeCount: number;
}

export function PaywallBanner({ remainingFreeCount }: PaywallBannerProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-mp-blue-50 border border-mp-blue-100 rounded-lg">
      <p className="text-body-sm text-mp-blue-700">
        Вам доступно ещё {remainingFreeCount} бесплатных уроков в этом курсе
      </p>
      <Link href="/pricing">
        <Button variant="outline" size="sm" className="text-mp-blue-600 border-mp-blue-200">
          Оформить подписку
        </Button>
      </Link>
    </div>
  );
}
```

### LessonCard with Lock

```typescript
// Add locked prop to existing LessonCard
interface LessonCardProps {
  lesson: LessonWithProgress;
  locked?: boolean;  // NEW
  // ... existing props
}

// In the status icon area, replace play icon with lock when locked:
const statusDisplay = locked
  ? { icon: <LockIcon />, color: 'text-mp-gray-400', label: 'Платный' }
  : STATUS_CONFIG[lesson.status];
```

### Track Preview with Blur

```typescript
// For "Мой трек" without PLATFORM subscription
// Show first 3 lessons normally, blur the rest

{recommendedPath.lessons.map((lesson, idx) => (
  <div key={lesson.id} className={cn(
    idx >= 3 && !hasPlatformSub && 'blur-sm pointer-events-none select-none'
  )}>
    <LessonCard lesson={lesson} locked={idx >= 3 && !hasPlatformSub} />
  </div>
))}

{!hasPlatformSub && recommendedPath.lessons.length > 3 && (
  <Card className="border-mp-blue-200 bg-gradient-to-br from-mp-blue-50 to-white">
    <CardContent className="py-8 text-center">
      <h3>Получите полный персональный трек</h3>
      <p>Ещё {recommendedPath.lessons.length - 3} уроков доступны с полной подпиской</p>
      <Link href="/pricing"><Button>Оформить полный доступ</Button></Link>
    </CardContent>
  </Card>
)}
```

## State of the Art

| Aspect | Current State | After Phase 20 |
|--------|--------------|----------------|
| Content access | All lessons open to authenticated users | Free preview (2/course) + subscription gating |
| Lesson page | Always shows video + AI | Lock UI for paid, full experience for free/subscribed |
| Catalog | All lessons equal | Lock icons on paid lessons, upsell banners |
| "Мой трек" | Open to anyone with diagnostic | Preview (3 lessons) for non-PLATFORM, full for PLATFORM |
| Feature flag | billing_enabled controls pricing page only | billing_enabled also controls all content gating |

## Open Questions

1. **Lesson order values in DB**
   - What we know: Schema has `order Int @default(0)`, seed data likely uses 1-based ordering
   - What's unclear: Whether all 6 courses consistently use 1-based order starting at 1
   - Recommendation: Add a validation query in Wave 0 to confirm order values. If 0-based, adjust threshold to `<= 1` (giving lessons 0,1 as free)

2. **Track preview count: 3 lessons**
   - What we know: CONTEXT.md says "первые 3 урока трека видны"
   - What's unclear: Whether this is 3 regardless of how many courses they span
   - Recommendation: Simple index-based cutoff (first 3 in recommended order), as specified

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/api/src/routers/billing.ts` -- subscription model, feature flag pattern
- Existing codebase: `packages/api/src/routers/learning.ts` -- current lesson/course query patterns
- Existing codebase: `packages/api/src/utils/feature-flags.ts` -- isFeatureEnabled pattern
- Existing codebase: `packages/db/prisma/schema.prisma` -- Subscription, Lesson, Course models
- CONTEXT.md -- all user decisions for gating logic

### Secondary (MEDIUM confidence)
- DiagnosticGateBanner.tsx -- proven gate banner UI pattern to replicate

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all existing stack
- Architecture: HIGH - straightforward utility + response enrichment pattern
- Pitfalls: HIGH - based on actual codebase analysis (CANCELLED access, videoId leak, N+1)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- no external dependencies)
