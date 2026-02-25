'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DiagnosticGateBanner() {
  return (
    <Card className="shadow-mp-card border-mp-blue-200 bg-gradient-to-br from-mp-blue-50 to-white">
      <CardContent className="py-12 text-center">
        {/* Lock icon */}
        <div className="w-16 h-16 rounded-2xl bg-mp-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-heading text-mp-gray-900 mb-2">
          Пройди диагностику, чтобы получить доступ
        </h2>
        <p className="text-body text-mp-gray-500 mb-6 max-w-md mx-auto">
          Диагностика определит твои сильные и слабые стороны, и мы подберём персональный трек обучения
        </p>
        <Link href="/diagnostic">
          <Button size="lg">
            Начать диагностику
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
