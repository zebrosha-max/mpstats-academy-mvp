import type { Course, Lesson, LessonWithProgress, CourseWithProgress, SkillCategory, Difficulty, LessonStatus } from '@mpstats/shared';

// Mock courses data - IDs match manifest.json & Supabase content_chunk
export const MOCK_COURSES: Course[] = [
  {
    id: '01_analytics',
    title: 'Аналитика для маркетплейсов',
    description: 'Научитесь анализировать рынок, конкурентов и собственные продажи с помощью MPSTATS',
    slug: '01_analytics',
    imageUrl: '/images/courses/analytics.jpg',
    duration: 180,
    order: 1,
  },
  {
    id: '02_marketing',
    title: 'Продвижение на Wildberries',
    description: 'Полный курс по рекламе и органическому продвижению товаров на WB',
    slug: '02_marketing',
    imageUrl: '/images/courses/marketing.jpg',
    duration: 240,
    order: 2,
  },
  {
    id: '03_content',
    title: 'Создание продающих карточек',
    description: 'Фото, видео, описания и Rich-контент для максимальной конверсии',
    slug: '03_content',
    imageUrl: '/images/courses/content.jpg',
    duration: 150,
    order: 3,
  },
  {
    id: '04_operations',
    title: 'Операционное управление',
    description: 'Логистика, склады, FBO/FBS и масштабирование бизнеса на маркетплейсах',
    slug: '04_operations',
    imageUrl: '/images/courses/operations.jpg',
    duration: 120,
    order: 4,
  },
  {
    id: '05_finance',
    title: 'Финансы селлера',
    description: 'Unit-экономика, налоги, себестоимость и финансовое планирование',
    slug: '05_finance',
    imageUrl: '/images/courses/finance.jpg',
    duration: 100,
    order: 5,
  },
];

