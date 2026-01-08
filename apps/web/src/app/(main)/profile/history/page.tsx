'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';

export default function DiagnosticHistoryPage() {
  const { data: history, isLoading } = trpc.diagnostic.getHistory.useQuery();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: Date, end: Date) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.round(diff / (1000 * 60));
    return `${minutes} мин`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-mp-green-500';
    if (score >= 60) return 'text-mp-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-mp-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm text-mp-gray-900">История диагностик</h1>
          <p className="text-body text-mp-gray-500 mt-1">Все пройденные тесты</p>
        </div>
        <Link href="/diagnostic">
          <Button>Новая диагностика</Button>
        </Link>
      </div>

      {/* History list */}
      {history && history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item, index) => (
            <Link key={item.id} href={`/diagnostic/results?id=${item.id}`}>
              <Card className="shadow-mp-card hover:shadow-mp-card-hover transition-all duration-300 cursor-pointer hover:-translate-y-0.5 hover:border-mp-blue-300">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-mp-blue-100 flex items-center justify-center">
                        <span className="text-heading font-bold text-mp-blue-600">
                          #{history.length - index}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-mp-gray-900">
                          Диагностика от {formatDate(item.startedAt)}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-body-sm text-mp-gray-500 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {item.completedAt ? formatDuration(item.startedAt, item.completedAt) : '—'}
                          </span>
                          <Badge variant="success">Завершён</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-display-sm font-bold ${getScoreColor(item.score)}`}>
                        {item.score}%
                      </div>
                      <div className="text-body-sm text-mp-gray-500">результат</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="shadow-mp-card">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-body text-mp-gray-500 mb-4">Вы ещё не проходили диагностику</p>
            <Link href="/diagnostic">
              <Button>Пройти первый тест</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Back link */}
      <div className="text-center">
        <Link
          href="/profile"
          className="text-mp-blue-600 hover:text-mp-blue-700 hover:underline text-body-sm transition-colors"
        >
          ← Назад к профилю
        </Link>
      </div>
    </div>
  );
}
