// ============== ENUMS ==============

export const SkillCategory = {
  ANALYTICS: 'ANALYTICS',
  MARKETING: 'MARKETING',
  CONTENT: 'CONTENT',
  OPERATIONS: 'OPERATIONS',
  FINANCE: 'FINANCE',
} as const;

export type SkillCategory = (typeof SkillCategory)[keyof typeof SkillCategory];

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;

export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const DiagnosticStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED',
} as const;

export type DiagnosticStatus = (typeof DiagnosticStatus)[keyof typeof DiagnosticStatus];

export const LessonStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type LessonStatus = (typeof LessonStatus)[keyof typeof LessonStatus];

// ============== SKILL PROFILE ==============

export interface SkillProfile {
  analytics: number; // 0-100
  marketing: number;
  content: number;
  operations: number;
  finance: number;
}

export const SKILL_LABELS: Record<SkillCategory, string> = {
  ANALYTICS: 'Аналитика',
  MARKETING: 'Маркетинг',
  CONTENT: 'Контент',
  OPERATIONS: 'Операции',
  FINANCE: 'Финансы',
};

// ============== DIAGNOSTIC ==============

export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: Difficulty;
  skillCategory: SkillCategory;
}

export interface DiagnosticAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  difficulty: Difficulty;
  skillCategory: SkillCategory;
}

// ============== LEARNING ==============

export interface Course {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  duration: number;
  order: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  videoId: string | null;
  duration: number;
  order: number;
  skillCategory: SkillCategory;
  skillLevel: Difficulty;
}

export interface LessonWithProgress extends Lesson {
  status: LessonStatus;
  watchedPercent: number;
}

// ============== AI / RAG ==============

export interface ContentChunk {
  id: string;
  lessonId: string;
  content: string;
  timecodeStart: number;
  timecodeEnd: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface Citation {
  lessonId: string;
  lessonTitle: string;
  timecodeStart: number;
  timecodeEnd: number;
  text: string;
}

// ============== DIAGNOSTIC RESULTS ==============

export interface SkillGap {
  category: SkillCategory;
  label: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedLessons: string[];
}

export interface DiagnosticResult {
  sessionId: string;
  completedAt: Date;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  skillProfile: SkillProfile;
  gaps: SkillGap[];
  recommendedPath: string[];
}

export interface DiagnosticSessionState {
  sessionId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredQuestions: DiagnosticAnswer[];
  currentQuestion: DiagnosticQuestion | null;
  isComplete: boolean;
}

// ============== DASHBOARD ==============

export interface UserStats {
  totalLessonsCompleted: number;
  totalWatchTime: number; // minutes
  currentStreak: number; // days
  longestStreak: number;
  averageScore: number;
  lastActivityAt: Date | null;
}

export interface RecentActivity {
  id: string;
  type: 'lesson_completed' | 'diagnostic_completed' | 'lesson_started';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: {
    lessonId?: string;
    courseId?: string;
    score?: number;
  };
}

export interface DashboardData {
  stats: UserStats;
  skillProfile: SkillProfile | null;
  recentActivity: RecentActivity[];
  nextLesson: LessonWithProgress | null;
  completionPercent: number;
}

// ============== COURSE WITH PROGRESS ==============

export interface CourseWithProgress extends Course {
  lessons: LessonWithProgress[];
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
}

// ============== KINESCOPE ==============

export const getKinescopeEmbedUrl = (videoId: string): string =>
  `https://kinescope.io/embed/${videoId}`;

export const getKinescopeEmbedUrlWithTime = (videoId: string, seconds: number): string =>
  `https://kinescope.io/embed/${videoId}?t=${seconds}`;

export const formatTimecode = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