// Mock lessons data - IDs match manifest.json & Supabase content_chunk
export const MOCK_LESSONS: Lesson[] = [
  // Course 1: Analytics (01_analytics)
  {
    id: '01_analytics_m01_start_001',
    courseId: '01_analytics',
    title: 'Как пройти курс с максимальным результатом',
    description: 'Введение в курс аналитики для маркетплейсов',
    videoUrl: 'https://kinescope.io/embed/demo1',
    videoId: 'demo1',
    duration: 15,
    order: 1,
    skillCategory: 'ANALYTICS' as SkillCategory,
    skillLevel: 'EASY' as Difficulty,
  },
  {
    id: '01_analytics_m01_start_002',
    courseId: '01_analytics',
    title: 'Для чего нужна аналитика для бизнеса на МП',
    description: 'Обзор ключевых метрик и инструментов аналитики',
    videoUrl: 'https://kinescope.io/embed/demo2',
    videoId: 'demo2',
    duration: 20,
    order: 2,
    skillCategory: 'ANALYTICS' as SkillCategory,
    skillLevel: 'EASY' as Difficulty,
  },
  {
    id: '01_analytics_m01_start_003',
    courseId: '01_analytics',
    title: 'Дорожная карта курса',
    description: 'План обучения и структура курса',
    videoUrl: 'https://kinescope.io/embed/demo3',
    videoId: 'demo3',
    duration: 10,
    order: 3,
    skillCategory: 'ANALYTICS' as SkillCategory,
    skillLevel: 'EASY' as Difficulty,
  },
  {
    id: '01_analytics_m02_economics_001',
    courseId: '01_analytics',
    title: 'Юнит-экономика погружение',
    description: 'Основы unit-экономики для селлеров',
    videoUrl: 'https://kinescope.io/embed/demo4',
    videoId: 'demo4',
    duration: 25,
    order: 4,
    skillCategory: 'ANALYTICS' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },

  // Course 2: Marketing (02_marketing) - using placeholder IDs for now
  {
    id: '02_marketing_m01_001',
    courseId: '02_marketing',
    title: 'Основы рекламы на Wildberries',
    description: 'Типы рекламных кампаний и их особенности',
    videoUrl: 'https://kinescope.io/embed/demo5',
    videoId: 'demo5',
    duration: 20,
    order: 1,
    skillCategory: 'MARKETING' as SkillCategory,
    skillLevel: 'EASY' as Difficulty,
  },
  {
    id: '02_marketing_m01_002',
    courseId: '02_marketing',
    title: 'Настройка автоматических кампаний',
    description: 'Пошаговая инструкция по запуску и оптимизации',
    videoUrl: 'https://kinescope.io/embed/demo6',
    videoId: 'demo6',
    duration: 35,
    order: 2,
    skillCategory: 'MARKETING' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '02_marketing_m01_003',
    courseId: '02_marketing',
    title: 'Работа с ДРР и ROI рекламы',
    description: 'Как считать эффективность и оптимизировать расходы',
    videoUrl: 'https://kinescope.io/embed/demo7',
    videoId: 'demo7',
    duration: 25,
    order: 3,
    skillCategory: 'MARKETING' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '02_marketing_m01_004',
    courseId: '02_marketing',
    title: 'Участие в акциях WB',
    description: 'Стратегии и подводные камни промо-активностей',
    videoUrl: 'https://kinescope.io/embed/demo8',
    videoId: 'demo8',
    duration: 30,
    order: 4,
    skillCategory: 'MARKETING' as SkillCategory,
    skillLevel: 'HARD' as Difficulty,
  },

  // Course 3: Content (03_content)
  {
    id: '03_content_m01_001',
    courseId: '03_content',
    title: 'Фотография для маркетплейсов',
    description: 'Требования к фото и секреты продающих изображений',
    videoUrl: 'https://kinescope.io/embed/demo9',
    videoId: 'demo9',
    duration: 25,
    order: 1,
    skillCategory: 'CONTENT' as SkillCategory,
    skillLevel: 'EASY' as Difficulty,
  },
  {
    id: '03_content_m01_002',
    courseId: '03_content',
    title: 'Инфографика и Rich-контент',
    description: 'Создание расширенных описаний с визуальными элементами',
    videoUrl: 'https://kinescope.io/embed/demo10',
    videoId: 'demo10',
    duration: 30,
    order: 2,
    skillCategory: 'CONTENT' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '03_content_m01_003',
    courseId: '03_content',
    title: 'Видео в карточке товара',
    description: 'Как снять и загрузить видео для повышения конверсии',
    videoUrl: 'https://kinescope.io/embed/demo11',
    videoId: 'demo11',
    duration: 20,
    order: 3,
    skillCategory: 'CONTENT' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '03_content_m01_004',
    courseId: '03_content',
    title: 'SEO-оптимизация карточек',
    description: 'Ключевые слова, заголовки и описания для поисковой выдачи',
    videoUrl: 'https://kinescope.io/embed/demo12',
    videoId: 'demo12',
    duration: 25,
    order: 4,
    skillCategory: 'CONTENT' as SkillCategory,
    skillLevel: 'HARD' as Difficulty,
  },

  // Course 4: Operations (04_operations)
  {
    id: '04_operations_m01_001',
    courseId: '04_operations',
    title: 'Работа с FBO и FBS',
    description: 'Различия моделей, выбор оптимальной схемы для вашего бизнеса',
    videoUrl: 'https://kinescope.io/embed/demo13',
    videoId: 'demo13',
    duration: 25,
    order: 1,
    skillCategory: 'OPERATIONS' as SkillCategory,
    skillLevel: 'EASY' as Difficulty,
  },
  {
    id: '04_operations_m01_002',
    courseId: '04_operations',
    title: 'Логистика и склады',
    description: 'Оптимизация поставок, работа со складами WB и Ozon',
    videoUrl: 'https://kinescope.io/embed/demo14',
    videoId: 'demo14',
    duration: 30,
    order: 2,
    skillCategory: 'OPERATIONS' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '04_operations_m01_003',
    courseId: '04_operations',
    title: 'Возвраты и брак',
    description: 'Минимизация возвратов, работа с браком и рекламациями',
    videoUrl: 'https://kinescope.io/embed/demo15',
    videoId: 'demo15',
    duration: 20,
    order: 3,
    skillCategory: 'OPERATIONS' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '04_operations_m01_004',
    courseId: '04_operations',
    title: 'Масштабирование операций',
    description: 'Автоматизация процессов и управление большим ассортиментом',
    videoUrl: 'https://kinescope.io/embed/demo16',
    videoId: 'demo16',
    duration: 35,
    order: 4,
    skillCategory: 'OPERATIONS' as SkillCategory,
    skillLevel: 'HARD' as Difficulty,
  },

  // Course 5: Finance (05_finance)
  {
    id: '05_finance_m01_001',
    courseId: '05_finance',
    title: 'Unit-экономика товара',
    description: 'Расчёт маржинальности, точки безубыточности и прибыли',
    videoUrl: 'https://kinescope.io/embed/demo17',
    videoId: 'demo17',
    duration: 30,
    order: 1,
    skillCategory: 'FINANCE' as SkillCategory,
    skillLevel: 'EASY' as Difficulty,
  },
  {
    id: '05_finance_m01_002',
    courseId: '05_finance',
    title: 'Управление себестоимостью',
    description: 'Оптимизация закупок, логистики и операционных расходов',
    videoUrl: 'https://kinescope.io/embed/demo18',
    videoId: 'demo18',
    duration: 25,
    order: 2,
    skillCategory: 'FINANCE' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '05_finance_m01_003',
    courseId: '05_finance',
    title: 'Налоги для селлеров',
    description: 'УСН, патент, НДС — выбор оптимальной системы налогообложения',
    videoUrl: 'https://kinescope.io/embed/demo19',
    videoId: 'demo19',
    duration: 25,
    order: 3,
    skillCategory: 'FINANCE' as SkillCategory,
    skillLevel: 'MEDIUM' as Difficulty,
  },
  {
    id: '05_finance_m01_004',
    courseId: '05_finance',
    title: 'Финансовое планирование',
    description: 'Бюджетирование, cash flow и инвестиции в развитие',
    videoUrl: 'https://kinescope.io/embed/demo20',
    videoId: 'demo20',
    duration: 30,
    order: 4,
    skillCategory: 'FINANCE' as SkillCategory,
    skillLevel: 'HARD' as Difficulty,
  },
];

