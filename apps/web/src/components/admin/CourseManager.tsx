'use client';

import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Video, VideoOff, Database } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  order: number;
  skillCategory: string;
  videoId: string | null;
  duration: number | null;
}

interface CourseWithDetails {
  id: string;
  title: string;
  order: number;
  _count: { lessons: number };
  chunkCount: number;
  lessons?: Lesson[];
}

interface CourseManagerProps {
  courses: CourseWithDetails[];
}

const skillCategoryVariant: Record<string, 'analytics' | 'marketing' | 'content' | 'operations' | 'finance'> = {
  ANALYTICS: 'analytics',
  MARKETING: 'marketing',
  CONTENT: 'content',
  OPERATIONS: 'operations',
  FINANCE: 'finance',
};

export function CourseManager({ courses }: CourseManagerProps) {
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {courses.map((course) => (
        <CourseAccordion
          key={course.id}
          course={course}
          isExpanded={expandedCourse === course.id}
          onToggle={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
        />
      ))}
    </div>
  );
}

function CourseAccordion({
  course,
  isExpanded,
  onToggle,
}: {
  course: CourseWithDetails;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const utils = trpc.useUtils();
  const courseLessons = trpc.admin.getCourseLessons.useQuery(
    { courseId: course.id },
    { enabled: isExpanded },
  );
  const updateOrder = trpc.admin.updateLessonOrder.useMutation({
    onSuccess: () => {
      utils.admin.getCourseLessons.invalidate({ courseId: course.id });
    },
  });

  const handleReorder = useCallback(
    (lessonId: string, currentOrder: number, direction: 'up' | 'down') => {
      const lessons = courseLessons.data;
      if (!lessons) return;

      const currentIndex = lessons.findIndex((l) => l.id === lessonId);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= lessons.length) return;

      const targetLesson = lessons[targetIndex];

      // Swap orders
      updateOrder.mutate({ lessonId, newOrder: targetLesson.order });
      updateOrder.mutate({ lessonId: targetLesson.id, newOrder: currentOrder });
    },
    [courseLessons.data, updateOrder],
  );

  return (
    <div className="border border-mp-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Course header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-mp-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-body-sm font-medium text-mp-gray-400 w-6">
            #{course.order}
          </span>
          <span className="text-body-md font-semibold text-mp-gray-900">
            {course.title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="primary" size="sm">
            {course._count.lessons} lessons
          </Badge>
          <div className="flex items-center gap-1 text-xs text-mp-gray-500">
            <Database className="w-3 h-3" />
            {course.chunkCount} chunks
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-mp-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-mp-gray-400" />
          )}
        </div>
      </button>

      {/* Lessons list */}
      {isExpanded && (
        <div className="border-t border-mp-gray-200">
          {courseLessons.isLoading ? (
            <div className="p-4 text-center text-body-sm text-mp-gray-400">
              Loading lessons...
            </div>
          ) : courseLessons.data && courseLessons.data.length > 0 ? (
            <div className="divide-y divide-mp-gray-100">
              {courseLessons.data.map((lesson, index) => (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-mp-gray-50 transition-colors"
                >
                  {/* Order number */}
                  <span className="text-xs font-mono text-mp-gray-400 w-6 text-right">
                    {lesson.order}
                  </span>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-mp-gray-900 truncate">{lesson.title}</p>
                  </div>

                  {/* Skill category badge */}
                  <Badge
                    variant={skillCategoryVariant[lesson.skillCategory] || 'default'}
                    size="sm"
                  >
                    {lesson.skillCategory}
                  </Badge>

                  {/* Video status */}
                  {lesson.videoId ? (
                    <Video className="w-4 h-4 text-mp-green-500 shrink-0" />
                  ) : (
                    <VideoOff className="w-4 h-4 text-mp-gray-300 shrink-0" />
                  )}

                  {/* Reorder buttons */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleReorder(lesson.id, lesson.order, 'up')}
                      disabled={index === 0 || updateOrder.isPending}
                      className={cn(
                        'p-1 rounded hover:bg-mp-gray-200 transition-colors',
                        'disabled:opacity-30 disabled:cursor-not-allowed',
                      )}
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-mp-gray-500" />
                    </button>
                    <button
                      onClick={() => handleReorder(lesson.id, lesson.order, 'down')}
                      disabled={
                        index === (courseLessons.data?.length ?? 0) - 1 || updateOrder.isPending
                      }
                      className={cn(
                        'p-1 rounded hover:bg-mp-gray-200 transition-colors',
                        'disabled:opacity-30 disabled:cursor-not-allowed',
                      )}
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-mp-gray-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-body-sm text-mp-gray-400">
              No lessons in this course
            </div>
          )}
        </div>
      )}
    </div>
  );
}
