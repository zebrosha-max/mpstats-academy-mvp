'use client';

import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: 'blue' | 'green' | 'pink' | 'gray';
}

const colorMap = {
  blue: {
    bg: 'bg-mp-blue-50',
    icon: 'text-mp-blue-500',
    trend: 'text-mp-blue-600',
  },
  green: {
    bg: 'bg-mp-green-50',
    icon: 'text-mp-green-500',
    trend: 'text-mp-green-600',
  },
  pink: {
    bg: 'bg-mp-pink-50',
    icon: 'text-mp-pink-500',
    trend: 'text-mp-pink-600',
  },
  gray: {
    bg: 'bg-mp-gray-100',
    icon: 'text-mp-gray-500',
    trend: 'text-mp-gray-600',
  },
};

export function StatCard({ title, value, icon: Icon, trend, color = 'blue' }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-body-sm text-mp-gray-500">{title}</p>
          <p className="text-2xl font-bold text-mp-gray-900">{value}</p>
          {trend && (
            <p className={cn('text-xs font-medium', colors.trend)}>{trend}</p>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colors.bg)}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>
      </div>
    </Card>
  );
}
