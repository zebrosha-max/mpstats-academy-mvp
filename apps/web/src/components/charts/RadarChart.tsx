'use client';

import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { SkillProfile } from '@mpstats/shared';

interface SkillRadarChartProps {
  data: SkillProfile;
  previousData?: SkillProfile;
  className?: string;
  showLabels?: boolean;
}

const SKILL_CONFIG = [
  { key: 'analytics', label: 'Аналитика', fullMark: 100 },
  { key: 'marketing', label: 'Маркетинг', fullMark: 100 },
  { key: 'content', label: 'Контент', fullMark: 100 },
  { key: 'operations', label: 'Операции', fullMark: 100 },
  { key: 'finance', label: 'Финансы', fullMark: 100 },
];

export function SkillRadarChart({ data, previousData, className, showLabels = true }: SkillRadarChartProps) {
  const chartData = SKILL_CONFIG.map((skill) => ({
    subject: skill.label,
    value: data[skill.key as keyof SkillProfile],
    previous: previousData?.[skill.key as keyof SkillProfile] ?? undefined,
    fullMark: skill.fullMark,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#374151', fontSize: 12 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickCount={5}
          />
          {previousData && (
            <Radar
              name="Было"
              dataKey="previous"
              stroke="#9ca3af"
              fill="#9ca3af"
              fillOpacity={0.1}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}
          <Radar
            name={previousData ? 'Стало' : 'Ваш уровень'}
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const current = payload.find(p => p.dataKey === 'value');
                const prev = payload.find(p => p.dataKey === 'previous');
                return (
                  <div className="bg-white p-2 shadow-lg rounded border border-gray-200">
                    <p className="font-medium">{payload[0]?.payload?.subject}</p>
                    {prev && prev.value !== undefined && (
                      <p className="text-gray-400">Было: {prev.value}%</p>
                    )}
                    <p className="text-blue-600">
                      {prev ? 'Стало' : 'Уровень'}: {current?.value}%
                      {prev && prev.value !== undefined && current?.value !== undefined && (
                        <span className={Number(current.value) >= Number(prev.value) ? 'text-mp-green-600 ml-1' : 'text-red-500 ml-1'}>
                          ({Number(current.value) >= Number(prev.value) ? '+' : ''}{Number(current.value) - Number(prev.value)}%)
                        </span>
                      )}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          {previousData && <Legend />}
        </RechartsRadar>
      </ResponsiveContainer>
      {showLabels && (
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {chartData.map((item) => (
            <div key={item.subject} className="text-center">
              <div className="text-sm text-gray-500">{item.subject}</div>
              <div className="font-semibold text-gray-900">
                {item.value}%
                {item.previous !== undefined && (
                  <span className="text-xs text-gray-400 ml-1">(было {item.previous}%)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
