'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkillRadarChart } from '@/components/charts/RadarChart';
import { trpc } from '@/lib/trpc/client';

const PRIORITY_STYLES = {
  HIGH: { badge: 'destructive' as const, label: 'Приоритет' },
  MEDIUM: { badge: 'warning' as const, label: 'Средний' },
  LOW: { badge: 'success' as const, label: 'Низкий' },
};

export default function DiagnosticResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');

  const { data: results, isLoading } = trpc.diagnostic.getResults.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  );

  if (!sessionId) {
    router.push('/diagnostic');
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-mp-card">
          <CardContent className="py-12 text-center">
            <svg className="animate-spin h-10 w-10 mx-auto text-mp-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-4 text-body text-mp-gray-500">Анализируем результаты...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-mp-card">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-body text-mp-gray-500">Результаты не найдены</p>
            <Button className="mt-4" onClick={() => router.push('/diagnostic')}>
              Пройти диагностику
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scoreColor = results.accuracy >= 70 ? 'text-mp-green-500' : results.accuracy >= 50 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-mp-green-100 mb-4">
          <svg className="w-10 h-10 text-mp-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-display-sm text-mp-gray-900">Диагностика завершена!</h1>
        <p className="text-body text-mp-gray-500 mt-2">
          Вы ответили на {results.totalQuestions} вопросов
        </p>
      </div>

      {/* Score overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-mp-card">
          <CardContent className="py-6 text-center">
            <div className={`text-display font-bold ${scoreColor}`}>
              {results.accuracy}%
            </div>
            <div className="text-body-sm text-mp-gray-500 mt-1">Общий результат</div>
          </CardContent>
        </Card>
        <Card className="shadow-mp-card">
          <CardContent className="py-6 text-center">
            <div className="text-display font-bold text-mp-gray-900">
              {results.correctAnswers}/{results.totalQuestions}
            </div>
            <div className="text-body-sm text-mp-gray-500 mt-1">Правильных ответов</div>
          </CardContent>
        </Card>
        <Card className="shadow-mp-card">
          <CardContent className="py-6 text-center">
            <div className="text-display font-bold text-mp-blue-500">
              {results.gaps.filter(g => g.priority === 'HIGH').length}
            </div>
            <div className="text-body-sm text-mp-gray-500 mt-1">Зон для развития</div>
          </CardContent>
        </Card>
      </div>

      {/* Radar chart */}
      <Card className="shadow-mp-card">
        <CardHeader>
          <CardTitle className="text-heading">Профиль навыков</CardTitle>
          <CardDescription className="text-body-sm">
            Ваш уровень по 5 ключевым компетенциям селлера
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SkillRadarChart data={results.skillProfile} />
        </CardContent>
      </Card>

      {/* Skill gaps */}
      <Card className="shadow-mp-card">
        <CardHeader>
          <CardTitle className="text-heading">Рекомендации по развитию</CardTitle>
          <CardDescription className="text-body-sm">
            Навыки отсортированы по приоритету улучшения
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.gaps
              .filter(gap => gap.gap > 0)
              .sort((a, b) => b.gap - a.gap)
              .map((gap) => (
                <div
                  key={gap.category}
                  className="flex items-center justify-between p-4 border border-mp-gray-200 rounded-xl hover:bg-mp-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-heading-xl font-bold text-mp-gray-900">
                        {gap.currentScore}%
                      </div>
                      <div className="text-caption text-mp-gray-500">текущий</div>
                    </div>
                    <div>
                      <svg className="w-6 h-6 text-mp-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <div className="text-heading-xl font-bold text-mp-blue-500">
                        {gap.targetScore}%
                      </div>
                      <div className="text-caption text-mp-gray-500">цель</div>
                    </div>
                  </div>
                  <div className="flex-1 px-6">
                    <div className="font-medium text-mp-gray-900">{gap.label}</div>
                    <div className="text-body-sm text-mp-gray-500">
                      Нужно улучшить на {gap.gap}%
                    </div>
                  </div>
                  <Badge variant={PRIORITY_STYLES[gap.priority].badge}>
                    {PRIORITY_STYLES[gap.priority].label}
                  </Badge>
                </div>
              ))}
            {results.gaps.filter(gap => gap.gap > 0).length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-mp-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-mp-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-body text-mp-gray-500">
                  Отличный результат! Все навыки на высоком уровне.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card variant="gradient" className="shadow-mp-lg">
        <CardContent className="py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-heading-xl text-mp-gray-900">
                Готов персональный план обучения
              </h3>
              <p className="text-body text-mp-gray-500 mt-1">
                {results.recommendedPath.length} уроков для закрытия пробелов в знаниях
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/learn">
                <Button size="lg" className="shadow-mp-md">
                  Начать обучение
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg">
                  На главную
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
