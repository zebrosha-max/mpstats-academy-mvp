'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';
import type { LibraryAxis, LibraryBlock, LibraryLesson } from '@mpstats/shared';

const AXIS_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  ANALYTICS: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  MARKETING: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  CONTENT: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700' },
  OPERATIONS: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  FINANCE: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

function StatusIcon({ status, watchedPercent }: { status: string; watchedPercent: number }) {
  if (status === 'COMPLETED') {
    return (
      <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <div className="relative w-4 h-4 shrink-0">
        <svg className="w-4 h-4 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>
        <svg className="w-4 h-4 text-blue-500 absolute inset-0" viewBox="0 0 20 20">
          <circle
            cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${(watchedPercent / 100) * 50.26} 50.26`}
            strokeLinecap="round"
            transform="rotate(-90 10 10)"
          />
        </svg>
      </div>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LibraryLessonRow({ lesson }: { lesson: LibraryLesson }) {
  return (
    <Link
      href={`/learn/${lesson.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
        'hover:bg-gray-50',
        lesson.locked && 'opacity-50 pointer-events-none',
      )}
    >
      <StatusIcon status={lesson.status} watchedPercent={lesson.watchedPercent} />
      <span className="text-sm text-gray-900 flex-1 min-w-0 truncate">{lesson.title}</span>
      {lesson.duration > 0 && (
        <span className="text-xs text-gray-400 shrink-0">{lesson.duration} мин</span>
      )}
    </Link>
  );
}

function BlockCard({ block, style }: { block: LibraryBlock; style: typeof AXIS_STYLES.ANALYTICS }) {
  const [expanded, setExpanded] = useState(false);
  const preview = expanded ? block.lessons : block.lessons.slice(0, 3);
  const hasMore = block.lessons.length > 3;
  const totalDuration = block.lessons.reduce((s, l) => s + l.duration, 0);

  return (
    <div className={cn('rounded-xl border p-4', style.border, 'bg-white')}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">{block.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{block.description}</p>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0 ml-2', style.badge)}>
          {block.lessons.length}
        </span>
      </div>
      <div className="text-xs text-gray-400 mb-2">{formatDuration(totalDuration)}</div>
      <div className="space-y-0.5">
        {preview.map((lesson) => (
          <LibraryLessonRow key={lesson.id} lesson={lesson} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {expanded ? 'Скрыть' : `Ещё ${block.lessons.length - 3} уроков`}
        </button>
      )}
    </div>
  );
}

export function LibrarySection() {
  const { data: library, isLoading } = trpc.learning.getLibrary.useQuery();
  const [activeAxis, setActiveAxis] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="shadow-mp-card">
        <CardHeader>
          <CardTitle className="text-heading">Библиотека</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  if (!library || library.length === 0) return null;

  const selected = activeAxis ? library.find((a) => a.axis === activeAxis) : library[0];
  // Count unique lessons across all axes (a lesson can appear in multiple axes)
  const allLessonIds = new Set(library.flatMap((a) => a.blocks.flatMap((b) => b.lessons.map((l) => l.id))));
  const totalLessons = allLessonIds.size;

  return (
    <Card className="shadow-mp-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-heading">Библиотека</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Отдельные уроки по навыкам — {totalLessons} уроков
            </p>
          </div>
        </div>
        {/* Axis tabs */}
        <div className="flex flex-wrap gap-2 mt-4">
          {library.map((axis) => {
            const style = AXIS_STYLES[axis.axis] || AXIS_STYLES.ANALYTICS;
            const isActive = (activeAxis || library[0]?.axis) === axis.axis;
            return (
              <button
                key={axis.axis}
                onClick={() => setActiveAxis(axis.axis)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? cn(style.badge, 'ring-1', style.border)
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {axis.title}
                <span className="ml-1.5 text-xs opacity-70">{axis.totalLessons}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {selected && (
          <div className="grid gap-4 sm:grid-cols-2">
            {selected.blocks.map((block) => (
              <BlockCard
                key={block.block}
                block={block}
                style={AXIS_STYLES[selected.axis] || AXIS_STYLES.ANALYTICS}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
