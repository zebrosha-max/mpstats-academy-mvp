'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SkillRadarChart } from '@/components/charts/RadarChart';
import { LessonCard } from '@/components/learning/LessonCard';
import { trpc } from '@/lib/trpc/client';

const formatTimeAgo = (date: Date | null) => {
  if (!date) return 'Никогда';
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Только что';
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 7) return `${days} дн. назад`;
  return new Date(date).toLocaleDateString('ru-RU');
};

const ACTIVITY_ICONS: Record<string, JSX.Element> = {
  lesson_completed: (
    <div className="w-10 h-10 rounded-xl bg-mp-green-100 flex items-center justify-center">
      <svg className="w-5 h-5 text-mp-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ),
  diagnostic_completed: (
    <div className="w-10 h-10 rounded-xl bg-mp-blue-100 flex items-center justify-center">
      <svg className="w-5 h-5 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </div>
  ),
  lesson_started: (
    <div className="w-10 h-10 rounded-xl bg-mp-pink-100 flex items-center justify-center">
      <svg className="w-5 h-5 text-mp-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      </svg>
    </div>
  ),
};

export default function DashboardPage() {
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: dashboard, isLoading } = trpc.profile.getDashboard.useQuery();

  const name = profile?.name || 'Пользователь';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="shadow-mp-card">
              <CardContent className="py-5">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="animate-slide-up" style={{ animationDelay: '0ms' }}>
        <h1 className="text-display-sm text-mp-gray-900">
          Привет, {name}!
        </h1>
        <p className="text-body text-mp-gray-500 mt-1">
          Добро пожаловать в MPSTATS Academy
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <Card className="shadow-mp-card hover:shadow-mp-card-hover transition-shadow">
          <CardContent className="py-5">
            <div className="text-display-sm font-bold text-mp-gray-900">
              {dashboard?.stats.totalLessonsCompleted || 0}
            </div>
            <div className="text-body-sm text-mp-gray-500">Уроков пройдено</div>
          </CardContent>
        </Card>
        <Card className="shadow-mp-card hover:shadow-mp-card-hover transition-shadow">
          <CardContent className="py-5">
            <div className="text-display-sm font-bold text-mp-blue-500">
              {dashboard?.stats.totalWatchTime || 0} мин
            </div>
            <div className="text-body-sm text-mp-gray-500">Время обучения</div>
          </CardContent>
        </Card>
        <Card className="shadow-mp-card hover:shadow-mp-card-hover transition-shadow">
          <CardContent className="py-5">
            <div className="text-display-sm font-bold text-mp-green-500 flex items-center gap-1">
              {dashboard?.stats.currentStreak || 0}
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <div className="text-body-sm text-mp-gray-500">Дней подряд</div>
          </CardContent>
        </Card>
        <Card className="shadow-mp-card hover:shadow-mp-card-hover transition-shadow">
          <CardContent className="py-5">
            <div className="text-display-sm font-bold text-mp-pink-500">
              {dashboard?.completionPercent || 0}%
            </div>
            <div className="text-body-sm text-mp-gray-500">Прогресс курса</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick actions */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card variant="soft-blue" className="hover:shadow-mp-card-hover transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-mp-blue-200 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <CardTitle className="text-heading">Пройти диагностику</CardTitle>
                <CardDescription className="text-body-sm">
                  Узнайте свой уровень по 5 ключевым навыкам
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/diagnostic">
                  <Button className="w-full">Начать тест</Button>
                </Link>
              </CardContent>
            </Card>

            <Card variant="soft-green" className="hover:shadow-mp-card-hover transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-mp-green-200 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-mp-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <CardTitle className="text-heading">Продолжить обучение</CardTitle>
                <CardDescription className="text-body-sm">
                  Персональный план на основе диагностики
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/learn">
                  <Button variant="outline" className="w-full">К урокам</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Next lesson */}
          {dashboard?.nextLesson && (
            <Card className="shadow-mp-card">
              <CardHeader>
                <CardTitle className="text-heading">Продолжить урок</CardTitle>
              </CardHeader>
              <CardContent>
                <LessonCard lesson={dashboard.nextLesson} />
              </CardContent>
            </Card>
          )}

          {/* Recent activity */}
          <Card className="shadow-mp-card">
            <CardHeader>
              <CardTitle className="text-heading">Последняя активность</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {dashboard.recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-mp-gray-50 transition-colors">
                      {ACTIVITY_ICONS[activity.type]}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-mp-gray-900">{activity.title}</p>
                        <p className="text-body-sm text-mp-gray-500">{activity.description}</p>
                      </div>
                      <span className="text-caption text-mp-gray-400">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-mp-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-body text-mp-gray-500">
                    Пока нет активности. Начните с диагностики!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Radar */}
        <div className="space-y-6">
          <Card className="shadow-mp-card">
            <CardHeader>
              <CardTitle className="text-heading">Профиль навыков</CardTitle>
              <CardDescription className="text-body-sm">
                Ваш уровень по 5 компетенциям
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.skillProfile ? (
                <SkillRadarChart data={dashboard.skillProfile} showLabels={false} />
              ) : (
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-mp-gray-200 rounded-xl bg-mp-gray-50">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-mp-gray-200 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-body-sm text-mp-gray-500">Пройдите диагностику</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Average score */}
          {dashboard?.skillProfile && (
            <Card variant="gradient" className="shadow-mp-card">
              <CardContent className="py-6 text-center">
                <div className="text-display font-bold text-mp-blue-600">
                  {dashboard.stats.averageScore}%
                </div>
                <div className="text-body-sm text-mp-gray-500 mt-1">Средний балл</div>
                <Link href="/diagnostic">
                  <Button variant="link" className="mt-3 text-mp-blue-600">
                    Улучшить результат →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
