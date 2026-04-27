'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

type LinkRow = {
  lessonId: string;
  order: number;
  lesson: {
    id: string;
    title: string;
    courseId: string;
    course: { title: string };
  };
};

export function LessonMultiAttach({
  materialId,
  currentLinks,
}: {
  materialId: string;
  currentLinks: LinkRow[];
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const utils = trpc.useUtils();
  const courses = trpc.learning.getCourses.useQuery();

  // Все уроки всех курсов; фильтруем клиентски (data ~422 lessons total — ОК для in-memory)
  const allLessons =
    courses.data?.flatMap((c) =>
      (c.lessons || []).map((l) => ({
        id: l.id,
        title: l.title,
        courseTitle: c.title,
        courseId: c.id,
      })),
    ) ?? [];

  const attachedIds = new Set(currentLinks.map((l) => l.lessonId));
  const filtered = allLessons
    .filter((l) => !attachedIds.has(l.id))
    .filter(
      (l) =>
        !search ||
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.courseTitle.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 20);

  const attachMut = trpc.material.attach.useMutation({
    onSuccess: () => {
      toast.success('Урок добавлен');
      utils.material.getById.invalidate({ id: materialId });
      setSearch('');
    },
    onError: (e) => toast.error(e.message),
  });
  const detachMut = trpc.material.detach.useMutation({
    onSuccess: () => {
      toast.success('Урок откреплён');
      utils.material.getById.invalidate({ id: materialId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {currentLinks.length === 0 && (
        <p className="text-mp-gray-500 text-sm">
          Не прикреплён ни к одному уроку. Юзеры не увидят этот материал.
        </p>
      )}
      {currentLinks.length > 0 && (
        <ul className="space-y-2">
          {currentLinks.map((l) => (
            <li
              key={l.lessonId}
              className="flex items-center justify-between p-3 border border-mp-gray-200 rounded-lg bg-white"
            >
              <div className="min-w-0 flex-1">
                <div className="text-body-sm text-mp-gray-900 font-medium truncate">
                  {l.lesson.title}
                </div>
                <Badge variant="default" size="sm" className="mt-1">
                  {l.lesson.course.title}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  detachMut.mutate({ materialId, lessonId: l.lessonId })
                }
                disabled={detachMut.isPending}
                title="Открепить"
              >
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Прикрепить к уроку
        </Button>
      ) : (
        <div className="border border-mp-gray-200 rounded-lg p-3 space-y-2 bg-white">
          <Input
            autoFocus
            placeholder="Поиск по названию урока или курса…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  attachMut.mutate({
                    materialId,
                    lessonId: l.id,
                    order: currentLinks.length,
                  })
                }
                disabled={attachMut.isPending}
                className="w-full text-left p-2 hover:bg-mp-gray-50 rounded flex justify-between items-center gap-2 disabled:opacity-50"
              >
                <span className="text-body-sm truncate">{l.title}</span>
                <Badge variant="default" size="sm" className="flex-shrink-0">
                  {l.courseTitle}
                </Badge>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-mp-gray-500 text-sm p-2">
                {search ? 'Ничего не найдено' : 'Все уроки уже прикреплены'}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false);
              setSearch('');
            }}
          >
            Закрыть
          </Button>
        </div>
      )}
    </div>
  );
}
