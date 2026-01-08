'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc/client';
import { SkillRadarChart } from '@/components/charts/RadarChart';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: profile, refetch } = trpc.profile.get.useQuery();
  const { data: skillProfile } = trpc.profile.getSkillProfile.useQuery();

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsSaving(false);
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    setIsSaving(true);
    updateProfile.mutate({ name });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm text-mp-gray-900">Профиль</h1>
        <p className="text-body text-mp-gray-500 mt-1">Настройки аккаунта и статистика</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile info */}
          <Card className="shadow-mp-card">
            <CardHeader>
              <CardTitle className="text-heading">Личные данные</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-body-sm font-medium text-mp-gray-700 mb-2">
                  Имя
                </label>
                <Input
                  type="text"
                  defaultValue={profile?.name || ''}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Введите имя"
                />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Сохранение...
                  </>
                ) : (
                  'Сохранить'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="shadow-mp-card">
            <CardHeader>
              <CardTitle className="text-heading">Быстрые действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/profile/history"
                className="flex items-center justify-between p-4 border border-mp-gray-200 rounded-xl hover:bg-mp-gray-50 hover:border-mp-blue-300 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-mp-blue-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-mp-gray-900">История диагностик</div>
                    <div className="text-body-sm text-mp-gray-500">Все пройденные тесты</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/diagnostic"
                className="flex items-center justify-between p-4 border border-mp-gray-200 rounded-xl hover:bg-mp-gray-50 hover:border-mp-green-300 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-mp-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-mp-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-mp-gray-900">Пройти диагностику</div>
                    <div className="text-body-sm text-mp-gray-500">Обновить профиль навыков</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/learn"
                className="flex items-center justify-between p-4 border border-mp-gray-200 rounded-xl hover:bg-mp-gray-50 hover:border-mp-pink-300 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-mp-pink-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-mp-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-mp-gray-900">Продолжить обучение</div>
                    <div className="text-body-sm text-mp-gray-500">Персональный план уроков</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Skill profile */}
          <Card className="shadow-mp-card">
            <CardHeader>
              <CardTitle className="text-heading">Профиль навыков</CardTitle>
              <CardDescription className="text-body-sm">Последний результат диагностики</CardDescription>
            </CardHeader>
            <CardContent>
              {skillProfile ? (
                <SkillRadarChart data={skillProfile} showLabels={false} />
              ) : (
                <div className="h-48 flex items-center justify-center border-2 border-dashed border-mp-gray-200 rounded-xl bg-mp-gray-50">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-mp-gray-200 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-mp-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-body-sm text-mp-gray-500 mb-2">Нет данных</p>
                    <Link href="/diagnostic">
                      <Button variant="link" size="sm" className="text-mp-blue-600">
                        Пройти тест
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account info */}
          <Card variant="soft-blue" className="shadow-mp-card">
            <CardContent className="py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mp-blue-500 to-mp-blue-600 flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-mp-gray-900 truncate">
                    {profile?.name || 'Пользователь'}
                  </div>
                  <div className="text-body-sm text-mp-gray-500 truncate">
                    ID: {profile?.id?.slice(0, 8)}...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
