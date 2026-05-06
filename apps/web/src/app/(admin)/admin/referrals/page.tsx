import { AdminReferralsTable } from '@/components/admin/AdminReferralsTable';

export const dynamic = 'force-dynamic';

export default function AdminReferralsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-heading-lg font-bold text-mp-gray-900">Реферальная программа</h2>
        <p className="text-body-sm text-mp-gray-500 mt-1">
          Модерация рефералов: подтверждение или отклонение записей со статусом «На проверке»
          (cap 5 рефералов в неделю).
        </p>
      </div>
      <AdminReferralsTable />
    </div>
  );
}
