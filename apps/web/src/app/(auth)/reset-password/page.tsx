'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    try {
      const result = await updatePassword(formData);

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch {
      // redirect() throws NEXT_REDIRECT — this is expected success
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 500);
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="text-green-600 text-lg font-medium mb-2">Пароль успешно изменён</div>
          <p className="text-sm text-muted-foreground">Перенаправляем...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Новый пароль</CardTitle>
        <CardDescription>
          Введите новый пароль для вашего аккаунта
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Новый пароль
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Подтвердите пароль
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Повторите пароль"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить пароль'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
