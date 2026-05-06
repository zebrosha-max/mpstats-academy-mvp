'use client';

import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type ReferralStatus =
  | 'PENDING'
  | 'CONVERTED'
  | 'EXPIRED'
  | 'BLOCKED_SELF_REF'
  | 'BLOCKED_FRAUD'
  | 'PENDING_REVIEW';

const STATUS_FILTERS: Array<{ value: ReferralStatus | 'ALL'; label: string }> = [
  { value: 'PENDING_REVIEW', label: 'На проверке' },
  { value: 'CONVERTED', label: 'Подтверждённые' },
  { value: 'PENDING', label: 'В ожидании' },
  { value: 'BLOCKED_FRAUD', label: 'Отклонённые (фрод)' },
  { value: 'BLOCKED_SELF_REF', label: 'Self-ref' },
  { value: 'EXPIRED', label: 'Истёкшие' },
  { value: 'ALL', label: 'Все' },
];

const STATUS_LABEL: Record<ReferralStatus, { text: string; className: string }> = {
  PENDING: { text: 'В ожидании', className: 'bg-amber-50 text-amber-700' },
  CONVERTED: { text: 'Подтверждён', className: 'bg-green-50 text-green-700' },
  EXPIRED: { text: 'Истёк', className: 'bg-mp-gray-100 text-mp-gray-600' },
  BLOCKED_SELF_REF: { text: 'Self-ref', className: 'bg-red-50 text-red-700' },
  BLOCKED_FRAUD: { text: 'Отклонён', className: 'bg-red-50 text-red-700' },
  PENDING_REVIEW: { text: 'На проверке', className: 'bg-orange-50 text-orange-700' },
};

