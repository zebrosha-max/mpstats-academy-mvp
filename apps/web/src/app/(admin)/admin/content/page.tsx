'use client';

import { trpc } from '@/lib/trpc/client';
import { CourseManager } from '@/components/admin/CourseManager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ContentPage() {
  const courses = trpc.admin.getCourses.useQuery();

  const totalLessons = courses.data?.reduce((s, c) => s + c._count.lessons, 0) ?? 0;
  const totalChunks = courses.data?.reduce((s, c) => s + c.chunkCount, 0) ?? 0;

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
