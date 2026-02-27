'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { CourseManager } from '@/components/admin/CourseManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_LABELS: Record<string, string> = {
  ANALYTICS: 'Аналитика',
  MARKETING: 'Маркетинг',
  CONTENT: 'Контент',
  OPERATIONS: 'Операции',
  FINANCE: 'Финансы',
};

export default function ContentPage() {
  const courses = trpc.admin.getCourses.useQuery();

  const totalLessons = courses.data?.reduce((s, c) => s + c._count.lessons, 0) ?? 0;
  const totalChunks = courses.data?.reduce((s, c) => s + c.chunkCount, 0) ?? 0;

  // Question Bank refresh
  const [refreshResult, setRefreshResult] = useState<Record<
    string,
    { success: boolean; count: number }
  > | null>(null);

  const refreshBank = trpc.admin.refreshQuestionBank.useMutation({
    onSuccess: (data) => {
      setRefreshResult(data);
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-heading-lg font-bold text-mp-gray-900">Content</h2>
          <p className="text-body-sm text-mp-gray-500 mt-1">
            Courses, lessons, and RAG coverage
          </p>
        </div>
        {courses.data && (
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="lg">
              {courses.data.length} courses
            </Badge>
            <Badge variant="success" size="lg">
              {totalLessons} lessons
            </Badge>
            <Badge variant="default" size="lg">
              {totalChunks} chunks
            </Badge>
          </div>
        )}
      </div>

      {/* Question Bank */}
      <Card className="shadow-mp-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-heading">Банк AI-вопросов</CardTitle>
              <p className="text-body-sm text-mp-gray-500 mt-1">
                Глобальный банк вопросов для диагностики. Автообновление каждые 7 дней.
              </p>
            </div>
            <Button
              onClick={() => refreshBank.mutate()}
              disabled={refreshBank.isPending}
              variant="outline"
              size="sm"
            >
              {refreshBank.isPending ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Генерация...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Обновить вопросы</span>
                </div>
              )}
            </Button>
          </div>
        </CardHeader>
        {refreshResult && (
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(refreshResult).map(([category, result]) => (
                <div
                  key={category}
                  className={`rounded-lg p-3 text-center ${
                    result.success
                      ? 'bg-mp-green-50 border border-mp-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <p className="text-caption font-medium text-mp-gray-700">
                    {CATEGORY_LABELS[category] || category}
                  </p>
                  <p className={`text-heading font-bold ${
                    result.success ? 'text-mp-green-600' : 'text-red-600'
                  }`}>
                    {result.success ? result.count : 'Ошибка'}
                  </p>
                  {result.success && (
                    <p className="text-caption text-mp-gray-400">вопросов</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
        {refreshBank.error && (
          <CardContent>
            <p className="text-body-sm text-red-600">
              Ошибка обновления: {refreshBank.error.message}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Content */}
      {courses.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-5 w-48" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : courses.error ? (
        <Card className="p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load courses</p>
          <p className="text-body-sm text-mp-gray-500 mt-1">{courses.error.message}</p>
        </Card>
      ) : (
        <CourseManager courses={courses.data ?? []} />
      )}
    </div>
  );
}
