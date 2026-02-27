'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LessonCard } from '@/components/learning/LessonCard';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import type { SkillCategory, LessonWithProgress } from '@mpstats/shared';

const CATEGORY_FILTERS: { value: SkillCategory | 'ALL'; label: string; color: string }[] = [
  { value: 'ALL', label: 'Все', color: 'bg-mp-gray-100 text-mp-gray-700' },
  { value: 'ANALYTICS', label: 'Аналитика', color: 'bg-mp-blue-100 text-mp-blue-700' },
  { value: 'MARKETING', label: 'Маркетинг', color: 'bg-mp-green-100 text-mp-green-700' },
  { value: 'CONTENT', label: 'Контент', color: 'bg-mp-pink-100 text-mp-pink-700' },
  { value: 'OPERATIONS', label: 'Операции', color: 'bg-orange-100 text-orange-700' },
  { value: 'FINANCE', label: 'Финансы', color: 'bg-yellow-100 text-yellow-700' },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Все уроки' },
  { value: 'NOT_STARTED', label: 'Не начатые' },
  { value: 'IN_PROGRESS', label: 'В процессе' },
  { value: 'COMPLETED', label: 'Завершённые' },
];

const INITIAL_LESSONS_SHOWN = 5;

function isDatabaseUnavailable(errorMessage: string): boolean {
  return errorMessage === 'DATABASE_UNAVAILABLE' || errorMessage.includes('DATABASE_UNAVAILABLE');
}

