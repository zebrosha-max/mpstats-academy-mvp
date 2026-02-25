import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mp-gray-50 p-4">
      <Card className="max-w-md w-full shadow-mp-card">
        <CardContent className="py-12 text-center">
          <div className="mb-6">
            <span className="text-2xl font-bold text-mp-blue-600">MPSTATS</span>
            <span className="text-2xl font-light text-mp-gray-400 ml-1">Academy</span>
          </div>
          <div className="text-8xl font-bold text-mp-blue-100 mb-4">404</div>
          <h1 className="text-xl font-bold text-mp-gray-900 mb-2">
            Страница не найдена
          </h1>
          <p className="text-sm text-mp-gray-500 mb-6">
            Запрашиваемая страница не существует или была перемещена.
          </p>
          <Link href="/dashboard">
            <Button>На главную</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
