import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mp-gray-50 p-4">
      <Card className="max-w-md w-full shadow-mp-card">
        <CardContent className="py-12 text-center">
          <div className="mb-6 flex justify-center">
            <Logo size="md" href={undefined} />
          </div>
          <div className="text-8xl font-bold text-mp-blue-100 mb-4">404</div>
          <h1 className="text-xl font-bold text-mp-gray-900 mb-2">
            Страница не найдена
          </h1>
          <p className="text-sm text-mp-gray-500 mb-6">
            Запрашиваемая страница не существует или была перемещена.
          </p>
          <Link href="/">
            <Button>На главную</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
