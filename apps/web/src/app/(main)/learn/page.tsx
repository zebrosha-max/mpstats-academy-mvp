'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LessonCard } from '@/components/learning/LessonCard';
import { SearchBar } from '@/components/learning/SearchBar';
import { FilterPanel, type FilterState, DEFAULT_FILTERS } from '@/components/learning/FilterPanel';
import { SearchResultCard } from '@/components/learning/SearchResultCard';
import { CourseLockBanner } from '@/components/learning/PaywallBanner';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import type { LessonWithProgress } from '@mpstats/shared';

const INITIAL_LESSONS_SHOWN = 5;

const SECTION_STYLES: Record<string, { icon: string; bgColor: string; borderColor: string; textColor: string; badgeColor: string }> = {
  errors: { icon: '!', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700', badgeColor: 'bg-red-100 text-red-700' },
  deepening: { icon: '\u2193', bgColor: 'bg-mp-blue-50', borderColor: 'border-mp-blue-200', textColor: 'text-mp-blue-700', badgeColor: 'bg-mp-blue-100 text-mp-blue-700' },
  growth: { icon: '\u2191', bgColor: 'bg-mp-green-50', borderColor: 'border-mp-green-200', textColor: 'text-mp-green-700', badgeColor: 'bg-mp-green-100 text-mp-green-700' },
  advanced: { icon: '\u2605', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-700', badgeColor: 'bg-yellow-100 text-yellow-700' },
};

function isDatabaseUnavailable(errorMessage: string): boolean {
  return errorMessage === 'DATABASE_UNAVAILABLE' || errorMessage.includes('DATABASE_UNAVAILABLE');
}

export default function LearnPage() {
  const [viewMode, setViewMode] = useState<'path' | 'courses'>('courses');
  const [viewModeInitialized, setViewModeInitialized] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['errors']));

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const { data: courses, isLoading: coursesLoading, error: coursesError } = trpc.learning.getCourses.useQuery();
  const { data: path, isLoading: pathLoading, error: pathError } = trpc.learning.getPath.useQuery();
  const { data: hasDiagnostic, isLoading: diagLoading } = trpc.diagnostic.hasCompletedDiagnostic.useQuery();
  const { data: recommendedPath } = trpc.learning.getRecommendedPath.useQuery(
    undefined,
    { enabled: hasDiagnostic === true }
  );

  // Search query
  const { data: searchResults, isLoading: searchLoading, error: searchError } = trpc.ai.searchLessons.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  // Smart default: show "Мой трек" if user has completed diagnostic
  useEffect(() => {
    if (!diagLoading && !viewModeInitialized) {
      setViewMode(hasDiagnostic ? 'path' : 'courses');
      setViewModeInitialized(true);
    }
  }, [hasDiagnostic, diagLoading, viewModeInitialized]);

  // Auto-expand course from URL hash (e.g. /learn#01_analytics)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && courses?.some((c) => c.id === hash)) {
      setExpandedCourses((prev) => new Set(prev).add(hash));
      setViewMode('courses');
      setTimeout(() => {
        document.getElementById(`course-${hash}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [courses]);

  // O(1) lookup for recommended lesson IDs
  const recommendedLessonIds = new Set(
    recommendedPath?.lessons.map((l) => l.id) ?? []
  );

  // Extract available topics from courses data
  const availableTopics = useMemo(() => {
    if (!courses) return [];
    const topicCount = new Map<string, number>();
    courses.forEach(course => {
      course.lessons.forEach(lesson => {
        const topics = ((lesson as unknown) as Record<string, unknown>).topics as string[] | undefined;
        if (topics) {
          topics.forEach(t => topicCount.set(t, (topicCount.get(t) || 0) + 1));
        }
      });
    });
    return Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([topic]) => topic);
  }, [courses]);

  // Extract available courses for dropdown
  const availableCourses = useMemo(() => {
    if (!courses) return [];
    return courses.map(c => ({ id: c.id, title: c.title }));
  }, [courses]);

  // Filter search results client-side
  const filteredSearchResults = useMemo(() => {
    if (!searchResults?.results) return [];
    return searchResults.results.filter(r => {
      if (filters.category !== 'ALL' && r.lesson.skillCategory !== filters.category) return false;
      if (filters.status !== 'ALL' && r.status !== filters.status) return false;
      if (filters.difficulty !== 'ALL' && r.lesson.skillLevel !== filters.difficulty) return false;
      if (filters.courseId !== 'ALL' && r.lesson.courseId !== filters.courseId) return false;
      if (filters.duration !== 'ALL') {
        const d = r.lesson.duration;
        if (filters.duration === 'short' && d > 10) return false;
        if (filters.duration === 'medium' && (d <= 10 || d > 30)) return false;
        if (filters.duration === 'long' && d <= 30) return false;
      }
      if (filters.topics.length > 0) {
        if (!filters.topics.some(t => r.lesson.topics.includes(t))) return false;
      }
      if (filters.marketplace !== 'ALL') {
        if (filters.marketplace === 'OZON') {
          if (r.lesson.courseId !== '05_ozon') return false;
        } else {
          // WB = everything except OZON course
          if (r.lesson.courseId === '05_ozon') return false;
        }
      }
      return true;
    });
  }, [searchResults, filters]);

  // Unified filter function for courses/track views
  const filterLesson = (lesson: LessonWithProgress) => {
    if (filters.category !== 'ALL' && lesson.skillCategory !== filters.category) return false;
    if (filters.status !== 'ALL' && lesson.status !== filters.status) return false;
    if (filters.difficulty !== 'ALL' && (((lesson as unknown) as Record<string, unknown>).skillLevel as string || 'MEDIUM') !== filters.difficulty) return false;
    if (filters.duration !== 'ALL') {
      const d = lesson.duration;
      if (filters.duration === 'short' && d > 10) return false;
      if (filters.duration === 'medium' && (d <= 10 || d > 30)) return false;
      if (filters.duration === 'long' && d <= 30) return false;
    }
    if (filters.topics.length > 0) {
      const lt = (((lesson as unknown) as Record<string, unknown>).topics as string[] | undefined) ?? [];
      if (!filters.topics.some(t => lt.includes(t))) return false;
    }
    if (filters.marketplace !== 'ALL') {
      const courseId = ((lesson as unknown) as Record<string, unknown>).courseId as string || '';
      if (filters.marketplace === 'OZON') {
        if (courseId !== '05_ozon') return false;
      } else {
        // WB = everything except OZON course
        if (courseId === '05_ozon') return false;
      }
    }
    if (filters.courseId !== 'ALL' && ((lesson as unknown) as Record<string, unknown>).courseId !== filters.courseId) return false;
    return true;
  };

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

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const isSectioned = useMemo(
    () => recommendedPath?.isSectioned === true && !!recommendedPath?.sections,
    [recommendedPath],
  );

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
        ) : searchQuery.length === 0 && (
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

      {/* Search Bar */}
      <SearchBar
        onSearch={(q) => setSearchQuery(q)}
        onClear={() => setSearchQuery('')}
        isSearching={searchLoading}
        hasResults={searchQuery.length > 0}
      />

      {/* Filters */}
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        availableTopics={availableTopics}
        availableCourses={availableCourses}
      />

      {/* Track progress bar (only in "Мой трек" view with data, not in search mode) */}
      {searchQuery.length === 0 && viewMode === 'path' && recommendedPath && recommendedPath.totalLessons > 0 && (
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
      {searchQuery.length === 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
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
      )}

      {searchQuery.length > 0 ? (
        /* Search Results View */
        <div>
          {searchLoading && (
            <p className="text-body-sm text-mp-gray-500">Ищем релевантные уроки...</p>
          )}
          {searchError && (
            <p className="text-body-sm text-red-500">Не удалось выполнить поиск. Попробуйте ещё раз.</p>
          )}
          {!searchLoading && searchResults && (
            <>
              <p className="text-body-sm text-mp-gray-500 mb-3" aria-live="polite">
                {filteredSearchResults.length} уроков найдено
              </p>
              {filteredSearchResults.length > 0 ? (
                <div className="space-y-3" aria-busy={searchLoading}>
                  {filteredSearchResults.map((result, i) => (
                    <div key={result.lesson.id} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                      <SearchResultCard result={result} />
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty search state */
                <div className="py-12 text-center">
                  <svg className="w-16 h-16 text-mp-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="text-heading text-mp-gray-900 mb-2">Ничего не найдено</h3>
                  <p className="text-body text-mp-gray-500 mb-4">
                    Попробуйте переформулировать запрос или выберите один из популярных топиков
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {availableTopics.slice(0, 5).map(topic => (
                      <button
                        key={topic}
                        onClick={() => setSearchQuery(topic)}
                        className="px-3 py-1 rounded-full bg-mp-gray-100 text-body-sm text-mp-gray-600 hover:bg-mp-gray-200 cursor-pointer transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : viewMode === 'path' ? (
        <>
          {/* Case A: No diagnostic completed -- show CTA banner */}
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

          {/* Case B: Track complete -- congratulatory message */}
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
            <div className="space-y-4">
              {isSectioned ? (
                /* Sectioned accordion view */
                <>
                  {recommendedPath.sections!.map((section) => {
                    const style = SECTION_STYLES[section.id] || SECTION_STYLES.growth;
                    const isOpen = expandedSections.has(section.id);
                    const completedInSection = section.lessons.filter((l: { status: string }) => l.status === 'COMPLETED').length;

                    return (
                      <Card key={section.id} className={`shadow-mp-card ${style.borderColor}`}>
                        {/* Section header -- clickable to expand/collapse */}
                        <button
                          onClick={() => toggleSection(section.id)}
                          className={`w-full text-left px-6 py-4 flex items-center justify-between ${style.bgColor} rounded-t-lg`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${style.badgeColor}`}>
                              {style.icon}
                            </span>
                            <div>
                              <h3 className={`text-heading font-semibold ${style.textColor}`}>{section.title}</h3>
                              <p className="text-body-sm text-mp-gray-500">{section.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-body-sm text-mp-gray-500">
                              {completedInSection}/{section.lessons.length}
                            </span>
                            <svg className={`w-5 h-5 text-mp-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* Section content -- collapsible */}
                        {isOpen && (
                          <CardContent className="pt-3 pb-4">
                            <div className="grid gap-3">
                              {section.lessons
                                .filter((lesson) => filterLesson(lesson as LessonWithProgress))
                                .map((lesson, idx: number) => (
                                <LessonCard
                                  key={lesson.id}
                                  lesson={{ ...lesson, title: `${idx + 1}. ${lesson.title}` } as LessonWithProgress}
                                  showCourse
                                  courseName={((lesson as unknown) as Record<string, unknown>).courseName as string}
                                  isRecommended={section.id === 'errors'}
                                  locked={lesson.locked}
                                />
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                  {/* Re-diagnostic CTA when errors section is fully completed */}
                  {recommendedPath.sections!.find((s: { id: string }) => s.id === 'errors')?.lessons.every((l: { status: string }) => l.status === 'COMPLETED') && (
                    <Card className="shadow-mp-card border-mp-green-200 bg-gradient-to-br from-mp-green-50 to-white">
                      <CardContent className="py-8 text-center">
                        <h3 className="text-heading text-mp-gray-900 mb-2">Отлично! Все ошибки проработаны</h3>
                        <p className="text-body text-mp-gray-500 mb-4">
                          Хочешь проверить, как вырос твой уровень? Пройди диагностику снова!
                        </p>
                        <Link href="/diagnostic">
                          <Button variant="outline">Пройти диагностику снова</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                /* Fallback: flat list for old-format paths */
                <div className="space-y-3">
                  {(() => {
                    const showGating = recommendedPath.hasPlatformSubscription === false
                      && recommendedPath.lessons.some(l => l.locked);
                    const visibleCount = showGating ? 3 : recommendedPath.lessons.length;
                    const visibleLessons = recommendedPath.lessons.slice(0, visibleCount);
                    const hiddenLessons = showGating ? recommendedPath.lessons.slice(visibleCount) : [];

                    return (
                      <>
                        {visibleLessons
                          .filter((lesson) => filterLesson(lesson as LessonWithProgress))
                          .map((lesson, idx: number) => (
                          <LessonCard
                            key={lesson.id}
                            lesson={{ ...lesson, title: `${idx + 1}. ${lesson.title}` } as LessonWithProgress}
                            showCourse
                            courseName={((lesson as unknown) as Record<string, unknown>).courseName as string}
                            isRecommended
                            locked={lesson.locked}
                          />
                        ))}
                        {hiddenLessons.length > 0 && (
                          <>
                            <div className="blur-sm pointer-events-none select-none space-y-3">
                              {hiddenLessons.map((lesson, idx) => (
                                <LessonCard
                                  key={lesson.id}
                                  lesson={{ ...lesson, title: `${visibleCount + idx + 1}. ${lesson.title}` } as LessonWithProgress}
                                  showCourse
                                  courseName={((lesson as unknown) as Record<string, unknown>).courseName as string}
                                  locked
                                />
                              ))}
                            </div>
                            <Card className="shadow-mp-card border-mp-blue-200 bg-gradient-to-br from-mp-blue-50 to-white">
                              <CardContent className="py-8 text-center">
                                <h3 className="text-heading text-mp-gray-900 mb-2">
                                  Получите полный персональный трек
                                </h3>
                                <p className="text-body text-mp-gray-500 mb-4">
                                  Ещё {hiddenLessons.length} уроков доступны с полной подпиской
                                </p>
                                <Link href="/pricing">
                                  <Button size="lg">Оформить полный доступ</Button>
                                </Link>
                              </CardContent>
                            </Card>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Case D: Diagnostic done but empty or no path (all skills above target) */}
          {hasDiagnostic && (!recommendedPath || (recommendedPath && recommendedPath.lessons.length === 0)) && !isTrackComplete && (
            <Card className="shadow-mp-card border-mp-green-200 bg-gradient-to-br from-mp-green-50 to-white">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-mp-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-mp-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-heading text-mp-gray-900 mb-2">Отличный результат!</h2>
                <p className="text-body text-mp-gray-500 mb-6 max-w-md mx-auto">
                  Все навыки на высоком уровне. Можешь изучать любые курсы или пройти диагностику снова для проверки.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => setViewMode('courses')}>Все курсы</Button>
                  <Link href="/diagnostic">
                    <Button>Проверить прогресс</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Courses view */
        <div className="space-y-6">
          {courses?.map((course) => {
            // Apply filters to lessons in course view
            const filteredCourseLessons = course.lessons.filter(lesson => filterLesson(lesson));
            if (filteredCourseLessons.length === 0 && (filters.category !== 'ALL' || filters.status !== 'ALL' || filters.topics.length > 0 || filters.difficulty !== 'ALL' || filters.duration !== 'ALL' || filters.marketplace !== 'ALL')) {
              return null; // Hide empty courses when filters are active
            }

            const isExpanded = expandedCourses.has(course.id);
            const visibleLessons = isExpanded
              ? filteredCourseLessons
              : filteredCourseLessons.slice(0, INITIAL_LESSONS_SHOWN);
            const hiddenCount = filteredCourseLessons.length - INITIAL_LESSONS_SHOWN;

            // Skip if courseId filter is active and doesn't match
            if (filters.courseId !== 'ALL' && course.id !== filters.courseId) return null;

            // Find first lesson to continue watching
            const continueLesson = course.lessons.find(
              (l) => l.status === 'IN_PROGRESS'
            ) || (course.progressPercent > 0
              ? course.lessons.find((l) => l.status === 'NOT_STARTED')
              : null);

            return (
              <Card key={course.id} id={`course-${course.id}`} className="shadow-mp-card">
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
                        locked={lesson.locked}
                      />
                    ))}
                  </div>
                  <CourseLockBanner lockedCount={course.lessons.filter(l => l.locked).length} />
                  {hiddenCount > 0 && (
                    <div className="mt-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCourseExpanded(course.id)}
                      >
                        {isExpanded
                          ? 'Скрыть'
                          : `Показать все ${filteredCourseLessons.length} уроков`}
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
