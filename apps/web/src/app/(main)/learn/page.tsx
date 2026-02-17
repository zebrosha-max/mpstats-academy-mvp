'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LessonCard } from '@/components/learning/LessonCard';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import type { SkillCategory } from '@mpstats/shared';

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
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  const { data: courses, isLoading: coursesLoading, error: coursesError } = trpc.learning.getCourses.useQuery();
  const { data: path, isLoading: pathLoading, error: pathError } = trpc.learning.getPath.useQuery();

  const isLoading = coursesLoading || pathLoading;
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
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'path' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('path')}
          >
            Мой план
          </Button>
          <Button
            variant={viewMode === 'courses' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('courses')}
          >
            Все курсы
          </Button>
        </div>
      </div>

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
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setCategoryFilter(filter.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-body-sm font-medium transition-all duration-200',
                    categoryFilter === filter.value
                      ? 'bg-mp-blue-600 text-white shadow-mp-sm'
                      : 'bg-mp-gray-100 text-mp-gray-600 hover:bg-mp-gray-200'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-mp-gray-300 text-body-sm bg-white focus:ring-2 focus:ring-mp-blue-500 focus:border-mp-blue-500"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          {/* Lessons list */}
          {filteredLessons.length > 0 ? (
            <div className="grid gap-4">
              {filteredLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          ) : (
            <Card className="shadow-mp-card">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-body text-mp-gray-500">Нет уроков по выбранным фильтрам</p>
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
                  {/* Course progress */}
                  <div className="mt-4">
                    <div className="h-2 bg-mp-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-mp-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${course.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {visibleLessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        showCourse={false}
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
