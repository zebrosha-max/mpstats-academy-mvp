import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage() {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <CardTitle className="text-2xl">Проверьте почту</CardTitle>
        <CardDescription className="text-base">
          Мы отправили письмо с ссылкой для подтверждения
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-gray-600">
          Перейдите по ссылке в письме, чтобы активировать аккаунт.
          Если письмо не пришло, проверьте папку «Спам».
        </p>
      </CardContent>

      <CardFooter className="flex-col gap-4">
        <Link href="/login" className="w-full">
          <Button variant="outline" className="w-full">
            Вернуться ко входу
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
