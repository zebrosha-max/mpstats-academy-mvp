'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import { trpc } from '@/lib/trpc/client';

function CompleteProfileForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const profile = trpc.profile.get.useQuery();

  // If profile already has phone, redirect to dashboard
  if (profile.data?.phone) {
    router.replace('/dashboard');
    return null;
  }

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      router.push('/dashboard');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      setError('Введите корректный номер телефона');
      return;
    }

    setError('');
    updateProfile.mutate({ phone });
  };

  if (profile.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Последний шаг</CardTitle>
        <CardDescription>
          Укажите номер телефона для завершения регистрации
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Телефон <span className="text-red-500">*</span>
            </label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              disabled={updateProfile.isPending}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={updateProfile.isPending || !phone.trim()}
          >
            {updateProfile.isPending ? 'Сохранение...' : 'Продолжить'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Загрузка...</div>}>
      <CompleteProfileForm />
    </Suspense>
  );
}
