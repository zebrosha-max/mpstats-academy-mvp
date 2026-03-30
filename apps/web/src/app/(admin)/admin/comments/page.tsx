import { AdminCommentTable } from '@/components/admin/AdminCommentTable';

export default function AdminCommentsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-heading-lg font-bold text-mp-gray-900">Комментарии</h2>
        <p className="text-body-sm text-mp-gray-500 mt-1">
          Модерация комментариев ко всем урокам
        </p>
      </div>
      <AdminCommentTable />
    </div>
  );
}
