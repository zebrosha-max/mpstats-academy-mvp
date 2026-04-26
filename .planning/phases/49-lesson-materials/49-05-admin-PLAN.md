---
phase: 49-lesson-materials
plan: 05
type: execute
wave: 3
depends_on: ['49-02']
files_modified:
  - apps/web/src/app/(admin)/admin/content/materials/page.tsx
  - apps/web/src/app/(admin)/admin/content/materials/[id]/page.tsx
  - apps/web/src/components/admin/MaterialsTable.tsx
  - apps/web/src/components/admin/MaterialForm.tsx
  - apps/web/src/components/admin/LessonMultiAttach.tsx
  - apps/web/src/components/admin/MaterialFileUpload.tsx
  - apps/web/src/components/admin/AdminSidebar.tsx
autonomous: true
requirements:
  - Phase 49 (D-32..D-36, D-12)

must_haves:
  truths:
    - "Админ заходит в /admin/content/materials, видит таблицу всех материалов с фильтрами"
    - "Админ нажимает «+ Добавить материал», открывает форму создания"
    - "Админ выбирает source: External URL ИЛИ Upload файла; XOR-валидация на фронте"
    - "Drag-n-drop upload файла идёт через signed PUT URL прямо в Supabase Storage"
    - "Админ через Combobox добавляет материал к нескольким урокам сразу (с поиском по имени курса+урока)"
    - "Soft-delete через confirmation modal: isHidden=true + удаление файла из Storage"
    - "В sidebar админки появилась ссылка «Materials» рядом с Content (видна для ADMIN+SUPERADMIN)"
  artifacts:
    - path: "apps/web/src/app/(admin)/admin/content/materials/page.tsx"
      provides: "Список + фильтры + кнопка создания"
    - path: "apps/web/src/app/(admin)/admin/content/materials/[id]/page.tsx"
      provides: "Edit page (или create через id='new')"
    - path: "apps/web/src/components/admin/MaterialForm.tsx"
      provides: "Форма с XOR-source toggle + multi-attach"
      min_lines: 200
    - path: "apps/web/src/components/admin/LessonMultiAttach.tsx"
      provides: "Combobox с поиском уроков + список прикреплений"
    - path: "apps/web/src/components/admin/MaterialFileUpload.tsx"
      provides: "Drag-n-drop file upload через signed PUT URL"
    - path: "apps/web/src/components/admin/AdminSidebar.tsx"
      provides: "Sidebar с новым navItem 'Materials'"
  key_links:
    - from: "MaterialFileUpload"
      to: "trpc.material.requestUploadUrl"
      via: "fetch PUT signed URL → upload"
      pattern: "requestUploadUrl"
    - from: "LessonMultiAttach"
      to: "trpc.material.attach / detach"
      via: "mutation per add/remove"
      pattern: "material.attach"
    - from: "AdminSidebar.navItems"
      to: "/admin/content/materials"
      via: "массив navItems"
      pattern: "/admin/content/materials"
---

<objective>
Создать админку `/admin/content/materials`: список с фильтрами и пагинацией, форма создания/редактирования с гибридом External URL / Upload, Combobox для multi-attach к урокам, drag-n-drop загрузки файлов через signed PUT URL прямо в Supabase Storage (минуя Next.js body limit). Добавить ссылку «Materials» в `AdminSidebar.navItems` (известно из discovery — массив navItems в `apps/web/src/components/admin/AdminSidebar.tsx` строки 22-65).

Purpose: дать методологам автономность — после ingest (49-03) они правят/добавляют материалы без участия разработки.
Output: 6 новых файлов + 1 модифицированный (sidebar), ~700 LoC всего.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/49-lesson-materials/49-CONTEXT.md
@.planning/phases/49-lesson-materials/49-02-SUMMARY.md
@MAAL/CLAUDE.md
@apps/web/src/app/(admin)/admin/content/page.tsx
@apps/web/src/app/(admin)/admin/promo/page.tsx
@apps/web/src/app/(admin)/admin/comments/page.tsx
@apps/web/src/components/admin/AdminSidebar.tsx
@apps/web/src/components/admin/CourseManager.tsx
@apps/web/src/components/ui/dialog.tsx
@apps/web/src/components/ui/input.tsx
@packages/shared/src/types.ts

