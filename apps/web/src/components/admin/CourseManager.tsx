'use client';

import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Video, VideoOff, Database } from 'lucide-react';

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
  const moveLesson = trpc.admin.moveLessonToPosition.useMutation({
    onSuccess: () => {
      utils.admin.getCourseLessons.invalidate({ courseId: course.id });
    },
  });

  // Track which lesson is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handlePositionClick = useCallback((lessonId: string, currentOrder: number) => {
    setEditingId(lessonId);
    setEditValue(String(currentOrder));
  }, []);

  const handlePositionSubmit = useCallback(
    (lessonId: string) => {
      const target = parseInt(editValue, 10);
      if (!isNaN(target) && target >= 1) {
        moveLesson.mutate({ lessonId, targetPosition: target });
      }
      setEditingId(null);
    },
    [editValue, moveLesson],
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
              {courseLessons.data.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-mp-gray-50 transition-colors"
                >
                  {/* Order number — click to edit */}
                  {editingId === lesson.id ? (
                    <input
                      type="number"
                      min={1}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handlePositionSubmit(lesson.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => handlePositionSubmit(lesson.id)}
                      autoFocus
                      className="w-10 h-6 text-xs font-mono text-center border border-mp-blue-400 rounded bg-white focus:outline-none focus:ring-1 focus:ring-mp-blue-500"
                    />
                  ) : (
                    <button
                      onClick={() => handlePositionClick(lesson.id, lesson.order)}
                      disabled={moveLesson.isPending}
                      className="w-8 text-xs font-mono text-mp-gray-400 text-right hover:text-mp-blue-600 hover:bg-mp-blue-50 rounded px-1 py-0.5 transition-colors cursor-pointer"
                      title="Click to change position"
                    >
                      {lesson.order}
                    </button>
                  )}

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