export default function LearnPage() {
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'path' | 'courses'>('courses');
  const [viewModeInitialized, setViewModeInitialized] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  const { data: courses, isLoading: coursesLoading, error: coursesError } = trpc.learning.getCourses.useQuery();
  const { data: path, isLoading: pathLoading, error: pathError } = trpc.learning.getPath.useQuery();
  const { data: hasDiagnostic, isLoading: diagLoading } = trpc.diagnostic.hasCompletedDiagnostic.useQuery();
  const { data: recommendedPath } = trpc.learning.getRecommendedPath.useQuery(
    undefined,
    { enabled: hasDiagnostic === true }
  );

  // Smart default: show "Мой трек" if user has completed diagnostic
  useEffect(() => {
    if (!diagLoading && !viewModeInitialized) {
      setViewMode(hasDiagnostic ? 'path' : 'courses');
      setViewModeInitialized(true);
    }
  }, [hasDiagnostic, diagLoading, viewModeInitialized]);

  // O(1) lookup for recommended lesson IDs
  const recommendedLessonIds = new Set(
    recommendedPath?.lessons.map((l) => l.id) ?? []
  );

  const isLoading = coursesLoading || pathLoading || (diagLoading && !viewModeInitialized);
  const error = coursesError || pathError;

  const toggleCourseExpanded = (courseId: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  // Filter lessons
  const filteredLessons = path?.lessons.filter((lesson) => {
    if (categoryFilter !== 'ALL' && lesson.skillCategory !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && lesson.status !== statusFilter) return false;
    return true;
  }) || [];

  // Stats
  const stats = {
    total: path?.totalLessons || 0,
    completed: path?.completedLessons || 0,
    inProgress: path?.lessons.filter(l => l.status === 'IN_PROGRESS').length || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-mp-gray-200 rounded-lg w-48 animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-mp-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const isDbDown = isDatabaseUnavailable(error.message);
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-mp-card border-red-200">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-heading text-mp-gray-900 mb-2">
              {isDbDown ? 'База данных недоступна' : 'Ошибка загрузки'}
            </h2>
            <p className="text-body text-mp-gray-500">
              {isDbDown
                ? 'Не удалось подключиться к базе данных. Попробуйте обновить страницу через несколько минут.'
                : 'Произошла ошибка при загрузке курсов. Попробуйте обновить страницу.'}
            </p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Обновить страницу
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Track completion state
  const isTrackComplete = recommendedPath &&
    recommendedPath.completedLessons === recommendedPath.totalLessons &&
    recommendedPath.totalLessons > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="text-display-sm text-mp-gray-900">Обучение</h1>
          <p className="text-body text-mp-gray-500 mt-1">
            Персональный план на основе диагностики
          </p>
        </div>
        {!viewModeInitialized ? (
          <div className="h-10 bg-mp-gray-200 rounded-lg w-48 animate-pulse" />
        ) : (
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'path' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('path')}
            >
              Мой трек
            </Button>
            <Button
              variant={viewMode === 'courses' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('courses')}
            >
              Все курсы
            </Button>
          </div>
        )}
      </div>

      {/* Track progress bar (only in "Мой трек" view with data) */}
      {viewMode === 'path' && recommendedPath && recommendedPath.totalLessons > 0 && (
        <div className="animate-slide-up" style={{ animationDelay: '25ms' }}>
          <div className="flex justify-between text-body-sm text-mp-gray-600 mb-2">
            <span>Прогресс трека</span>
            <span className="font-medium">{recommendedPath.completedLessons}/{recommendedPath.totalLessons} уроков завершено</span>
          </div>
          <div className="h-2 bg-mp-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-mp-green-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((recommendedPath.completedLessons / recommendedPath.totalLessons) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <Card className="shadow-mp-card">
          <CardContent className="py-5 text-center">
            <div className="text-display-sm font-bold text-mp-green-500">{stats.completed}</div>
            <div className="text-body-sm text-mp-gray-500">Завершено</div>
          </CardContent>
        </Card>
        <Card className="shadow-mp-card">
          <CardContent className="py-5 text-center">
            <div className="text-display-sm font-bold text-mp-blue-500">{stats.inProgress}</div>
            <div className="text-body-sm text-mp-gray-500">В процессе</div>
          </CardContent>
        </Card>
        <Card className="shadow-mp-card">
          <CardContent className="py-5 text-center">
            <div className="text-display-sm font-bold text-mp-gray-900">{stats.total}</div>
            <div className="text-body-sm text-mp-gray-500">Всего</div>
          </CardContent>
        </Card>
      </div>

      {viewMode === 'path' ? (
        <>
          {/* Case A: No diagnostic completed — show CTA banner */}
          {hasDiagnostic === false && (
            <Card className="shadow-mp-card border-mp-blue-200 bg-gradient-to-br from-mp-blue-50 to-white">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-mp-blue-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-heading text-mp-gray-900 mb-2">Персональный трек обучения</h2>
                <p className="text-body text-mp-gray-500 mb-6 max-w-md mx-auto">
                  Пройди диагностику, чтобы получить персональный трек обучения на основе твоих навыков
                </p>
                <Link href="/diagnostic">
                  <Button size="lg">Начать диагностику</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Case B: Track complete — congratulatory message */}
          {hasDiagnostic && isTrackComplete && (
            <Card className="shadow-mp-card border-mp-green-200 bg-gradient-to-br from-mp-green-50 to-white">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-mp-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-mp-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-heading text-mp-gray-900 mb-2">Отличная работа!</h2>
                <p className="text-body text-mp-gray-500 mb-6 max-w-md mx-auto">
                  Ты завершил все рекомендованные уроки. Пройди диагностику снова, чтобы проверить прогресс!
                </p>
                <Link href="/diagnostic">
                  <Button size="lg">Проверь свой прогресс</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Case C: Normal track with lessons */}
          {hasDiagnostic && recommendedPath && !isTrackComplete && recommendedPath.lessons.length > 0 && (
            <div className="space-y-3">
              {recommendedPath.lessons.map((lesson, idx) => (
                <LessonCard
                  key={lesson.id}
                  lesson={{ ...lesson, title: `${idx + 1}. ${lesson.title}` } as LessonWithProgress}
                  showCourse
                  courseName={lesson.courseName}
                  isRecommended
                />
              ))}
            </div>
          )}

          {/* Case D: Diagnostic done but no recommended path (edge case) */}
          {hasDiagnostic && !recommendedPath && (
            <Card className="shadow-mp-card">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-body text-mp-gray-500">Персональный трек пока не сформирован. Попробуйте пройти диагностику заново.</p>
                <Link href="/diagnostic" className="mt-4 inline-block">
                  <Button>Пройти диагностику</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Courses view */
        <div className="space-y-6">
          {courses?.map((course) => {
            const isExpanded = expandedCourses.has(course.id);
            const visibleLessons = isExpanded
              ? course.lessons
              : course.lessons.slice(0, INITIAL_LESSONS_SHOWN);
            const hiddenCount = course.lessons.length - INITIAL_LESSONS_SHOWN;

            // Find first lesson to continue watching
            const continueLesson = course.lessons.find(
              (l) => l.status === 'IN_PROGRESS'
            ) || (course.progressPercent > 0
              ? course.lessons.find((l) => l.status === 'NOT_STARTED')
              : null);

            return (
              <Card key={course.id} className="shadow-mp-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-heading">{course.title}</CardTitle>
                      <CardDescription className="text-body-sm">{course.description}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-display-sm font-bold text-mp-gray-900">
                        {course.completedLessons}/{course.totalLessons}
                      </div>
                      <div className="text-body-sm text-mp-gray-500">уроков</div>
                    </div>
                  </div>
                  {/* Course progress bar */}
                  {course.progressPercent > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        {course.progressPercent === 100 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium border border-mp-green-200 bg-mp-green-50 text-mp-green-700">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Курс завершён
                          </span>
                        ) : (
                          <span className="text-caption text-mp-gray-500">{course.progressPercent}% завершено</span>
                        )}
                        {continueLesson && course.progressPercent < 100 && (
                          <Link href={`/learn/${continueLesson.id}`}>
                            <Button variant="ghost" size="sm" className="text-caption text-mp-blue-600 hover:text-mp-blue-700 h-auto py-0.5 px-2">
                              Продолжить просмотр
                              <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Button>
                          </Link>
                        )}
                      </div>
                      <div className="h-1.5 bg-mp-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            course.progressPercent === 100 ? 'bg-mp-green-500' : 'bg-mp-blue-500'
                          )}
                          style={{ width: `${course.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {visibleLessons.map((lesson, idx) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={{ ...lesson, title: `${idx + 1}. ${lesson.title}` }}
                        showCourse={false}
                        isRecommended={recommendedLessonIds.has(lesson.id)}
                      />
                    ))}
                  </div>
                  {hiddenCount > 0 && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCourseExpanded(course.id)}
                      >
                        {isExpanded
                          ? 'Скрыть'
                          : `Показать все ${course.lessons.length} уроков`}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
