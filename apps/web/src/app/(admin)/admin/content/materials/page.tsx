'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialsTable } from '@/components/admin/MaterialsTable';
import { MATERIAL_TYPE_LABELS, type MaterialTypeValue } from '@mpstats/shared';
import { Plus } from 'lucide-react';

export default function MaterialsListPage() {
  const [type, setType] = useState<MaterialTypeValue | undefined>();
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState<string | undefined>();
  const [includeHidden, setIncludeHidden] = useState(false);

  const { data, isLoading, refetch } = trpc.material.list.useQuery({
    type,
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
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Добавить материал
          </Button>
        </Link>
      </div>

      <Card className="shadow-mp-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-heading-md">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(MATERIAL_TYPE_LABELS) as Array<[MaterialTypeValue, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(type === key ? undefined : key)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
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
              className="border border-mp-gray-200 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Все курсы</option>
              {courses.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-mp-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHidden}
                onChange={(e) => setIncludeHidden(e.target.checked)}
                className="rounded border-mp-gray-300"
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
