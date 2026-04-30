'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialFileUpload } from './MaterialFileUpload';
import { LessonMultiAttach } from './LessonMultiAttach';
import {
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_VALUES,
  type MaterialTypeValue,
} from '@mpstats/shared';
import { toast } from 'sonner';

type Initial = {
  id: string;
  type: MaterialTypeValue;
  title: string;
  description: string | null;
  ctaText: string;
  externalUrl: string | null;
  storagePath: string | null;
  isStandalone: boolean;
  lessons?: Array<{
    lessonId: string;
    order: number;
    lesson: {
      id: string;
      title: string;
      courseId: string;
      course: { title: string };
    };
  }>;
};

export function MaterialForm({
  mode,
  initial,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial: Initial | null;
  onSaved: (id: string) => void;
}) {
  const [type, setType] = useState<MaterialTypeValue>(
    initial?.type ?? 'PRESENTATION',
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [ctaText, setCtaText] = useState(initial?.ctaText ?? 'Скачать');
  const [sourceMode, setSourceMode] = useState<'url' | 'upload'>(
    initial?.externalUrl
      ? 'url'
      : initial?.storagePath
        ? 'upload'
        : 'url',
  );
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? '');
  const [storagePath, setStoragePath] = useState(initial?.storagePath ?? '');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(
    initial?.isStandalone ?? false,
  );

  const createMut = trpc.material.create.useMutation({
    onSuccess: (m) => {
      toast.success('Материал создан');
      if (m) onSaved(m.id);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.material.update.useMutation({
    onSuccess: () => toast.success('Сохранено'),
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!title.trim()) {
      toast.error('Укажите название');
      return;
    }
    // XOR validation on frontend (D-03) — на бэке тот же refine,
    // но тут UX без round-trip
    if (sourceMode === 'url' && !externalUrl) {
      toast.error('Укажите ссылку');
      return;
    }
    if (sourceMode === 'upload' && !storagePath) {
      toast.error('Загрузите файл');
      return;
    }

    if (mode === 'create') {
      createMut.mutate({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        ctaText: ctaText.trim(),
        externalUrl: sourceMode === 'url' ? externalUrl.trim() : undefined,
        storagePath: sourceMode === 'upload' ? storagePath : undefined,
        fileSize:
          sourceMode === 'upload' && fileSize ? fileSize : undefined,
        fileMimeType:
          sourceMode === 'upload' && fileMimeType ? fileMimeType : undefined,
        isStandalone,
      });
    } else {
      // Edit mode: посылаем оба поля как nullable, чтобы поменять source при необходимости
      updateMut.mutate({
        id: initial!.id,
        title: title.trim(),
        description: description.trim() || null,
        ctaText: ctaText.trim(),
        externalUrl: sourceMode === 'url' ? externalUrl.trim() : null,
        storagePath: sourceMode === 'upload' ? storagePath : null,
        isStandalone,
      });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* Basic */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">Основное</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-body-sm font-medium text-mp-gray-700 mb-1.5">
              Тип материала
            </label>
            <div className="flex flex-wrap gap-2">
              {MATERIAL_TYPE_VALUES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  disabled={mode === 'edit'}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    type === t
                      ? 'bg-mp-blue-600 text-white border-mp-blue-600'
                      : 'bg-white border-mp-gray-200 text-mp-gray-700 hover:bg-mp-gray-50'
                  } ${mode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {MATERIAL_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {mode === 'edit' && (
              <p className="text-xs text-mp-gray-500 mt-1">
                Тип нельзя изменить после создания
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="title"
              className="block text-body-sm font-medium text-mp-gray-700 mb-1.5"
            >
              Название
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Например: Шаблон расчёта unit-экономики"
            />
          </div>

          <div>
            <label
              htmlFor="desc"
              className="block text-body-sm font-medium text-mp-gray-700 mb-1.5"
            >
              Описание (опционально)
            </label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full border border-mp-gray-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-mp-blue-500 focus:border-transparent"
              placeholder="Что внутри, зачем нужно?"
            />
          </div>

          <div>
            <label
              htmlFor="cta"
              className="block text-body-sm font-medium text-mp-gray-700 mb-1.5"
            >
              Текст кнопки
            </label>
            <Input
              id="cta"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              maxLength={60}
              placeholder="Скачать / Открыть таблицу / Перейти"
              className="max-w-xs"
            />
          </div>

          {/* W#5: isStandalone отображается в админке (методолог заполняет заранее), но в /learn UI этой фазы поле не считывается — задел под Phase 47 Library per D-04 */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isStandalone}
              onChange={(e) => setIsStandalone(e.target.checked)}
              className="rounded border-mp-gray-300"
            />
            Может быть полезен без просмотра урока
            <span className="text-xs text-mp-gray-400">
              (для будущей Library — Phase 47)
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Source — XOR toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-heading-md">Источник</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSourceMode('url')}
              className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                sourceMode === 'url'
                  ? 'bg-mp-blue-600 text-white border-mp-blue-600'
                  : 'bg-white border-mp-gray-200 text-mp-gray-700 hover:bg-mp-gray-50'
              }`}
            >
              Внешняя ссылка
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                sourceMode === 'upload'
                  ? 'bg-mp-blue-600 text-white border-mp-blue-600'
                  : 'bg-white border-mp-gray-200 text-mp-gray-700 hover:bg-mp-gray-50'
              }`}
            >
              Загрузить файл
            </button>
          </div>

          {sourceMode === 'url' && (
            <div>
              <label
                htmlFor="url"
                className="block text-body-sm font-medium text-mp-gray-700 mb-1.5"
              >
                URL (Google Drive / Sheets / external)
              </label>
              <Input
                id="url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </div>
          )}
          {sourceMode === 'upload' && (
            <MaterialFileUpload
              type={type}
              currentPath={storagePath || null}
              onUploaded={(p, size, mime) => {
                setStoragePath(p);
                setFileSize(size);
                setFileMimeType(mime);
              }}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={isPending || !title.trim()}>
          {isPending
            ? 'Сохранение…'
            : mode === 'create'
              ? 'Создать'
              : 'Сохранить'}
        </Button>
      </div>

      {mode === 'edit' && initial && (
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">
              Прикреплено к урокам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LessonMultiAttach
              materialId={initial.id}
              materialTitle={initial.title}
              currentLinks={initial.lessons || []}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