<interfaces>
<!-- Backend procedures from 49-02 -->

trpc.material.list({ type?, courseId?, search?, includeHidden?, limit?, cursor? })
  → { items: Material[], totalCount, nextCursor }

trpc.material.getById({ id }) → Material & { lessons: LessonMaterial[] }

trpc.material.create({ type, title, description?, ctaText, externalUrl? | storagePath?, fileSize?, fileMimeType?, isStandalone? })

trpc.material.update({ id, title?, description?, ctaText?, externalUrl?, storagePath?, isStandalone?, isHidden? })

trpc.material.delete({ id }) → soft-delete + Storage cleanup

trpc.material.attach({ materialId, lessonId, order })
trpc.material.detach({ materialId, lessonId })

trpc.material.requestUploadUrl({ type, filename, mimeType, fileSize })
  → { storagePath, uploadUrl, token }

trpc.learning.getCourses() → list of courses with lessons (for Combobox suggestions)

<!-- Existing AdminSidebar structure (already discovered, no scavenger hunt needed) -->
File: apps/web/src/components/admin/AdminSidebar.tsx
Лежит как `const navItems = [...]` (строки 22-65) — массив объектов:
```typescript
const navItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard, superadminOnly: false },
  { title: 'Users', href: '/admin/users', icon: Users, superadminOnly: false },
  { title: 'Content', href: '/admin/content', icon: BookOpen, superadminOnly: false },
  { title: 'Comments', href: '/admin/comments', icon: MessageSquare, superadminOnly: false },
  { title: 'Analytics', href: '/admin/analytics', icon: BarChart3, superadminOnly: false },
  { title: 'Promo', href: '/admin/promo', icon: Ticket, superadminOnly: false },
  { title: 'Settings', href: '/admin/settings', icon: Settings, superadminOnly: true },
];
```
Иконки импортируются из `lucide-react` (строки 8-19). Видно что `FileText` НЕ импортирован — его надо добавить.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build materials list page + table component</name>
  <files>apps/web/src/app/(admin)/admin/content/materials/page.tsx, apps/web/src/components/admin/MaterialsTable.tsx</files>
  <read_first>
    - apps/web/src/app/(admin)/admin/content/page.tsx целиком (паттерн страницы + таблицы)
    - apps/web/src/app/(admin)/admin/promo/page.tsx (паттерн фильтров + кнопки create)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-32 — список колонок + фильтры)
    - packages/shared/src/types.ts (MATERIAL_TYPE_LABELS)
  </read_first>
  <action>
**Файл 1 — `apps/web/src/app/(admin)/admin/content/materials/page.tsx` (~120 LoC):**

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialsTable } from '@/components/admin/MaterialsTable';
import { MATERIAL_TYPE_LABELS } from '@mpstats/shared';

