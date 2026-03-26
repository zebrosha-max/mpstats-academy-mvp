import type { DriveStep } from 'driver.js';

export type TourPage = 'dashboard' | 'learn' | 'lesson';

const TOUR_PAGES: Record<string, TourPage> = {
  '/dashboard': 'dashboard',
  '/learn': 'learn',
};

export function getTourForPage(pathname: string): TourPage | null {
  if (TOUR_PAGES[pathname]) return TOUR_PAGES[pathname];
  if (pathname.startsWith('/learn/')) return 'lesson';
  return null;
}

export function getLocalStorageKey(page: TourPage): string {
  return `tour_${page}_completed`;
}

// --- Dashboard Tour (4 steps) ---

export const dashboardSteps: DriveStep[] = [
  {
    element: '[data-tour="sidebar-nav"]',
    popover: {
      title: 'Навигация',
      description: 'Здесь находятся все разделы: диагностика, обучение, профиль и тарифы.',
    },
  },
  {
    element: '[data-tour="dashboard-diagnostic-cta"]',
    popover: {
      title: 'Начните с диагностики',
      description: 'Пройдите тест из 15 вопросов, чтобы узнать свои сильные и слабые стороны.',
    },
  },
  {
    element: '[data-tour="dashboard-skill-radar"]',
    popover: {
      title: 'Профиль навыков',
      description: 'После диагностики здесь появится ваш Radar Chart по 5 компетенциям.',
    },
  },
  {
    element: '[data-tour="dashboard-learn-cta"]',
    popover: {
      title: 'Персональный трек',
      description: 'На основе результатов мы подберём уроки именно для вас.',
    },
  },
];

// --- Learn Tour: "Все курсы" variant (no diagnostic) ---

const learnCoursesSteps: DriveStep[] = [
  {
    element: '[data-tour="learn-search"]',
    popover: {
      title: 'Поиск по урокам',
      description: 'Ищите уроки по ключевым словам. AI найдёт релевантные фрагменты.',
    },
  },
  {
    element: '[data-tour="learn-filters"]',
    popover: {
      title: 'Фильтры',
      description: 'Фильтруйте по курсу, категории навыка и уровню сложности.',
    },
  },
  {
    element: '[data-tour="learn-add-to-track"]',
    popover: {
      title: 'Каталог курсов',
      description: 'Здесь собраны все курсы платформы. Откройте любой курс, чтобы начать обучение.',
    },
  },
];

// --- Learn Tour: "Мой трек" variant (diagnostic completed) ---

const learnTrackSteps: DriveStep[] = [
  {
    element: '[data-tour="learn-search"]',
    popover: {
      title: 'Поиск по урокам',
      description: 'Ищите уроки по ключевым словам. AI найдёт релевантные фрагменты.',
    },
  },
  {
    element: '[data-tour="learn-filters"]',
    popover: {
      title: 'Фильтры',
      description: 'Фильтруйте по курсу, категории навыка и уровню сложности.',
    },
  },
  {
    element: '[data-tour="learn-view-toggle"]',
    popover: {
      title: 'Мой трек / Все курсы',
      description: 'Переключайтесь между персональным треком обучения и полным каталогом.',
    },
  },
  {
    element: '[data-tour="learn-sections"]',
    popover: {
      title: 'Секции трека',
      description: 'Ваш трек разделён по приоритету: «Ошибки» — темы, где диагностика выявила пробелы; «Углубление» — закрепление базовых навыков; «Развитие» — новые компетенции; «Продвинутый» — темы для опытных.',
    },
  },
  {
    element: '[data-tour="learn-view-toggle"]',
    popover: {
      title: 'Добавьте уроки в трек',
      description: 'Переключитесь на «Все курсы» и нажмите + на любом уроке, чтобы добавить его в свой персональный трек.',
    },
  },
];

// --- Lesson Tour (5 steps) ---

export const lessonSteps: DriveStep[] = [
  {
    element: '[data-tour="lesson-video"]',
    popover: {
      title: 'Видеоурок',
      description: 'Основной контент урока. Используйте таймкоды из AI-ответов для быстрой навигации.',
    },
  },
  {
    element: '[data-tour="lesson-summary"]',
    popover: {
      title: 'AI-конспект',
      description: 'Автоматическое резюме урока с ключевыми тезисами и ссылками на таймкоды.',
    },
  },
  {
    element: '[data-tour="lesson-chat"]',
    popover: {
      title: 'AI-чат',
      description: 'Задайте вопрос по уроку — AI ответит с цитатами из видео.',
    },
  },
  {
    element: '[data-tour="lesson-comments"]',
    popover: {
      title: 'Комментарии',
      description: 'Обсуждайте урок с другими студентами. Можно отвечать на комментарии.',
    },
  },
  {
    element: '[data-tour="lesson-nav"]',
    popover: {
      title: 'Навигация',
      description: 'Переходите к следующему или предыдущему уроку одним нажатием.',
    },
  },
];

// --- Shared config ---

export const tourConfig = {
  popoverClass: 'mpstats-tour-popover',
  nextBtnText: 'Далее',
  prevBtnText: 'Назад',
  doneBtnText: 'Готово',
  progressText: '{{current}} из {{total}}',
};

// --- Get steps with context-aware adaptation ---

export function getSteps(page: TourPage, isMobile: boolean): DriveStep[] {
  let steps: DriveStep[];

  if (page === 'learn') {
    // Choose learn tour variant based on DOM state:
    // If "Мой трек" sections exist → user has diagnostic, show full track tour
    // If only courses view → show catalog tour
    const hasTrackSections = !!document.querySelector('[data-tour="learn-sections"]');
    const hasToggle = !!document.querySelector('[data-tour="learn-view-toggle"]');

    if (hasTrackSections && hasToggle) {
      steps = learnTrackSteps.map((s) => ({ ...s }));
    } else {
      steps = learnCoursesSteps.map((s) => ({ ...s }));
    }
  } else {
    const base = page === 'dashboard' ? dashboardSteps : lessonSteps;
    steps = base.map((s) => ({ ...s }));
  }

  // Dashboard step 1: swap sidebar-nav → mobile-nav on mobile
  if (page === 'dashboard' && isMobile && steps[0]) {
    steps[0] = {
      ...steps[0],
      element: '[data-tour="mobile-nav"]',
    };
  }

  return steps;
}
