import type { SkillProfile, UserStats, RecentActivity, DashboardData, SkillGap } from '@mpstats/shared';
import { getNextLesson } from './courses';

// Mock skill profile
export const MOCK_SKILL_PROFILE: SkillProfile = {
  analytics: 72,
  marketing: 58,
  content: 45,
  operations: 63,
  finance: 51,
};

// Mock user stats
export const MOCK_USER_STATS: UserStats = {
  totalLessonsCompleted: 4,
  totalWatchTime: 95,
  currentStreak: 3,
  longestStreak: 7,
  averageScore: 68,
  lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
};

// Mock recent activity
export const MOCK_RECENT_ACTIVITY: RecentActivity[] = [
  {
    id: 'activity-1',
    type: 'lesson_completed',
    title: 'Урок завершён',
    description: 'Основы рекламы на Wildberries',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    metadata: {
      lessonId: 'lesson-2-1',
      courseId: 'course-2',
    },
  },
  {
    id: 'activity-2',
    type: 'lesson_completed',
    title: 'Урок завершён',
    description: 'ABC-анализ ассортимента',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    metadata: {
      lessonId: 'lesson-1-2',
      courseId: 'course-1',
    },
  },
  {
    id: 'activity-3',
    type: 'diagnostic_completed',
    title: 'Диагностика пройдена',
    description: 'Средний балл: 68%',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    metadata: {
      score: 68,
    },
  },
  {
    id: 'activity-4',
    type: 'lesson_started',
    title: 'Урок начат',
    description: 'Анализ конкурентов через MPSTATS',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    metadata: {
      lessonId: 'lesson-1-3',
      courseId: 'course-1',
    },
  },
];

// Mock skill gaps
export const MOCK_SKILL_GAPS: SkillGap[] = [
  {
    category: 'CONTENT',
    label: 'Контент',
    currentScore: 45,
    targetScore: 70,
    gap: 25,
    priority: 'HIGH',
    recommendedLessons: ['lesson-3-1', 'lesson-3-2', 'lesson-3-3'],
  },
  {
    category: 'FINANCE',
    label: 'Финансы',
    currentScore: 51,
    targetScore: 70,
    gap: 19,
    priority: 'HIGH',
    recommendedLessons: [],
  },
  {
    category: 'MARKETING',
    label: 'Маркетинг',
    currentScore: 58,
    targetScore: 70,
    gap: 12,
    priority: 'MEDIUM',
    recommendedLessons: ['lesson-2-2', 'lesson-2-3', 'lesson-2-4'],
  },
  {
    category: 'OPERATIONS',
    label: 'Операции',
    currentScore: 63,
    targetScore: 70,
    gap: 7,
    priority: 'LOW',
    recommendedLessons: [],
  },
  {
    category: 'ANALYTICS',
    label: 'Аналитика',
    currentScore: 72,
    targetScore: 70,
    gap: 0,
    priority: 'LOW',
    recommendedLessons: [],
  },
];

// Get mock dashboard data
// If realSkillProfile is provided, use it instead of mock data
export const getMockDashboardData = (userId: string, realSkillProfile?: SkillProfile | null): DashboardData => {
  return {
    stats: MOCK_USER_STATS,
    skillProfile: realSkillProfile || null, // null = no diagnostic yet, show prompt
    recentActivity: MOCK_RECENT_ACTIVITY,
    nextLesson: getNextLesson(userId),
    completionPercent: 36, // 4 of 11 lessons
  };
};
