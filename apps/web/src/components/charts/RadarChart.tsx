'use client';

import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { SkillProfile } from '@mpstats/shared';

interface SkillRadarChartProps {
  data: SkillProfile;
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

export function SkillRadarChart({ data, className, showLabels = true }: SkillRadarChartProps) {
  const chartData = SKILL_CONFIG.map((skill) => ({
    subject: skill.label,
    value: data[skill.key as keyof SkillProfile],
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
          <Radar
            name="Ваш уровень"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0];
                return (
                  <div className="bg-white p-2 shadow-lg rounded border border-gray-200">
                    <p className="font-medium">{item.payload.subject}</p>
                    <p className="text-blue-600">{item.value}%</p>
                  </div>
                );
              }
              return null;
            }}
          />
        </RechartsRadar>
      </ResponsiveContainer>
      {showLabels && (
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {chartData.map((item) => (
            <div key={item.subject} className="text-center">
              <div className="text-sm text-gray-500">{item.subject}</div>
              <div className="font-semibold text-gray-900">{item.value}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