function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function callModerate(body: Record<string, unknown>): Promise<Response> {
  return fetch('/api/admin/referrals/moderate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function AdminReferralsTable() {
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'ALL'>('PENDING_REVIEW');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pendingAction, setPendingAction] = useState<
    | null
    | { kind: 'approve'; referralId: string }
    | { kind: 'reject'; referralId: string }
    | { kind: 'bulk-approve'; referrerUserId: string; referrerName: string; count: number }
    | { kind: 'bulk-reject'; referrerUserId: string; referrerName: string; count: number }
  >(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const utils = trpc.useUtils();
  const counts = trpc.referral.adminStatusCounts.useQuery();
  const list = trpc.referral.adminList.useQuery({
    status: statusFilter === 'ALL' ? null : statusFilter,
    search: search || undefined,
    take: 100,
  });

  // Group PENDING_REVIEW by referrer for bulk affordance.
  const groupedByReferrer = useMemo(() => {
    if (statusFilter !== 'PENDING_REVIEW' || !list.data?.items) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const r of list.data.items) {
      if (r.referrerUserId) {
        m.set(r.referrerUserId, (m.get(r.referrerUserId) ?? 0) + 1);
      }
    }
    return m;
  }, [statusFilter, list.data]);

  function refetchAll() {
    utils.referral.adminList.invalidate();
    utils.referral.adminStatusCounts.invalidate();
  }

  async function executeAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      let body: Record<string, unknown>;
      if (pendingAction.kind === 'approve') {
        body = { action: 'approve', referralId: pendingAction.referralId };
      } else if (pendingAction.kind === 'reject') {
        body = {
          action: 'reject',
          referralId: pendingAction.referralId,
          ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
        };
      } else if (pendingAction.kind === 'bulk-approve') {
        body = { action: 'bulk-approve', referrerUserId: pendingAction.referrerUserId };
      } else {
        body = {
          action: 'bulk-reject',
          referrerUserId: pendingAction.referrerUserId,
          ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}),
        };
      }
      const res = await callModerate(body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Ошибка: ${(err as { error?: unknown }).error ?? res.status}`);
      } else {
        refetchAll();
      }
    } catch (e) {
      alert(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      setPendingAction(null);
      setRejectReason('');
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'ALL' ? undefined : counts.data?.[f.value as ReferralStatus];
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-body-sm font-medium transition-colors',
                active
                  ? 'bg-mp-blue-600 text-white'
                  : 'bg-mp-gray-100 text-mp-gray-700 hover:bg-mp-gray-200',
              )}
            >
              {f.label}
              {count !== undefined && count > 0 && (
                <span className="ml-1.5 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mp-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по имени реферера или приглашённого"
          className="w-full pl-9 pr-3 py-2 border border-mp-gray-200 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-mp-blue-500"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead className="bg-mp-gray-50 border-b border-mp-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-mp-gray-700">Код</th>
                <th className="text-left px-4 py-3 font-medium text-mp-gray-700">Реферер</th>
                <th className="text-left px-4 py-3 font-medium text-mp-gray-700">Приглашённый</th>
                <th className="text-left px-4 py-3 font-medium text-mp-gray-700">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-mp-gray-700">Создан</th>
                <th className="text-left px-4 py-3 font-medium text-mp-gray-700">Ревью</th>
                <th className="text-right px-4 py-3 font-medium text-mp-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr>
                  <td colSpan={7} className="p-6">
                    <Skeleton className="h-32 w-full" />
                  </td>
                </tr>
              )}
              {!list.isLoading && list.data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-mp-gray-500">
                    Нет рефералов с этим фильтром.
                  </td>
                </tr>
              )}
              {list.data?.items.map((r) => {
                const sl = STATUS_LABEL[r.status as ReferralStatus];
                const isPendingReview = r.status === 'PENDING_REVIEW';
                const refCount = r.referrerUserId
                  ? groupedByReferrer.get(r.referrerUserId) ?? 0
                  : 0;
                return (
                  <tr key={r.id} className="border-b border-mp-gray-100 hover:bg-mp-gray-50/50">
                    <td className="px-4 py-3 font-mono text-mp-gray-700">{r.code}</td>
                    <td className="px-4 py-3 text-mp-gray-900">
                      {r.referrer?.name ?? <span className="text-mp-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-mp-gray-900">
                      {r.referred.name ?? <span className="text-mp-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                          sl.className,
                        )}
                      >
                        {sl.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-mp-gray-600 whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-mp-gray-600">
                      {r.reviewedAt ? (
                        <div>
                          <div className="text-xs">{formatDateTime(r.reviewedAt)}</div>
                          {r.reviewedBy?.name && (
                            <div className="text-xs text-mp-gray-500">{r.reviewedBy.name}</div>
                          )}
                          {r.rejectReason && (
                            <div className="text-xs italic mt-1">«{r.rejectReason}»</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-mp-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isPendingReview ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              setPendingAction({ kind: 'approve', referralId: r.id })
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPendingAction({ kind: 'reject', referralId: r.id })
                            }
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                          {refCount > 1 && r.referrerUserId && (
                            <div className="flex gap-1 ml-2 pl-2 border-l border-mp-gray-200">
                              <Button
                                size="sm"
                                variant="ghost"
                                title={`Approve все ${refCount} от этого реферера`}
                                onClick={() =>
                                  setPendingAction({
                                    kind: 'bulk-approve',
                                    referrerUserId: r.referrerUserId!,
                                    referrerName: r.referrer?.name ?? '—',
                                    count: refCount,
                                  })
                                }
                              >
                                ✓ all {refCount}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title={`Reject все ${refCount} от этого реферера`}
                                onClick={() =>
                                  setPendingAction({
                                    kind: 'bulk-reject',
                                    referrerUserId: r.referrerUserId!,
                                    referrerName: r.referrer?.name ?? '—',
                                    count: refCount,
                                  })
                                }
                              >
                                ✗ all {refCount}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-mp-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation dialog (single + bulk) */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setRejectReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === 'approve' && 'Подтвердить реферал?'}
              {pendingAction?.kind === 'reject' && 'Отклонить реферал?'}
              {pendingAction?.kind === 'bulk-approve' &&
                `Подтвердить ${pendingAction.count} рефералов от ${pendingAction.referrerName}?`}
              {pendingAction?.kind === 'bulk-reject' &&
                `Отклонить ${pendingAction.count} рефералов от ${pendingAction.referrerName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === 'approve' &&
                'Реферал будет помечен как CONVERTED, рефереру создастся PENDING-пакет на 14 дней. Будет отправлен email pa_referral_friend_registered.'}
              {pendingAction?.kind === 'bulk-approve' &&
                `Все ${pendingAction.count} PENDING_REVIEW записи от этого реферера получат статус CONVERTED. Каждому соответствующий пакет на 14 дней. Email уйдёт реферереру по каждому.`}
              {(pendingAction?.kind === 'reject' || pendingAction?.kind === 'bulk-reject') && (
                <>
                  Записи получат статус BLOCKED_FRAUD. Email рефереру не уходит.
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Причина (опционально, до 500 символов)"
                    className="mt-3 w-full px-3 py-2 border border-mp-gray-200 rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-mp-blue-500"
                    rows={2}
                    maxLength={500}
                  />
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
