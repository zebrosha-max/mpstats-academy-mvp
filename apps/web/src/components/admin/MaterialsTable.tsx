'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Table,
  ExternalLink,
  ListChecks,
  StickyNote,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { MATERIAL_TYPE_LABELS, type MaterialTypeValue } from '@mpstats/shared';
import { toast } from 'sonner';

const TYPE_ICONS: Record<MaterialTypeValue, typeof FileText> = {
  PRESENTATION: FileText,
  CALCULATION_TABLE: Table,
  EXTERNAL_SERVICE: ExternalLink,
  CHECKLIST: ListChecks,
  MEMO: StickyNote,
};

type Item = {
  id: string;
  type: MaterialTypeValue;
  title: string;
  externalUrl: string | null;
  storagePath: string | null;
  isStandalone: boolean;
  isHidden: boolean;
  _count: { lessons: number };
  updatedAt: Date | string;
};

export function MaterialsTable({
  items,
  isLoading,
  onRefetch,
}: {
  items: Item[];
  isLoading: boolean;
  onRefetch: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const deleteMut = trpc.material.delete.useMutation({
    onSuccess: () => {
      toast.success('Материал удалён');
      onRefetch();
      setConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.material.update.useMutation({
    onSuccess: () => {
      onRefetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!items.length) {
    return (
      <div className="text-mp-gray-500 text-center py-12 border border-dashed border-mp-gray-200 rounded-lg">
        Материалов пока нет
      </div>
    );
  }

  return (
    <div className="border border-mp-gray-200 rounded-lg overflow-x-auto bg-white">
      <table className="w-full text-sm">
        <thead className="bg-mp-gray-50 border-b border-mp-gray-200">
          <tr>
            <th className="text-left px-4 py-3 w-12"></th>
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
            const Icon = TYPE_ICONS[m.type] ?? FileText;
            return (
              <tr key={m.id} className="border-b border-mp-gray-100 hover:bg-mp-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Icon className="w-5 h-5 text-mp-gray-500" />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/content/materials/${m.id}`}
                    className="text-mp-blue-700 hover:underline font-medium"
                  >
                    {m.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-mp-gray-700">{MATERIAL_TYPE_LABELS[m.type]}</td>
                <td className="px-4 py-3 text-mp-gray-700">{m._count.lessons}</td>
                <td className="px-4 py-3 text-mp-gray-600">
                  {m.externalUrl ? 'External URL' : m.storagePath ? 'Storage' : '—'}
                </td>
                <td className="px-4 py-3">
                  {m.isHidden ? (
                    <Badge variant="default">Скрыт</Badge>
                  ) : (
                    <Badge variant="success">Активен</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateMut.mutate({ id: m.id, isHidden: !m.isHidden })}
                    title={m.isHidden ? 'Показать' : 'Скрыть'}
                    disabled={updateMut.isPending}
                  >
                    {m.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmId(m.id)}
                    title="Удалить"
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
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-sm w-full shadow-mp-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-heading-md font-semibold mb-2">Удалить материал?</h3>
            <p className="text-body-sm text-mp-gray-600 mb-4">
              Файл из Storage будет удалён, привязки к урокам сохранятся в архиве.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmId(null)}>
                Отмена
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMut.mutate({ id: confirmId })}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? 'Удаление…' : 'Удалить'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
