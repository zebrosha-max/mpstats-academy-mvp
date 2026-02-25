'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-mp-gray-50 p-4">
      <Card className="max-w-md w-full shadow-mp-card">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-mp-gray-900 mb-2">
            Что-то пошло не так
          </h2>
          <p className="text-sm text-mp-gray-500 mb-6">
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => reset()}>
              Повторить
            </Button>
            <Link href="/">
              <Button>На главную</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
