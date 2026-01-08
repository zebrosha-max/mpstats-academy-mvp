'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { LessonWithProgress } from '@mpstats/shared';

interface LessonCardProps {
  lesson: LessonWithProgress;
  showCourse?: boolean;
  courseName?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  ANALYTICS: 'bg-mp-blue-100 text-mp-blue-700',
  MARKETING: 'bg-mp-green-100 text-mp-green-700',
  CONTENT: 'bg-mp-pink-100 text-mp-pink-700',
  OPERATIONS: 'bg-orange-100 text-orange-700',
  FINANCE: 'bg-yellow-100 text-yellow-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  ANALYTICS: 'Аналитика',
  MARKETING: 'Маркетинг',
  CONTENT: 'Контент',
  OPERATIONS: 'Операции',
  FINANCE: 'Финансы',
};

const STATUS_CONFIG = {
  NOT_STARTED: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-mp-gray-400',
    label: 'Не начат',
  },
  IN_PROGRESS: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-mp-blue-500',
    label: 'В процессе',
  },
  COMPLETED: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-mp-green-500',
    label: 'Завершён',
  },
};

export function LessonCard({ lesson, showCourse, courseName }: LessonCardProps) {
  const status = STATUS_CONFIG[lesson.status];

  return (
    <Link href={`/learn/${lesson.id}`}>
      <Card className="shadow-mp-card hover:shadow-mp-card-hover transition-all duration-300 cursor-pointer h-full hover:-translate-y-0.5">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Status icon */}
            <div className={cn('flex-shrink-0 mt-1', status.color)}>
              {status.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Course name */}
              {showCourse && courseName && (
                <div className="text-caption text-mp-gray-500 mb-1">{courseName}</div>
              )}

              {/* Title */}
              <h3 className="font-medium text-mp-gray-900 line-clamp-2">
                {lesson.title}
              </h3>

              {/* Description */}
              {lesson.description && (
                <p className="text-body-sm text-mp-gray-500 mt-1 line-clamp-2">
                  {lesson.description}
                </p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 mt-3">
                <span className={cn('px-2 py-0.5 rounded-md text-caption font-medium', CATEGORY_COLORS[lesson.skillCategory])}>
                  {CATEGORY_LABELS[lesson.skillCategory]}
                </span>
                <span className="text-caption text-mp-gray-500 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {lesson.duration} мин
                </span>
              </div>

              {/* Progress bar for in-progress */}
              {lesson.status === 'IN_PROGRESS' && lesson.watchedPercent > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-caption text-mp-gray-500 mb-1">
                    <span>Прогресс</span>
                    <span>{lesson.watchedPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-mp-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-mp-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${lesson.watchedPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Arrow */}
            <svg className="w-5 h-5 text-mp-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
