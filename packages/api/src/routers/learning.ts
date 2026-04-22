import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { ensureUserProfile } from '../utils/ensure-user-profile';
import { handleDatabaseError } from '../utils/db-errors';
import { getUserActiveSubscriptions, getUserAdminBypass, isLessonAccessible, checkLessonAccess } from '../utils/access';
import { isFeatureEnabled } from '../utils/feature-flags';
import { parseLearningPath } from '@mpstats/shared';
import type { CourseWithProgress, LessonWithProgress, LearningPathSection, SectionedLearningPath, LibraryData, LibraryAxis } from '@mpstats/shared';
import { generateSectionedPath } from './diagnostic';

function pluralLessons(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} урок`;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return `${n} урока`;
  return `${n} уроков`;
}

export const learningRouter = router({
  // Get all courses with progress
  getCourses: protectedProcedure.query(async ({ ctx }): Promise<CourseWithProgress[]> => {
    try {
      const courses = await ctx.prisma.course.findMany({
        where: { isHidden: false },
        include: {
          lessons: {
            where: { isHidden: false },
            orderBy: { order: 'asc' },
            include: {
              progress: {
                where: { path: { userId: ctx.user.id } },
              },
            },
          },
        },
        orderBy: { order: 'asc' },
      });

      const [subs, billingEnabled, isAdminBypass] = await Promise.all([
        getUserActiveSubscriptions(ctx.user.id, ctx.prisma),
        isFeatureEnabled('billing_enabled'),
        getUserAdminBypass(ctx.user.id, ctx.prisma),
      ]);

      return courses.map((course) => {
        const lessonsWithVideo = course.lessons.filter((l) => l.videoId != null);
        const watchedPercentSum = lessonsWithVideo.reduce((sum, l) => {
          const percent = l.progress[0]?.watchedPercent || 0;
          return sum + percent;
        }, 0);
        const progressPercent = lessonsWithVideo.length > 0
          ? Math.round(watchedPercentSum / lessonsWithVideo.length)
          : 0;

        return {
        id: course.id,
        title: course.title,
        description: course.description,
        slug: course.slug,
        imageUrl: course.imageUrl,
        duration: course.duration,
        order: course.order,
        totalLessons: course.lessons.length,
        completedLessons: course.lessons.filter((l) =>
          l.progress.some((p) => p.status === 'COMPLETED')
        ).length,
        progressPercent,
        lessons: course.lessons.map((l) => {
          const locked = !isLessonAccessible({ order: l.order, courseId: course.id }, subs, billingEnabled, isAdminBypass);
          return {
            id: l.id,
            courseId: l.courseId,
            title: l.title,
            description: l.description,
            videoUrl: locked ? '' : (l.videoUrl || ''),
            videoId: locked ? null : l.videoId,
            duration: l.duration || 0,
            order: l.order,
            skillCategory: l.skillCategory,
            skillLevel: l.skillLevel,
            status: l.progress[0]?.status || 'NOT_STARTED',
            watchedPercent: l.progress[0]?.watchedPercent || 0,
            locked,
            topics: (l.topics as string[] | null) ?? [],
            skillCategories: (l.skillCategories as string[] | null) ?? [],
          };
        }),
      };
      });
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get library content — lessons from hidden skill courses, grouped by axis → skill block
  getLibrary: protectedProcedure.query(async ({ ctx }): Promise<LibraryData> => {
    try {
      // Taxonomy: axis titles and block metadata
      const AXIS_TITLES: Record<string, string> = {
        ANALYTICS: 'Аналитика',
        MARKETING: 'Маркетинг',
        CONTENT: 'Контент',
        OPERATIONS: 'Операции',
        FINANCE: 'Финансы',
      };

      const BLOCK_META: Record<string, { title: string; description: string }> = {
        'ANALYTICS/competitor_analysis': { title: 'Анализ конкурентов', description: 'Сравнение карточек, цен, позиций, аудит конкурентных преимуществ' },
        'ANALYTICS/market_trends': { title: 'Мониторинг трендов и спроса', description: 'Сезонность, новые тренды, изменения в спросе' },
        'ANALYTICS/product_metrics': { title: 'Аналитика товарных показателей', description: 'Продажи, возвраты, конверсии, ABC/XYZ' },
        'ANALYTICS/assortment_management': { title: 'Управление ассортиментом', description: 'Фокусные товары, локомотивы, сезонные товары' },
        'ANALYTICS/target_audience': { title: 'Анализ целевой аудитории', description: 'Сегментация ЦА, анализ отзывов, портрет клиента' },
        'ANALYTICS/product_niche_selection': { title: 'Выбор товара и ниши', description: 'Анализ ниш, оценка спроса и конкуренции' },
        'ANALYTICS/sales_funnel': { title: 'Воронка продаж', description: 'Показ→клик→корзина→заказ→выкуп, CTR/CR' },
        'ANALYTICS/data_tools': { title: 'Инструменты аналитики', description: 'MPSTATS, личный кабинет, таблицы, дашборды' },
        'MARKETING/seo_optimization': { title: 'SEO-оптимизация', description: 'Ключи, заголовки, индексация, релевантность' },
        'MARKETING/ad_campaign_setup': { title: 'Настройка рекламных кампаний', description: 'Создание РК, таргетинг, типы кампаний' },
        'MARKETING/ad_strategy': { title: 'Рекламные стратегии', description: 'Вывод товара, масштабирование, DRR-контроль' },
        'MARKETING/ad_optimization': { title: 'Оптимизация и аналитика РК', description: 'Ставки, CTR, CPC, ROI, A/B тесты' },
        'MARKETING/autobidder': { title: 'Автобиддер', description: 'Автоматические ставки, правила, стратегии' },
        'MARKETING/external_advertising': { title: 'Внешняя реклама', description: 'Яндекс.Директ, VK, соцсети, внешний трафик' },
        'MARKETING/influencer_marketing': { title: 'Работа с блогерами', description: 'Выбор блогеров, форматы сотрудничества' },
        'MARKETING/card_conversion': { title: 'Конверсия карточки', description: 'Визуал, CTR, A+ контент, рич-контент' },
        'CONTENT/product_photography': { title: 'Фото и инфографика', description: 'Фото товаров, инфографика, требования площадок' },
        'CONTENT/video_content': { title: 'Видеоконтент', description: 'Сценарии, съёмка, монтаж видео' },
        'CONTENT/copywriting': { title: 'Тексты и описания', description: 'Описания, УТП, характеристики, rich-контент' },
        'CONTENT/neural_content': { title: 'Нейросети для контента', description: 'ChatGPT, Midjourney для текстов и изображений' },
        'CONTENT/neural_analytics': { title: 'Нейроаналитика', description: 'Нейросети для анализа данных и автоматизации' },
        'CONTENT/reviews_management': { title: 'Работа с отзывами', description: 'Анализ отзывов, ответы, управление репутацией' },
        'OPERATIONS/logistics_fbo_fbs': { title: 'Логистика FBO/FBS', description: 'Схемы поставок, склады WB и собственные' },
        'OPERATIONS/inventory_management': { title: 'Управление запасами', description: 'Прогнозирование остатков, планирование закупок' },
        'OPERATIONS/ozon_specifics': { title: 'Специфика Ozon', description: 'Кабинет, продвижение, реклама на Ozon' },
        'OPERATIONS/platform_tools': { title: 'Инструменты платформ', description: 'Личный кабинет, акции, программы лояльности' },
        'OPERATIONS/process_automation': { title: 'Автоматизация процессов', description: 'Таблицы, скрипты, автоматизация рутины' },
        'FINANCE/unit_economics': { title: 'Юнит-экономика', description: 'Себестоимость, маржа, точка безубыточности' },
        'FINANCE/pricing': { title: 'Ценообразование', description: 'Стратегия цен, скидки, влияние на маржу' },
        'FINANCE/ad_budgeting': { title: 'Бюджетирование рекламы', description: 'Рекламный бюджет, DRR, ROAS' },
        'FINANCE/business_planning': { title: 'Бизнес-планирование', description: 'Стратегия масштабирования, финмодель' },
        'FINANCE/cost_management': { title: 'Управление затратами', description: 'Оптимизация расходов, снижение себестоимости' },
      };

      // Get lessons from hidden courses (skill_*) that have video
      const lessons = await ctx.prisma.lesson.findMany({
        where: {
          isHidden: false,
          videoId: { not: null },
          course: { isHidden: true, id: { startsWith: 'skill_' } },
        },
        include: {
          progress: {
            where: { path: { userId: ctx.user.id } },
          },
        },
        orderBy: { order: 'asc' },
      });

      // Filter to lessons that have skillBlocks (Json field, filter in JS)
      const lessonsWithBlocks = lessons.filter((l) => l.skillBlocks != null);

      if (lessonsWithBlocks.length === 0) return [];

      // Check access
      const [subs, billingEnabled, isAdminBypass] = await Promise.all([
        getUserActiveSubscriptions(ctx.user.id, ctx.prisma),
        isFeatureEnabled('billing_enabled'),
        getUserAdminBypass(ctx.user.id, ctx.prisma),
      ]);

      // Group lessons by axis → block
      type LessonRow = typeof lessonsWithBlocks[number];
      const axisMap = new Map<string, Map<string, LessonRow[]>>();

      for (const lesson of lessonsWithBlocks) {
        const blocks = (lesson.skillBlocks as string[] | null) || [];
        for (const blockId of blocks) {
          const [axis] = blockId.split('/');
          if (!axis) continue;

          if (!axisMap.has(axis)) axisMap.set(axis, new Map());
          const blockMap = axisMap.get(axis)!;
          if (!blockMap.has(blockId)) blockMap.set(blockId, []);
          blockMap.get(blockId)!.push(lesson);
        }
      }

      // Build response
      const result: LibraryAxis[] = [];
      const axisOrder = ['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE'];

      for (const axis of axisOrder) {
        const blockMap = axisMap.get(axis);
        if (!blockMap) continue;

        const blocks = [...blockMap.entries()]
          .map(([blockId, blockLessons]) => {
            const meta = BLOCK_META[blockId] || { title: blockId, description: '' };
            // Deduplicate lessons (a lesson can appear in multiple blocks)
            const uniqueLessons = [...new Map(blockLessons.map(l => [l.id, l])).values()];

            return {
              block: blockId.split('/')[1] || blockId,
              title: meta.title,
              description: meta.description,
              lessons: uniqueLessons.map((l) => {
                const locked = !isLessonAccessible(
                  { order: l.order, courseId: l.courseId },
                  subs, billingEnabled, isAdminBypass,
                );
                return {
                  id: l.id,
                  title: l.title,
                  duration: l.duration || 0,
                  order: l.order,
                  videoUrl: locked ? '' : (l.videoUrl || ''),
                  videoId: locked ? null : l.videoId,
                  status: (l.progress[0]?.status || 'NOT_STARTED') as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
                  watchedPercent: l.progress[0]?.watchedPercent || 0,
                  locked,
                };
              }),
            };
          })
          .filter((b) => b.lessons.length > 0)
          .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

        if (blocks.length > 0) {
          result.push({
            axis,
            title: AXIS_TITLES[axis] || axis,
            blocks,
            // Count unique lessons (a lesson can appear in multiple blocks)
            totalLessons: new Set(blocks.flatMap((b) => b.lessons.map((l) => l.id))).size,
          });
        }
      }

      return result;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get single course with lessons
  getCourse: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }): Promise<CourseWithProgress | null> => {
      try {
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.courseId },
          include: {
            lessons: {
              where: { isHidden: false },
              orderBy: { order: 'asc' },
              include: {
                progress: {
                  where: { path: { userId: ctx.user.id } },
                },
              },
            },
          },
        });

        // Treat a hidden course the same as «not found» for users
        if (!course || course.isHidden) return null;

        const [subs, billingEnabled, isAdminBypass] = await Promise.all([
          getUserActiveSubscriptions(ctx.user.id, ctx.prisma),
          isFeatureEnabled('billing_enabled'),
          getUserAdminBypass(ctx.user.id, ctx.prisma),
        ]);

        const lessonsWithVideo = course.lessons.filter((l) => l.videoId != null);
        const watchedPercentSum = lessonsWithVideo.reduce((sum, l) => {
          const percent = l.progress[0]?.watchedPercent || 0;
          return sum + percent;
        }, 0);
        const progressPercent = lessonsWithVideo.length > 0
          ? Math.round(watchedPercentSum / lessonsWithVideo.length)
          : 0;

        return {
          id: course.id,
          title: course.title,
          description: course.description,
          slug: course.slug,
          imageUrl: course.imageUrl,
          duration: course.duration,
          order: course.order,
          totalLessons: course.lessons.length,
          completedLessons: course.lessons.filter((l) =>
            l.progress.some((p) => p.status === 'COMPLETED')
          ).length,
          progressPercent,
          lessons: course.lessons.map((l) => {
            const locked = !isLessonAccessible({ order: l.order, courseId: course.id }, subs, billingEnabled, isAdminBypass);
            return {
              id: l.id,
              courseId: l.courseId,
              title: l.title,
              description: l.description,
              videoUrl: locked ? '' : (l.videoUrl || ''),
              videoId: locked ? null : l.videoId,
              duration: l.duration || 0,
              order: l.order,
              skillCategory: l.skillCategory,
              skillLevel: l.skillLevel,
              status: l.progress[0]?.status || 'NOT_STARTED',
              watchedPercent: l.progress[0]?.watchedPercent || 0,
              locked,
            };
          }),
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Get personalized learning path
  getPath: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get user's learning path if it exists
      const path = await ctx.prisma.learningPath.findUnique({
        where: { userId: ctx.user.id },
        include: {
          progress: {
            include: { lesson: true },
            orderBy: { lesson: { order: 'asc' } },
          },
        },
      });

      const [subs, billingEnabled, isAdminBypass] = await Promise.all([
        getUserActiveSubscriptions(ctx.user.id, ctx.prisma),
        isFeatureEnabled('billing_enabled'),
        getUserAdminBypass(ctx.user.id, ctx.prisma),
      ]);

      // If no path exists, return all lessons with no progress
      if (!path) {
        const allLessons = await ctx.prisma.lesson.findMany({
          where: { isHidden: false, course: { isHidden: false } },
          orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
        });

        const lessons: LessonWithProgress[] = allLessons.map((l) => {
          const locked = !isLessonAccessible({ order: l.order, courseId: l.courseId }, subs, billingEnabled, isAdminBypass);
          return {
            id: l.id,
            courseId: l.courseId,
            title: l.title,
            description: l.description,
            videoUrl: locked ? '' : (l.videoUrl || ''),
            videoId: locked ? null : l.videoId,
            duration: l.duration || 0,
            order: l.order,
            skillCategory: l.skillCategory,
            skillLevel: l.skillLevel,
            status: 'NOT_STARTED' as const,
            watchedPercent: 0,
            locked,
          };
        });

        return {
          id: null,
          userId: ctx.user.id,
          generatedAt: new Date(),
          lessons,
          totalLessons: lessons.length,
          completedLessons: 0,
        };
      }

      // Build lesson list from progress records
      const progressMap = new Map(
        path.progress.map((p) => [p.lessonId, p])
      );

      // Get ALL lessons (path may not have progress for all)
      const allLessons = await ctx.prisma.lesson.findMany({
        where: { isHidden: false, course: { isHidden: false } },
        orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
      });

      const lessons: LessonWithProgress[] = allLessons.map((l) => {
        const progress = progressMap.get(l.id);
        const locked = !isLessonAccessible({ order: l.order, courseId: l.courseId }, subs, billingEnabled, isAdminBypass);
        return {
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          description: l.description,
          videoUrl: locked ? '' : (l.videoUrl || ''),
          videoId: locked ? null : l.videoId,
          duration: l.duration || 0,
          order: l.order,
          skillCategory: l.skillCategory,
          skillLevel: l.skillLevel,
          status: progress?.status || 'NOT_STARTED',
          watchedPercent: progress?.watchedPercent || 0,
          locked,
        };
      });

      return {
        id: path.id,
        userId: ctx.user.id,
        generatedAt: path.generatedAt,
        lessons,
        totalLessons: lessons.length,
        completedLessons: lessons.filter((l) => l.status === 'COMPLETED').length,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get recommended learning path (generated on diagnostic completion)
  // Supports both old flat string[] format and new SectionedLearningPath (Phase 23)
  getRecommendedPath: protectedProcedure.query(async ({ ctx }) => {
    try {
      const path = await ctx.prisma.learningPath.findUnique({
        where: { userId: ctx.user.id },
        select: { lessons: true, generatedAt: true },
      });

      if (!path || !path.lessons) {
        return null;
      }

      const [subs, billingEnabled, isAdminBypass] = await Promise.all([
        getUserActiveSubscriptions(ctx.user.id, ctx.prisma),
        isFeatureEnabled('billing_enabled'),
        getUserAdminBypass(ctx.user.id, ctx.prisma),
      ]);
      const hasPlatformSubscription = subs.some((s) => s.plan.type === 'PLATFORM');

      // Detect format: old string[] or new SectionedLearningPath
      const parsed = parseLearningPath(path.lessons);

      // Helper to build lesson data object from DB lesson
      const buildLessonData = (l: any) => {
        const locked = !isLessonAccessible({ order: l.order, courseId: l.courseId }, subs, billingEnabled, isAdminBypass);
        return {
          id: l.id,
          courseId: l.courseId,
          courseName: l.course.title,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl || '',
          videoId: l.videoId,
          duration: l.duration || 0,
          order: l.order,
          skillCategory: l.skillCategory,
          skillLevel: l.skillLevel,
          status: (l.progress[0]?.status || 'NOT_STARTED') as string,
          watchedPercent: l.progress[0]?.watchedPercent || 0,
          locked,
        };
      };

      // ── New sectioned format (version: 2) ──
      if (!Array.isArray(parsed) && parsed.version === 2) {
        const allLessonIds = parsed.sections.flatMap(s => s.lessonIds);

        if (allLessonIds.length === 0) return null;

        const lessons = await ctx.prisma.lesson.findMany({
          where: {
            id: { in: allLessonIds },
            isHidden: false,
            course: { isHidden: false },
          },
          include: {
            progress: { where: { path: { userId: ctx.user.id } } },
            course: { select: { title: true, isHidden: true } },
          },
        });
        const lessonMap = new Map(lessons.map(l => [l.id, l]));

        // Filter out lessonIds that no longer resolve (hidden / deleted) and
        // drop sections that become empty as a result.
        const sectionsWithData = parsed.sections
          .map(section => ({
            ...section,
            lessons: section.lessonIds
              .map(id => lessonMap.get(id))
              .filter(Boolean)
              .map(l => buildLessonData(l)),
          }))
          .filter(s => s.id === 'custom' || s.lessons.length > 0);

        const allLessonsFlat = sectionsWithData.flatMap(s => s.lessons);
        const completedCount = allLessonsFlat.filter(l => l.status === 'COMPLETED').length;

        return {
          generatedAt: path.generatedAt,
          sections: sectionsWithData,
          lessons: allLessonsFlat, // flat list for backward compat
          totalLessons: allLessonsFlat.length,
          completedLessons: completedCount,
          hasPlatformSubscription,
          isSectioned: true as const,
        };
      }

      // ── Old flat format (string[]) ──
      const recommendedIds = parsed as string[];
      if (recommendedIds.length === 0) return null;

      const lessons = await ctx.prisma.lesson.findMany({
        where: {
          id: { in: recommendedIds },
          isHidden: false,
          course: { isHidden: false },
        },
        include: {
          progress: { where: { path: { userId: ctx.user.id } } },
          course: { select: { title: true, isHidden: true } },
        },
        orderBy: { order: 'asc' },
      });

      const lessonMap = new Map(lessons.map((l) => [l.id, l]));
      const orderedLessons = recommendedIds
        .map((id) => lessonMap.get(id))
        .filter(Boolean)
        .map(l => buildLessonData(l));

      const completedCount = orderedLessons.filter((l) => l.status === 'COMPLETED').length;

      return {
        generatedAt: path.generatedAt,
        lessons: orderedLessons,
        totalLessons: orderedLessons.length,
        completedLessons: completedCount,
        hasPlatformSubscription,
        isSectioned: false as const,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get lesson details with progress (single DB query via course relation)
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: input.lessonId },
          include: {
            course: {
              include: {
                lessons: {
                  where: { isHidden: false },
                  orderBy: { order: 'asc' },
                  select: { id: true, title: true, order: true },
                },
              },
            },
            progress: {
              where: { path: { userId: ctx.user.id } },
            },
          },
        });

        // Hidden lesson = not found. Hidden course is OK for library/skill lessons
        // (they have video and content but aren't shown as course cards).
        if (!lesson || lesson.isHidden) return null;

        const access = await checkLessonAccess(ctx.user.id, { order: lesson.order, courseId: lesson.courseId }, ctx.prisma);
        const locked = !access.hasAccess;

        const courseLessons = lesson.course.lessons;
        const currentIndex = courseLessons.findIndex((l) => l.id === lesson.id);

        const nextLessonNav =
          currentIndex < courseLessons.length - 1
            ? { id: courseLessons[currentIndex + 1].id, title: courseLessons[currentIndex + 1].title }
            : null;

        const prevLessonNav =
          currentIndex > 0
            ? { id: courseLessons[currentIndex - 1].id, title: courseLessons[currentIndex - 1].title }
            : null;

        return {
          lesson: {
            id: lesson.id,
            courseId: lesson.courseId,
            title: lesson.title,
            description: lesson.description,
            videoUrl: locked ? '' : (lesson.videoUrl || ''),
            videoId: locked ? null : lesson.videoId,
            duration: lesson.duration || 0,
            order: lesson.order,
            skillCategory: lesson.skillCategory,
            skillLevel: lesson.skillLevel,
            status: lesson.progress[0]?.status || 'NOT_STARTED',
            watchedPercent: lesson.progress[0]?.watchedPercent || 0,
            locked,
          } satisfies LessonWithProgress,
          course: { id: lesson.course.id, title: lesson.course.title, slug: lesson.course.slug },
          nextLesson: nextLessonNav,
          prevLesson: prevLessonNav,
          totalLessonsInCourse: courseLessons.length,
          currentLessonNumber: currentIndex + 1,
          hasPlatformSubscription: access.hasPlatformSubscription,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Get next recommended lesson
  getNextLesson: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Find user's learning path
      const path = await ctx.prisma.learningPath.findUnique({
        where: { userId: ctx.user.id },
        include: {
          progress: {
            include: { lesson: true },
          },
        },
      });

      if (path) {
        // Find first IN_PROGRESS lesson that is still visible
        const inProgress = path.progress.find(
          (p) => p.status === 'IN_PROGRESS' && !p.lesson.isHidden,
        );
        if (inProgress) {
          const l = inProgress.lesson;
          const access = await checkLessonAccess(ctx.user.id, { order: l.order, courseId: l.courseId }, ctx.prisma);
          const locked = !access.hasAccess;
          return {
            id: l.id,
            courseId: l.courseId,
            title: l.title,
            description: l.description,
            videoUrl: locked ? '' : (l.videoUrl || ''),
            videoId: locked ? null : l.videoId,
            duration: l.duration || 0,
            order: l.order,
            skillCategory: l.skillCategory,
            skillLevel: l.skillLevel,
            status: 'IN_PROGRESS' as const,
            watchedPercent: inProgress.watchedPercent,
            locked,
          } satisfies LessonWithProgress;
        }

        // Find first NOT_STARTED lesson (not in progress records)
        const completedOrInProgress = new Set(path.progress.map((p) => p.lessonId));
        const nextLesson = await ctx.prisma.lesson.findFirst({
          where: {
            id: { notIn: Array.from(completedOrInProgress) },
            isHidden: false,
            course: { isHidden: false },
          },
          orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
        });

        if (nextLesson) {
          const access = await checkLessonAccess(ctx.user.id, { order: nextLesson.order, courseId: nextLesson.courseId }, ctx.prisma);
          const locked = !access.hasAccess;
          return {
            id: nextLesson.id,
            courseId: nextLesson.courseId,
            title: nextLesson.title,
            description: nextLesson.description,
            videoUrl: locked ? '' : (nextLesson.videoUrl || ''),
            videoId: locked ? null : nextLesson.videoId,
            duration: nextLesson.duration || 0,
            order: nextLesson.order,
            skillCategory: nextLesson.skillCategory,
            skillLevel: nextLesson.skillLevel,
            status: 'NOT_STARTED' as const,
            watchedPercent: 0,
            locked,
          } satisfies LessonWithProgress;
        }
      }

      // No path — suggest first lesson of first course
      const firstLesson = await ctx.prisma.lesson.findFirst({
        where: { isHidden: false, course: { isHidden: false } },
        orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
      });

      if (!firstLesson) return null;

      const access = await checkLessonAccess(ctx.user.id, { order: firstLesson.order, courseId: firstLesson.courseId }, ctx.prisma);
      const locked = !access.hasAccess;
      return {
        id: firstLesson.id,
        courseId: firstLesson.courseId,
        title: firstLesson.title,
        description: firstLesson.description,
        videoUrl: locked ? '' : (firstLesson.videoUrl || ''),
        videoId: locked ? null : firstLesson.videoId,
        duration: firstLesson.duration || 0,
        order: firstLesson.order,
        skillCategory: firstLesson.skillCategory,
        skillLevel: firstLesson.skillLevel,
        status: 'NOT_STARTED' as const,
        watchedPercent: 0,
        locked,
      } satisfies LessonWithProgress;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get watch progress for a lesson (used to resume video)
  getWatchProgress: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const path = await ctx.prisma.learningPath.findUnique({
          where: { userId: ctx.user.id },
        });

        if (!path) return null;

        const progress = await ctx.prisma.lessonProgress.findUnique({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          select: {
            lastPosition: true,
            watchedPercent: true,
            status: true,
          },
        });

        return progress ?? null;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Save watch progress from video playback (auto-fires during watching)
  saveWatchProgress: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        position: z.number().min(0),
        duration: z.number().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Ignore saves where position < 5 seconds (prevents noise from page loads)
        if (input.position < 5) {
          return { lessonId: input.lessonId, status: 'NOT_STARTED' as const, watchedPercent: 0, lastPosition: 0 };
        }

        const rawPercent = Math.min(100, Math.max(0, Math.round((input.position / input.duration) * 100)));

        // Ensure user profile exists
        await ensureUserProfile(ctx.prisma, ctx.user);

        // Auto-create LearningPath if not exists
        const path = await ctx.prisma.learningPath.upsert({
          where: { userId: ctx.user.id },
          update: {},
          create: {
            userId: ctx.user.id,
            lessons: [],
          },
        });

        // No-regression: если урок уже COMPLETED, не откатываем статус
        // при повторном просмотре (player в начале шлёт position≈0).
        // watchedPercent тоже не уменьшаем, держим максимум.
        const existing = await ctx.prisma.lessonProgress.findUnique({
          where: { pathId_lessonId: { pathId: path.id, lessonId: input.lessonId } },
          select: { status: true, watchedPercent: true, completedAt: true },
        });

        const watchedPercent = Math.max(existing?.watchedPercent ?? 0, rawPercent);
        const alreadyCompleted = existing?.status === 'COMPLETED';
        const status = alreadyCompleted || watchedPercent >= 90 ? 'COMPLETED' : 'IN_PROGRESS';
        const completedAt = status === 'COMPLETED' ? (existing?.completedAt ?? new Date()) : null;

        const progress = await ctx.prisma.lessonProgress.upsert({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          update: {
            lastPosition: Math.round(input.position),
            watchedPercent,
            videoDuration: Math.round(input.duration),
            status,
            completedAt,
          },
          create: {
            pathId: path.id,
            lessonId: input.lessonId,
            lastPosition: Math.round(input.position),
            watchedPercent,
            videoDuration: Math.round(input.duration),
            status,
            completedAt,
          },
        });

        return {
          lessonId: input.lessonId,
          status: progress.status,
          watchedPercent: progress.watchedPercent,
          lastPosition: progress.lastPosition,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Update lesson progress
  updateProgress: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        watchedPercent: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Ensure user profile exists
        await ensureUserProfile(ctx.prisma, ctx.user);

        // Auto-create LearningPath if not exists
        const path = await ctx.prisma.learningPath.upsert({
          where: { userId: ctx.user.id },
          update: {},
          create: {
            userId: ctx.user.id,
            lessons: [],
          },
        });

        // No-regression: не откатываем COMPLETED и не уменьшаем watchedPercent.
        const existing = await ctx.prisma.lessonProgress.findUnique({
          where: { pathId_lessonId: { pathId: path.id, lessonId: input.lessonId } },
          select: { status: true, watchedPercent: true, completedAt: true },
        });

        const watchedPercent = Math.max(existing?.watchedPercent ?? 0, input.watchedPercent);
        const alreadyCompleted = existing?.status === 'COMPLETED';
        const status = alreadyCompleted || watchedPercent >= 90 ? 'COMPLETED' : 'IN_PROGRESS';
        const completedAt = status === 'COMPLETED' ? (existing?.completedAt ?? new Date()) : null;

        const progress = await ctx.prisma.lessonProgress.upsert({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          update: {
            watchedPercent,
            status,
            completedAt,
          },
          create: {
            pathId: path.id,
            lessonId: input.lessonId,
            watchedPercent,
            status,
            completedAt,
          },
        });

        return {
          lessonId: input.lessonId,
          status: progress.status,
          watchedPercent: progress.watchedPercent,
          completedAt: progress.completedAt,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Mark lesson as completed
  completeLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Ensure user profile exists
        await ensureUserProfile(ctx.prisma, ctx.user);

        // Auto-create LearningPath if not exists
        const path = await ctx.prisma.learningPath.upsert({
          where: { userId: ctx.user.id },
          update: {},
          create: {
            userId: ctx.user.id,
            lessons: [],
          },
        });

        const progress = await ctx.prisma.lessonProgress.upsert({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          update: {
            watchedPercent: 100,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
          create: {
            pathId: path.id,
            lessonId: input.lessonId,
            watchedPercent: 100,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        return {
          lessonId: input.lessonId,
          status: progress.status as 'COMPLETED',
          watchedPercent: 100,
          completedAt: progress.completedAt,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // ============== CUSTOM TRACK MANAGEMENT (Phase 32) ==============

  // Add a lesson to the user's custom section
  addToTrack: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify lesson exists and is visible to users
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: input.lessonId },
          include: { course: { select: { isHidden: true } } },
        });
        if (!lesson || lesson.isHidden || lesson.course.isHidden) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
        }

        const existingPath = await ctx.prisma.learningPath.findUnique({ where: { userId: ctx.user.id } });

        const makeCustomSection = (lessonId: string): LearningPathSection => ({
          id: 'custom',
          title: 'Мои уроки',
          description: pluralLessons(1),
          lessonIds: [lessonId],
          addedAt: { [lessonId]: new Date().toISOString() },
        });

        if (!existingPath) {
          // No path — create new with custom section only
          const pathData: SectionedLearningPath = {
            version: 2,
            sections: [makeCustomSection(input.lessonId)],
            generatedFromSessionId: '',
          };
          await ctx.prisma.learningPath.create({
            data: { userId: ctx.user.id, lessons: pathData as any },
          });
          return { added: true };
        }

        // Path exists — parse and modify
        const parsed = parseLearningPath(existingPath.lessons);

        if (Array.isArray(parsed)) {
          // Old flat format — create sectioned with custom section only
          const pathData: SectionedLearningPath = {
            version: 2,
            sections: [makeCustomSection(input.lessonId)],
            generatedFromSessionId: '',
          };
          await ctx.prisma.learningPath.update({
            where: { userId: ctx.user.id },
            data: { lessons: pathData as any },
          });
          return { added: true };
        }

        // Sectioned format — remove from AI sections, add to custom
        const sections = parsed.sections.map(s => {
          if (s.id === 'custom') return s;
          return { ...s, lessonIds: s.lessonIds.filter(id => id !== input.lessonId) };
        });

        let customSection = sections.find(s => s.id === 'custom');
        if (!customSection) {
          customSection = makeCustomSection(input.lessonId);
          sections.unshift(customSection);
        } else if (!customSection.lessonIds.includes(input.lessonId)) {
          customSection.lessonIds.push(input.lessonId);
          if (!customSection.addedAt) customSection.addedAt = {};
          customSection.addedAt[input.lessonId] = new Date().toISOString();
        }

        // Update description
        customSection.description = pluralLessons(customSection.lessonIds.length);

        // Filter out empty AI sections (keep custom even if empty)
        const filteredSections = sections.filter(s => s.id === 'custom' || s.lessonIds.length > 0);

        const updatedPath: SectionedLearningPath = {
          ...parsed,
          sections: filteredSections,
        };

        await ctx.prisma.learningPath.update({
          where: { userId: ctx.user.id },
          data: { lessons: updatedPath as any },
        });

        return { added: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleDatabaseError(error);
      }
    }),

  // Remove a lesson from any section (custom or AI)
  removeFromTrack: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const existingPath = await ctx.prisma.learningPath.findUnique({ where: { userId: ctx.user.id } });
        if (!existingPath) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Learning path not found' });
        }

        const parsed = parseLearningPath(existingPath.lessons);
        if (Array.isArray(parsed)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove from flat path format' });
        }

        // Remove lessonId from ALL sections
        const sections = parsed.sections.map(s => {
          const updated = { ...s, lessonIds: s.lessonIds.filter(id => id !== input.lessonId) };
          if (s.id === 'custom' && updated.addedAt) {
            const { [input.lessonId]: _, ...rest } = updated.addedAt;
            updated.addedAt = rest;
            updated.description = pluralLessons(updated.lessonIds.length);
          }
          return updated;
        });

        // Filter out empty AI sections (keep custom even if empty)
        const filteredSections = sections.filter(s => s.id === 'custom' || s.lessonIds.length > 0);

        const updatedPath: SectionedLearningPath = {
          ...parsed,
          sections: filteredSections,
        };

        await ctx.prisma.learningPath.update({
          where: { userId: ctx.user.id },
          data: { lessons: updatedPath as any },
        });

        return { removed: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleDatabaseError(error);
      }
    }),

  // Rebuild AI sections from last diagnostic, preserving custom section
  rebuildTrack: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const existingPath = await ctx.prisma.learningPath.findUnique({ where: { userId: ctx.user.id } });
        if (!existingPath) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No track to rebuild' });
        }

        const parsed = parseLearningPath(existingPath.lessons);
        if (Array.isArray(parsed)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No track to rebuild' });
        }

        // Preserve custom section
        const customSection = parsed.sections.find(s => s.id === 'custom');

        // Find last completed diagnostic session
        const lastSession = await ctx.prisma.diagnosticSession.findFirst({
          where: { userId: ctx.user.id, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
        });
        if (!lastSession) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No completed diagnostic to rebuild from' });
        }

        const skillProfile = await ctx.prisma.skillProfile.findUnique({
          where: { userId: ctx.user.id },
        });
        if (!skillProfile) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No skill profile found for last diagnostic' });
        }

        const answers = await ctx.prisma.diagnosticAnswer.findMany({
          where: { sessionId: lastSession.id },
          select: { isCorrect: true, sourceData: true, skillCategory: true, questionId: true },
        });

        const sessionData = await ctx.prisma.diagnosticSession.findUnique({
          where: { id: lastSession.id },
          select: { questions: true },
        });
        const sessionQuestions = (sessionData?.questions as any[]) || [];

        // Regenerate AI sections
        const newPath = await generateSectionedPath(
          ctx.prisma,
          skillProfile,
          lastSession.id,
          answers.map(a => ({
            isCorrect: a.isCorrect,
            sourceData: a.sourceData as any,
            skillCategory: a.skillCategory,
            questionId: a.questionId,
          })),
          sessionQuestions,
        );

        // If custom section exists, prepend and exclude its lessons from AI sections
        if (customSection && customSection.lessonIds.length > 0) {
          const customIds = new Set(customSection.lessonIds);
          newPath.sections = newPath.sections.map(s => ({
            ...s,
            lessonIds: s.lessonIds.filter(id => !customIds.has(id)),
          }));
          newPath.sections = newPath.sections.filter(s => s.lessonIds.length > 0);
          newPath.sections.unshift(customSection);
        }

        await ctx.prisma.learningPath.update({
          where: { userId: ctx.user.id },
          data: { lessons: newPath as any, generatedAt: new Date() },
        });

        return { rebuilt: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleDatabaseError(error);
      }
    }),
});
