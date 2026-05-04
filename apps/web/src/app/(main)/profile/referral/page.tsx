'use client';

import { trpc } from '@/lib/trpc/client';
import { ReferralCodeBlock } from '@/components/profile/ReferralCodeBlock';
import { ReferralPackageList } from '@/components/profile/ReferralPackageList';
import { ReferralRulesText } from '@/components/profile/ReferralRulesText';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function ReferralPage() {
  const stateQ = trpc.referral.getMyState.useQuery();
  const utils = trpc.useUtils();
  const activate = trpc.referral.activatePackage.useMutation({
    onSuccess: () => utils.referral.getMyState.invalidate(),
  });

  if (stateQ.isLoading) {
    return <div className="p-6 text-mp-gray-500">Загружаем…</div>;
  }

  const state = stateQ.data;
  if (!state) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link href="/profile" className="inline-flex items-center text-mp-gray-600 hover:text-mp-gray-900 text-sm">
        <ChevronLeft className="w-4 h-4 mr-1" /> К профилю
      </Link>

      <div>
        <h1 className="text-heading-lg font-semibold mb-1">Рефералка</h1>
        <p className="text-mp-gray-600 text-sm">
          Приглашай друзей в Платформу — оба получаете доступ.
        </p>
      </div>

      <ReferralRulesText />

      <ReferralCodeBlock code={state.referralCode} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Привёл друзей" value={state.totalReferred} />
        <Stat label="Оплатили" value={state.totalConverted} />
        <Stat label="Доступно пакетов" value={state.pendingPackages.length} />
      </div>

      <ReferralPackageList
        pending={state.pendingPackages}
        used={state.usedPackages}
        isActivating={activate.isPending}
        onActivate={(packageId) => activate.mutate({ packageId })}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-mp-gray-200 rounded-lg p-3 bg-white">
      <div className="text-2xl font-semibold text-mp-gray-900">{value}</div>
      <div className="text-xs text-mp-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
