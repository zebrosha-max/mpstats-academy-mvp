'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { MaterialForm } from '@/components/admin/MaterialForm';
import { ArrowLeft } from 'lucide-react';

export default function MaterialEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === 'new';

  const { data, isLoading, error } = trpc.material.getById.useQuery(
    { id: params.id! },
    { enabled: !isNew, retry: false },
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/admin/content/materials"
        className="text-mp-gray-500 hover:text-mp-gray-700 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Все материалы
      </Link>
      <h1 className="text-heading-lg font-bold text-mp-gray-900">
        {isNew ? 'Новый материал' : data?.title || 'Редактирование'}
      </h1>

      {isNew && (
        <MaterialForm
          mode="create"
          initial={null}
          onSaved={(id) => router.push(`/admin/content/materials/${id}`)}
        />
      )}

      {!isNew && isLoading && <p className="text-mp-gray-500">Загрузка…</p>}
      {!isNew && error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          Не удалось загрузить материал: {error.message}
        </div>
      )}
      {!isNew && data && (
        <MaterialForm
          mode="edit"
          initial={data}
          onSaved={(id) => router.push(`/admin/content/materials/${id}`)}
        />
      )}
    </div>
  );
}