export default function MaterialsListPage() {
  const [type, setType] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState<string | undefined>();
  const [includeHidden, setIncludeHidden] = useState(false);

  const { data, isLoading, refetch } = trpc.material.list.useQuery({
    type: type as any,
    search: search || undefined,
    courseId,
    includeHidden,
    limit: 20,
  });

  const courses = trpc.learning.getCourses.useQuery();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-heading-lg font-bold text-mp-gray-900">Материалы к урокам</h2>
          <p className="text-body-sm text-mp-gray-500 mt-1">
            Презентации, таблицы расчётов, чек-листы, памятки и ссылки на сервисы
          </p>
        </div>
        <Link href="/admin/content/materials/new">
          <Button>+ Добавить материал</Button>
        </Link>
      </div>

      <Card className="shadow-mp-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-heading">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(MATERIAL_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setType(type === key ? undefined : key)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  type === key
                    ? 'bg-mp-blue-600 text-white border-mp-blue-600'
                    : 'bg-white text-mp-gray-700 border-mp-gray-200 hover:bg-mp-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Поиск по названию…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={courseId ?? ''}
              onChange={(e) => setCourseId(e.target.value || undefined)}
              className="border border-mp-gray-200 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Все курсы</option>
              {courses.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeHidden}
                onChange={(e) => setIncludeHidden(e.target.checked)}
              />
              Показывать скрытые
            </label>
          </div>

          {data && (
            <div className="text-body-sm text-mp-gray-500">
              Всего: <Badge variant="default">{data.totalCount}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <MaterialsTable
        items={data?.items ?? []}
        isLoading={isLoading}
        onRefetch={() => refetch()}
      />
    </div>
  );
}
```

**Файл 2 — `apps/web/src/components/admin/MaterialsTable.tsx` (~140 LoC):**

```typescript
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Table, ExternalLink, ListChecks, StickyNote, Trash2, Eye, EyeOff } from 'lucide-react';
import { MATERIAL_TYPE_LABELS } from '@mpstats/shared';
import { toast } from 'sonner';

const TYPE_ICONS = {
  PRESENTATION: FileText,
  CALCULATION_TABLE: Table,
  EXTERNAL_SERVICE: ExternalLink,
  CHECKLIST: ListChecks,
  MEMO: StickyNote,
} as const;

type Item = {
  id: string;
  type: keyof typeof TYPE_ICONS;
  title: string;
  externalUrl: string | null;
  storagePath: string | null;
  isStandalone: boolean;
  isHidden: boolean;
  _count: { lessons: number };
  updatedAt: Date | string;
};

export function MaterialsTable({ items, isLoading, onRefetch }: { items: Item[]; isLoading: boolean; onRefetch: () => void }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const deleteMut = trpc.material.delete.useMutation({
    onSuccess: () => { toast.success('Материал удалён'); onRefetch(); setConfirmId(null); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.material.update.useMutation({
    onSuccess: () => { onRefetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!items.length) return <div className="text-mp-gray-500 text-center py-12">Материалов пока нет</div>;

  return (
    <div className="border border-mp-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-mp-gray-50 border-b border-mp-gray-200">
          <tr>
            <th className="text-left px-4 py-3"></th>
            <th className="text-left px-4 py-3">Название</th>
            <th className="text-left px-4 py-3">Тип</th>
            <th className="text-left px-4 py-3">Уроков</th>
            <th className="text-left px-4 py-3">Источник</th>
            <th className="text-left px-4 py-3">Статус</th>
            <th className="text-right px-4 py-3">Действия</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const Icon = TYPE_ICONS[m.type];
            return (
              <tr key={m.id} className="border-b border-mp-gray-100 hover:bg-mp-gray-50">
                <td className="px-4 py-3"><Icon className="w-5 h-5 text-mp-gray-500" /></td>
                <td className="px-4 py-3">
                  <Link href={`/admin/content/materials/${m.id}`} className="text-mp-blue-700 hover:underline">
                    {m.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{MATERIAL_TYPE_LABELS[m.type]}</td>
                <td className="px-4 py-3">{m._count.lessons}</td>
                <td className="px-4 py-3 text-mp-gray-600">
                  {m.externalUrl ? 'External URL' : m.storagePath ? 'Storage' : '—'}
                </td>
                <td className="px-4 py-3">
                  {m.isHidden ? <Badge variant="default">Скрыт</Badge> : <Badge variant="success">Активен</Badge>}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateMut.mutate({ id: m.id, isHidden: !m.isHidden })}
                    title={m.isHidden ? 'Показать' : 'Скрыть'}
                  >
                    {m.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmId(m.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {confirmId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-heading mb-2">Удалить материал?</h3>
            <p className="text-body-sm text-mp-gray-600 mb-4">Файл из Storage будет удалён, привязки к урокам сохранятся в архиве.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmId(null)}>Отмена</Button>
              <Button variant="destructive" onClick={() => deleteMut.mutate({ id: confirmId })} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? 'Удаление…' : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/app/(admin)/admin/content/materials/page.tsx` существует
    - `apps/web/src/components/admin/MaterialsTable.tsx` существует, ≥130 LoC
    - `grep -c "trpc.material.list" apps/web/src/app/(admin)/admin/content/materials/page.tsx` >= 1
    - `grep -c "trpc.material.delete" apps/web/src/components/admin/MaterialsTable.tsx` >= 1
    - `grep -c "MATERIAL_TYPE_LABELS" apps/web/src/app/(admin)/admin/content/materials/page.tsx` >= 1
    - `pnpm --filter @mpstats/web typecheck` exit 0
  </acceptance_criteria>
  <done>Список материалов работает, фильтры функциональны, soft-delete через confirmation.</done>
</task>

<task type="auto">
  <name>Task 2: Build edit/create page with form, file upload, multi-attach</name>
  <files>apps/web/src/app/(admin)/admin/content/materials/[id]/page.tsx, apps/web/src/components/admin/MaterialForm.tsx, apps/web/src/components/admin/MaterialFileUpload.tsx, apps/web/src/components/admin/LessonMultiAttach.tsx</files>
  <read_first>
    - apps/web/src/app/(admin)/admin/content/materials/page.tsx (только что созданный — ссылка "+ Добавить материал" → /materials/new)
    - apps/web/src/app/(admin)/admin/promo/page.tsx (паттерн create form в admin)
    - apps/web/src/components/ui/* (доступные shadcn primitives: input, button, dialog, label)
    - packages/shared/src/types.ts (MATERIAL_TYPE_LABELS, MATERIAL_ALLOWED_MIME_TYPES, MATERIAL_MAX_FILE_SIZE, MATERIAL_STORAGE_BUCKET)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-33, D-34, D-12)
  </read_first>
  <action>
**Файл 1 — `apps/web/src/app/(admin)/admin/content/materials/[id]/page.tsx` (~50 LoC):**

```typescript
'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { MaterialForm } from '@/components/admin/MaterialForm';
import { ArrowLeft } from 'lucide-react';

export default function MaterialEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === 'new';

  const { data, isLoading } = trpc.material.getById.useQuery(
    { id: params.id! },
    { enabled: !isNew, retry: false }
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/admin/content/materials" className="text-mp-gray-500 hover:text-mp-gray-700 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="w-4 h-4" /> Все материалы
      </Link>
      <h1 className="text-heading-lg font-bold">{isNew ? 'Новый материал' : data?.title || 'Редактирование'}</h1>
      {(isNew || data) && (
        <MaterialForm
          mode={isNew ? 'create' : 'edit'}
          initial={isNew ? null : data!}
          onSaved={(id) => router.push(`/admin/content/materials/${id}`)}
        />
      )}
      {!isNew && isLoading && <p>Загрузка…</p>}
    </div>
  );
}
```

**Файл 2 — `apps/web/src/components/admin/MaterialForm.tsx` (~210 LoC):**

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialFileUpload } from './MaterialFileUpload';
import { LessonMultiAttach } from './LessonMultiAttach';
import { MATERIAL_TYPE_LABELS } from '@mpstats/shared';
import { toast } from 'sonner';

const TYPES = ['PRESENTATION', 'CALCULATION_TABLE', 'EXTERNAL_SERVICE', 'CHECKLIST', 'MEMO'] as const;

type Initial = {
  id: string;
  type: typeof TYPES[number];
  title: string;
  description: string | null;
  ctaText: string;
  externalUrl: string | null;
  storagePath: string | null;
  isStandalone: boolean;
  lessons?: Array<{ lessonId: string; order: number; lesson: { id: string; title: string; courseId: string; course: { title: string } } }>;
};

export function MaterialForm({ mode, initial, onSaved }: { mode: 'create' | 'edit'; initial: Initial | null; onSaved: (id: string) => void }) {
  const [type, setType] = useState<typeof TYPES[number]>(initial?.type ?? 'PRESENTATION');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [ctaText, setCtaText] = useState(initial?.ctaText ?? 'Скачать');
  const [sourceMode, setSourceMode] = useState<'url' | 'upload'>(initial?.externalUrl ? 'url' : initial?.storagePath ? 'upload' : 'url');
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? '');
  const [storagePath, setStoragePath] = useState(initial?.storagePath ?? '');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(initial?.isStandalone ?? false);

  const createMut = trpc.material.create.useMutation({
    onSuccess: (m) => { toast.success('Материал создан'); onSaved(m.id); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.material.update.useMutation({
    onSuccess: () => toast.success('Сохранено'),
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    // XOR validation on frontend (D-03)
    if (sourceMode === 'url' && !externalUrl) return toast.error('Укажите ссылку');
    if (sourceMode === 'upload' && !storagePath) return toast.error('Загрузите файл');

    if (mode === 'create') {
      createMut.mutate({
        type, title, description: description || undefined, ctaText,
        externalUrl: sourceMode === 'url' ? externalUrl : undefined,
        storagePath: sourceMode === 'upload' ? storagePath : undefined,
        fileSize: sourceMode === 'upload' && fileSize ? fileSize : undefined,
        fileMimeType: sourceMode === 'upload' && fileMimeType ? (fileMimeType as any) : undefined,
        isStandalone,
      });
    } else {
      updateMut.mutate({
        id: initial!.id,
        title, description: description || null, ctaText,
        externalUrl: sourceMode === 'url' ? externalUrl : null,
        storagePath: sourceMode === 'upload' ? storagePath : null,
        isStandalone,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Основное</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Тип материала</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TYPES.map(t => (
                <button key={t} onClick={() => setType(t)} disabled={mode === 'edit'} type="button"
                  className={`px-3 py-2 rounded-md border text-sm ${type === t ? 'bg-mp-blue-600 text-white border-mp-blue-600' : 'bg-white border-mp-gray-200'} ${mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {MATERIAL_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {mode === 'edit' && <p className="text-xs text-mp-gray-500 mt-1">Тип нельзя изменить после создания</p>}
          </div>
          <div>
            <Label htmlFor="title">Название</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label htmlFor="desc">Описание (опционально)</Label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)}
              maxLength={2000} rows={3} className="w-full border border-mp-gray-200 rounded-md p-2 text-sm" />
          </div>
          <div>
            <Label htmlFor="cta">Текст кнопки</Label>
            <Input id="cta" value={ctaText} onChange={(e) => setCtaText(e.target.value)} maxLength={60} />
          </div>
          {/* W#5: isStandalone отображается в админке (методолог заполняет заранее), но в /learn UI этой фазы поле не считывается — задел под Phase 47 Library per D-04 */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isStandalone} onChange={(e) => setIsStandalone(e.target.checked)} />
            Может быть полезен без просмотра урока
            <span className="text-xs text-mp-gray-400">(для будущей Library — Phase 47)</span>
          </label>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Источник</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <button onClick={() => setSourceMode('url')} type="button"
              className={`px-4 py-2 rounded-md border ${sourceMode === 'url' ? 'bg-mp-blue-600 text-white border-mp-blue-600' : 'bg-white border-mp-gray-200'}`}>
              Внешняя ссылка
            </button>
            <button onClick={() => setSourceMode('upload')} type="button"
              className={`px-4 py-2 rounded-md border ${sourceMode === 'upload' ? 'bg-mp-blue-600 text-white border-mp-blue-600' : 'bg-white border-mp-gray-200'}`}>
              Загрузить файл
            </button>
          </div>

          {sourceMode === 'url' && (
            <div>
              <Label htmlFor="url">URL (Google Drive / Sheets / external)</Label>
              <Input id="url" type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..." />
            </div>
          )}
          {sourceMode === 'upload' && (
            <MaterialFileUpload
              type={type}
              currentPath={storagePath}
              onUploaded={(p, size, mime) => { setStoragePath(p); setFileSize(size); setFileMimeType(mime); }}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending || !title}>
          {createMut.isPending || updateMut.isPending ? 'Сохранение…' : (mode === 'create' ? 'Создать' : 'Сохранить')}
        </Button>
      </div>

      {mode === 'edit' && initial && (
        <Card>
          <CardHeader><CardTitle>Прикреплено к урокам</CardTitle></CardHeader>
          <CardContent>
            <LessonMultiAttach
              materialId={initial.id}
              currentLinks={initial.lessons || []}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Файл 3 — `apps/web/src/components/admin/MaterialFileUpload.tsx` (~120 LoC):**

```typescript
'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Upload, FileCheck, AlertCircle, Loader2 } from 'lucide-react';
import { MATERIAL_ALLOWED_MIME_TYPES, MATERIAL_MAX_FILE_SIZE } from '@mpstats/shared';
import { toast } from 'sonner';

const ACCEPT = MATERIAL_ALLOWED_MIME_TYPES.join(',');

export function MaterialFileUpload({ type, currentPath, onUploaded }:
  { type: string; currentPath: string | null; onUploaded: (path: string, size: number, mime: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const requestUploadUrlMut = trpc.material.requestUploadUrl.useMutation();

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MATERIAL_MAX_FILE_SIZE) {
      setError(`Файл больше 25 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
    if (!MATERIAL_ALLOWED_MIME_TYPES.includes(file.type as any)) {
      setError(`Тип файла "${file.type}" не поддерживается. Разрешены: PDF, XLSX, DOCX, CSV`);
      return;
    }

    setUploading(true); setProgress(0);
    try {
      const { storagePath, uploadUrl } = await requestUploadUrlMut.mutateAsync({
        type: type as any,
        filename: file.name,
        mimeType: file.type as any,
        fileSize: file.size,
      });

      // Direct PUT to Supabase Storage (bypasses Next.js body limit, D-11)
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      onUploaded(storagePath, file.size, file.type);
      toast.success('Файл загружен');
    } catch (e: any) {
      setError(e.message);
      toast.error('Ошибка загрузки: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-mp-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-mp-blue-500 transition-colors"
      >
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-mp-blue-600" />
            <p className="text-mp-gray-600">Загрузка… {progress}%</p>
            <div className="w-full bg-mp-gray-200 rounded-full h-2 mt-2">
              <div className="bg-mp-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : currentPath ? (
          <>
            <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="text-mp-gray-700 text-sm">Файл загружен: {currentPath.split('/').pop()}</p>
            <p className="text-xs text-mp-gray-500 mt-1">Перетащите новый, чтобы заменить</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-mp-gray-400" />
            <p className="text-mp-gray-700">Перетащите файл сюда или кликните для выбора</p>
            <p className="text-xs text-mp-gray-500 mt-1">PDF, XLSX, DOCX, CSV — до 25 MB</p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  );
}
```

**Файл 4 — `apps/web/src/components/admin/LessonMultiAttach.tsx` (~140 LoC):**

```typescript
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
  lesson: { id: string; title: string; courseId: string; course: { title: string } };
};

export function LessonMultiAttach({ materialId, currentLinks }: { materialId: string; currentLinks: LinkRow[] }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const utils = trpc.useUtils();
  const courses = trpc.learning.getCourses.useQuery();

  // Все уроки всех курсов; фильтруем клиентски (data ~422 lessons total — ОК для in-memory)
  const allLessons = courses.data?.flatMap(c =>
    (c.lessons || []).map((l: any) => ({ id: l.id, title: l.title, courseTitle: c.title, courseId: c.id }))
  ) ?? [];

  const attachedIds = new Set(currentLinks.map(l => l.lessonId));
  const filtered = allLessons
    .filter(l => !attachedIds.has(l.id))
    .filter(l => !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.courseTitle.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 20);

  const attachMut = trpc.material.attach.useMutation({
    onSuccess: () => { toast.success('Урок добавлен'); utils.material.getById.invalidate({ id: materialId }); setSearch(''); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const detachMut = trpc.material.detach.useMutation({
    onSuccess: () => { toast.success('Урок откреплён'); utils.material.getById.invalidate({ id: materialId }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {currentLinks.length === 0 && (
        <p className="text-mp-gray-500 text-sm">Не прикреплён ни к одному уроку. Юзеры не увидят этот материал.</p>
      )}
      <ul className="space-y-2">
        {currentLinks.map((l) => (
          <li key={l.lessonId} className="flex items-center justify-between p-2 border border-mp-gray-200 rounded">
            <div>
              <div className="text-body-sm">{l.lesson.title}</div>
              <Badge variant="default">{l.lesson.course.title}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => detachMut.mutate({ materialId, lessonId: l.lessonId })}>
              <X className="w-4 h-4" />
            </Button>
          </li>
        ))}
      </ul>
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Прикрепить к уроку
        </Button>
      ) : (
        <div className="border border-mp-gray-200 rounded-lg p-3 space-y-2">
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
                onClick={() => attachMut.mutate({ materialId, lessonId: l.id, order: currentLinks.length })}
                className="w-full text-left p-2 hover:bg-mp-gray-50 rounded flex justify-between items-center"
              >
                <span className="text-body-sm">{l.title}</span>
                <Badge variant="default">{l.courseTitle}</Badge>
              </button>
            ))}
            {filtered.length === 0 && search && (
              <p className="text-mp-gray-500 text-sm p-2">Ничего не найдено</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => { setOpen(false); setSearch(''); }}>Отмена</Button>
        </div>
      )}
    </div>
  );
}
```
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/web typecheck && pnpm --filter @mpstats/web build</automated>
  </verify>
  <acceptance_criteria>
    - Все 4 файла созданы
    - `apps/web/src/app/(admin)/admin/content/materials/[id]/page.tsx` существует
    - `MaterialForm.tsx` ≥200 LoC, содержит `sourceMode` toggle и оба моды (URL + upload)
    - `MaterialFileUpload.tsx` содержит `XMLHttpRequest` или `fetch` PUT к `uploadUrl`
    - `LessonMultiAttach.tsx` использует `trpc.material.attach` и `trpc.material.detach`
    - `grep -c "MATERIAL_MAX_FILE_SIZE" apps/web/src/components/admin/MaterialFileUpload.tsx` >= 1
    - `grep -c "Drag\\|Drop\\|onDrop" apps/web/src/components/admin/MaterialFileUpload.tsx` >= 1
    - `grep -c "Phase 47" apps/web/src/components/admin/MaterialForm.tsx` >= 1 (W#5 — комментарий про задел Library)
    - `pnpm --filter @mpstats/web typecheck` exit 0
    - `pnpm --filter @mpstats/web build` succeeds
    - Manual smoke: открыть `/admin/content/materials` → видна таблица из ingest материалов; кликнуть «+ Добавить» → форма открывается; ввести External URL + название → создан; открыть edit → видна Combobox для прикрепления; прикрепить к уроку → урок появляется в списке
  </acceptance_criteria>
  <done>Полный CRUD-flow в админке работает, drag-n-drop файла загружает в Storage через signed PUT URL, multi-attach к нескольким урокам функционирует, isStandalone задокументирован как задел.</done>
</task>

<task type="auto">
  <name>Task 3: Add "Materials" navItem to AdminSidebar (exact insertion, no scavenger hunt)</name>
  <files>apps/web/src/components/admin/AdminSidebar.tsx</files>
  <read_first>
    - apps/web/src/components/admin/AdminSidebar.tsx (целиком — структура уже известна из interfaces секции этого PLAN-а: массив `navItems` строки 22-65, иконки из lucide-react строки 8-19)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-32 — навигация)
  </read_first>
  <action>
**Цель:** добавить новый item «Materials» в массив `navItems` ПОСЛЕ Content (строка ~40), ПЕРЕД Comments (строка ~41).

**Шаг 1 — добавить импорт иконки `FileText` в lucide-react импорт-блоке:**

Найти существующий импорт-блок (строки 8-19, иконки на отдельных строках):
```typescript
import {
  LayoutDashboard,
  Users,
  BookOpen,
  MessageSquare,
  BarChart3,
  Ticket,
  Settings,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react';
```

Добавить `FileText,` (например, после `BookOpen,`):
```typescript
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  MessageSquare,
  BarChart3,
  Ticket,
  Settings,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react';
```

**Шаг 2 — вставить новый объект в массив `navItems` ПОСЛЕ Content (строка ~40), ПЕРЕД Comments:**

Найти existing блок:
```typescript
  {
    title: 'Content',
    href: '/admin/content',
    icon: BookOpen,
    superadminOnly: false,
  },
  {
    title: 'Comments',
```

И вставить НОВЫЙ объект между `Content` и `Comments`:
```typescript
  {
    title: 'Content',
    href: '/admin/content',
    icon: BookOpen,
    superadminOnly: false,
  },
  {
    title: 'Materials',
    href: '/admin/content/materials',
    icon: FileText,
    superadminOnly: false,
  },
  {
    title: 'Comments',
```

**Шаг 3 — НЕ ТРОГАТЬ:**
- Логику `NavLinks` (badgeCount, isActive — automatic)
- Mobile drawer (использует те же `navItems` через NavLinks)
- Структуру компонента AdminSidebar
- Логику `superadminOnly` фильтра — Materials доступны для ADMIN+SUPERADMIN, поэтому `false`

ВАЖНО: `isActive` логика в `NavLinks` сравнивает `pathname === item.href || pathname.startsWith(item.href + '/')`. Для `/admin/content/materials` это означает, что когда юзер на этой странице, активен будет именно Materials item, а НЕ Content (Content item остаётся активен только для `/admin/content` и подпутей кроме materials/* — нюанс: `/admin/content/materials` начинается с `/admin/content/`, поэтому Content тоже активен. Это допустимый UX, оба пункта подсвечены, как breadcrumb).
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && grep -c "/admin/content/materials" apps/web/src/components/admin/AdminSidebar.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "/admin/content/materials" apps/web/src/components/admin/AdminSidebar.tsx` == 1 (точно одна строка с href)
    - `grep -c "title: 'Materials'" apps/web/src/components/admin/AdminSidebar.tsx` == 1
    - `grep -c "FileText," apps/web/src/components/admin/AdminSidebar.tsx` >= 1 (импорт добавлен)
    - `grep -c "icon: FileText" apps/web/src/components/admin/AdminSidebar.tsx` == 1
    - Не сломаны существующие 7 navItems (`grep -c "title: '" apps/web/src/components/admin/AdminSidebar.tsx` == 8)
    - `pnpm --filter @mpstats/web typecheck` exit 0
    - `pnpm --filter @mpstats/web build` succeeds
    - Manual: открыть `/admin` — в sidebar появилась ссылка «Materials» между Content и Comments, при клике переход на `/admin/content/materials` (200 OK для admin)
  </acceptance_criteria>
  <done>Ссылка «Materials» добавлена в navItems массив AdminSidebar.tsx между Content и Comments, импорт FileText добавлен.</done>
</task>

</tasks>

<verification>
- typecheck + build проходят без ошибок
- Open `/admin/content/materials` → таблица с 60+ материалов из ingest
- В sidebar админки виден новый пункт «Materials» между Content и Comments
- Click `+ Добавить материал` → форма открывается, тип-чипы выбираются
- Submit с External URL → создан, redirect на edit page
- Submit с upload файла (drag PDF) → progress bar, загрузка в Storage, materialId создан
- В edit page добавить Combobox-урок → запись в LessonMaterial появляется
- Open soft-deleted материал — он скрыт из списка по умолчанию, виден при `Показывать скрытые`
</verification>

<success_criteria>
1. Список материалов с фильтрами (тип, курс, поиск, hidden)
2. Create форма работает в обоих режимах (URL + upload)
3. Multi-attach: 1 материал к нескольким урокам через UI
4. Soft-delete с confirmation
5. Drag-n-drop upload идёт прямо в Supabase Storage (без через Next.js)
6. AdminSidebar содержит ссылку «Materials» (не пришлось искать grep'ом — adress известен из планирования)
</success_criteria>

<output>
After completion, create `.planning/phases/49-lesson-materials/49-05-SUMMARY.md` documenting:
- Структура страниц админки
- Формат загрузки файла (signed PUT, не через Next.js)
- Список и фильтры
- Точное место вставки navItem в AdminSidebar (массив navItems, между Content и Comments)
</output>
</content>
</invoke>
