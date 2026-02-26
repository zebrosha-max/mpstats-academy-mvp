'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { ActivityChart } from '@/components/admin/ActivityChart';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-mp-gray-900">{value}</p>
      <p className="text-xs text-mp-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const analytics = trpc.admin.getAnalytics.useQuery({ days });

  // Calculate summary stats
  const userTotal = analytics.data?.userGrowth.reduce((s, d) => s + d.count, 0) ?? 0;
  const activityTotal = analytics.data?.activity.reduce((s, d) => s + d.count, 0) ?? 0;
  const userAvg = days > 0 ? (userTotal / days).toFixed(1) : '0';
  const activityAvg = days > 0 ? (activityTotal / days).toFixed(1) : '0';
  const userPeak = analytics.data?.userGrowth.reduce((max, d) => Math.max(max, d.count), 0) ?? 0;
  const activityPeak = analytics.data?.activity.reduce((max, d) => Math.max(max, d.count), 0) ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-heading-lg font-bold text-mp-gray-900">Analytics</h2>
          <p className="text-body-sm text-mp-gray-500 mt-1">User growth and platform activity</p>
        </div>
        <div className="flex items-center gap-1 bg-mp-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                'px-3 py-1.5 text-body-sm font-medium rounded-md transition-all duration-200',
                days === p.days
                  ? 'bg-white text-mp-blue-600 shadow-sm'
                  : 'text-mp-gray-600 hover:text-mp-gray-900',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4 col-span-1">
          <SummaryStat label="New users" value={userTotal} />
        </Card>
        <Card className="p-4 col-span-1">
          <SummaryStat label="Avg/day" value={userAvg} />
        </Card>
        <Card className="p-4 col-span-1">
          <SummaryStat label="Peak day" value={userPeak} />
        </Card>
        <Card className="p-4 col-span-1">
          <SummaryStat label="Diagnostics" value={activityTotal} />
        </Card>
        <Card className="p-4 col-span-1">
          <SummaryStat label="Avg/day" value={activityAvg} />
        </Card>
        <Card className="p-4 col-span-1">
          <SummaryStat label="Peak day" value={activityPeak} />
        </Card>
      </div>

      {/* Charts */}
      {analytics.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-[250px] w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-[250px] w-full" />
          </Card>
        </div>
      ) : analytics.error ? (
        <Card className="p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load analytics</p>
          <p className="text-body-sm text-mp-gray-500 mt-1">{analytics.error.message}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <ActivityChart
              data={analytics.data?.userGrowth ?? []}
              title="User Growth"
              color="#2563eb"
            />
          </Card>
          <Card className="p-5">
            <ActivityChart
              data={analytics.data?.activity ?? []}
              title="Diagnostic Activity"
              color="#16a34a"
            />
          </Card>
        </div>
      )}
    </div>
  );
}
