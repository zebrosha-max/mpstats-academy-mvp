'use client';

import { trpc } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

/** Pretty-print feature flag keys: billing_enabled -> Billing Enabled */
function formatFlagKey(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function SettingsPage() {
  const flags = trpc.admin.getFeatureFlags.useQuery();
  const toggle = trpc.admin.toggleFeatureFlag.useMutation({
    onSuccess: () => flags.refetch(),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-heading-lg font-bold text-mp-gray-900">Settings</h2>
        <p className="text-body-sm text-mp-gray-500 mt-1">
          Manage feature flags and system configuration
        </p>
      </div>

      {/* Feature Flags Card */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-mp-gray-100">
          <h3 className="text-body-md font-semibold text-mp-gray-900">Feature Flags</h3>
          <p className="text-body-xs text-mp-gray-500 mt-0.5">
            Toggle features on or off without redeploying
          </p>
        </div>

        {flags.isLoading && (
          <div className="divide-y divide-mp-gray-100">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {flags.data && flags.data.length === 0 && (
          <div className="p-8 text-center text-body-sm text-mp-gray-400">
            No feature flags configured
          </div>
        )}

        {flags.data && flags.data.length > 0 && (
          <div className="divide-y divide-mp-gray-100">
            {flags.data.map((flag) => (
              <div
                key={flag.key}
                className="flex items-center justify-between p-4 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-mp-gray-900">
                    {formatFlagKey(flag.key)}
                  </p>
                  {flag.description && (
                    <p className="text-body-xs text-mp-gray-500 mt-0.5">
                      {flag.description}
                    </p>
                  )}
                </div>
                <Switch
                  checked={flag.enabled}
                  onCheckedChange={() => toggle.mutate({ key: flag.key })}
                  disabled={toggle.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