// Helper to add progress to lessons
export const addProgressToLessons = (
  lessons: Lesson[],
  progressMap: Map<string, { status: LessonStatus; watchedPercent: number }>
): LessonWithProgress[] => {
  return lessons.map((lesson) => {
    const progress = progressMap.get(lesson.id);
    return {
      ...lesson,
      status: progress?.status || ('NOT_STARTED' as LessonStatus),
      watchedPercent: progress?.watchedPercent || 0,
    };
  });
};

// Get mock courses with progress
export const getMockCoursesWithProgress = (
  _userId: string
): CourseWithProgress[] => {
  // Mock progress data - using real lesson IDs
  const mockProgress = new Map<string, { status: LessonStatus; watchedPercent: number }>([
    ['01_analytics_m01_start_001', { status: 'COMPLETED' as LessonStatus, watchedPercent: 100 }],
    ['01_analytics_m01_start_002', { status: 'COMPLETED' as LessonStatus, watchedPercent: 100 }],
    ['01_analytics_m01_start_003', { status: 'IN_PROGRESS' as LessonStatus, watchedPercent: 45 }],
    ['02_marketing_m01_001', { status: 'COMPLETED' as LessonStatus, watchedPercent: 100 }],
  ]);

  return MOCK_COURSES.map((course) => {
    const courseLessons = MOCK_LESSONS.filter((l) => l.courseId === course.id);
    const lessonsWithProgress = addProgressToLessons(courseLessons, mockProgress);
    const completedLessons = lessonsWithProgress.filter((l) => l.status === 'COMPLETED').length;

    return {
      ...course,
      lessons: lessonsWithProgress,
      completedLessons,
      totalLessons: courseLessons.length,
      progressPercent: Math.round((completedLessons / courseLessons.length) * 100),
    };
  });
};

// Get single lesson with progress
export const getMockLessonWithProgress = (
  lessonId: string,
  _userId: string
): LessonWithProgress | null => {
  const lesson = MOCK_LESSONS.find((l) => l.id === lessonId);
  if (!lesson) return null;

  // Mock: first lessons are completed - using real lesson IDs
  const completedLessons = ['01_analytics_m01_start_001', '01_analytics_m01_start_002', '02_marketing_m01_001'];
  const inProgressLessons = ['01_analytics_m01_start_003'];

  let status: LessonStatus = 'NOT_STARTED';
  let watchedPercent = 0;

  if (completedLessons.includes(lessonId)) {
    status = 'COMPLETED';
    watchedPercent = 100;
  } else if (inProgressLessons.includes(lessonId)) {
    status = 'IN_PROGRESS';
    watchedPercent = 45;
  }

  return {
    ...lesson,
    status,
    watchedPercent,
  };
};

// Get next recommended lesson
export const getNextLesson = (userId: string): LessonWithProgress | null => {
  // Return first in-progress or not-started lesson
  return getMockLessonWithProgress('01_analytics_m01_start_003', userId);
};
