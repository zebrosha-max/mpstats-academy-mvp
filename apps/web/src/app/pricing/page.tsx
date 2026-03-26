'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo, LogoMark } from '@/components/shared/Logo';
import { trpc } from '@/lib/trpc/client';
import { openPaymentWidget } from '@/lib/cloudpayments/widget';
import { toast } from 'sonner';
import { reachGoal } from '@/lib/analytics/metrika';
import { METRIKA_GOALS } from '@/lib/analytics/constants';

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('ru-RU').format(amount);

export default function PricingPage() {
  const router = useRouter();
  const [widgetReady, setWidgetReady] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch plans (public)
  const { data: plans, isLoading: plansLoading } = trpc.billing.getPlans.useQuery();

  // Fetch subscription (may fail for unauthenticated — that's ok)
  const { data: subscription } = trpc.billing.getSubscription.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fetch courses for dropdown (public — works for everyone)
  const { data: courses } = trpc.billing.getCourses.useQuery();

  // Initiate payment mutation
  const initiatePayment = trpc.billing.initiatePayment.useMutation();

  // Track pricing page view in Metrika
  useEffect(() => {
    reachGoal(METRIKA_GOALS.PRICING_VIEW);
  }, []);

  // Redirect if billing disabled (empty plans array)
  useEffect(() => {
    if (!plansLoading && plans && plans.length === 0) {
      router.replace('/');
    }
  }, [plans, plansLoading, router]);

  const coursePlan = plans?.find((p) => p.type === 'COURSE');
  const platformPlan = plans?.find((p) => p.type === 'PLATFORM');

  const hasActiveCourseSubscription =
    subscription &&
    subscription.plan.type === 'COURSE' &&
    ['ACTIVE', 'PAST_DUE'].includes(subscription.status) &&
    subscription.courseId === selectedCourseId;

  const hasActivePlatformSubscription =
    subscription &&
    subscription.plan.type === 'PLATFORM' &&
    ['ACTIVE', 'PAST_DUE'].includes(subscription.status);

  const handlePayment = async (planType: 'COURSE' | 'PLATFORM') => {
    if (planType === 'COURSE' && !selectedCourseId) {
      setMessage({ type: 'error', text: 'Выберите курс' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const result = await initiatePayment.mutateAsync({
        planType,
        courseId: planType === 'COURSE' ? selectedCourseId : undefined,
      });

      const success = await openPaymentWidget({
        publicId: process.env.NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID!,
        description: result.description,
        amount: result.amount,
        currency: 'RUB',
        accountId: result.userId,
        invoiceId: result.subscriptionId,
        recurrent: { interval: 'Month', period: 1 },
      });

      if (success) {
        reachGoal(METRIKA_GOALS.PAYMENT, { planType, amount: result.amount, currency: 'RUB' });
        setMessage({ type: 'success', text: 'Оплата принята! Подписка активируется в течение минуты.' });
        toast.success('Оплата прошла успешно', { description: 'Подписка активирована.' });
        setTimeout(() => router.push('/profile'), 3000);
      } else {
        setMessage({ type: 'error', text: 'Оплата не прошла. Попробуйте снова.' });
        toast.error('Оплата не прошла', { description: 'Попробуйте снова или выберите другой способ оплаты.' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка';
      const isAuthError = errorMessage.includes('UNAUTHORIZED') || errorMessage.toLowerCase().includes('not authenticated');
      if (isAuthError) {
        setMessage({ type: 'error', text: 'Для оформления подписки необходимо войти в аккаунт. Перенаправляем...' });
        setTimeout(() => router.push('/login'), 2000);
        return;
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsProcessing(false);
    }
  };

  if (plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-mp-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return null; // Redirect is happening
  }

  return (
    <>
      <Script
        src="https://widget.cloudpayments.ru/bundles/cloudpayments"
        strategy="lazyOnload"
        onReady={() => setWidgetReady(true)}
      />

      <div className="min-h-screen bg-mp-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-mp-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-mp-gray-600 hover:text-mp-gray-900 transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-body-sm">Назад</span>
            </button>
            {/* Full logo on sm+, icon-only on mobile */}
            <div className="hidden sm:block">
              <Logo size="sm" />
            </div>
            <div className="sm:hidden">
              <LogoMark size="sm" />
            </div>
            <div className="w-16 shrink-0" /> {/* Spacer for centering logo */}
          </div>
        </header>

        {/* Content */}
        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h1 className="text-display-sm text-mp-gray-900 mb-2">Тарифные планы</h1>
            <p className="text-body text-mp-gray-500">
              Выберите подходящий план для обучения
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl text-center ${
                message.type === 'success'
                  ? 'bg-mp-green-50 text-mp-green-800 border border-mp-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto items-stretch">
            {/* COURSE plan */}
            {coursePlan && (
              <Card className="relative h-full flex flex-col">
                {hasActiveCourseSubscription && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="success">Ваш план</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-heading">{coursePlan.name}</CardTitle>
                  <p className="text-body-sm text-mp-gray-500">
                    Доступ к одному курсу на выбор
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-display-sm text-mp-gray-900">
                    {formatPrice(coursePlan.price)}{' '}
                    <span className="text-body text-mp-gray-500">/ мес</span>
                  </div>

                  {/* Course select */}
                  <div>
                    <label htmlFor="course-select" className="block text-body-sm font-medium text-mp-gray-700 mb-2">
                      Выберите курс
                    </label>
                    <select
                      id="course-select"
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full rounded-lg border border-mp-gray-300 bg-white px-3 py-2.5 text-body-sm text-mp-gray-900 focus:border-mp-blue-500 focus:outline-none focus:ring-2 focus:ring-mp-blue-500/20"
                    >
                      <option value="">-- Выберите курс --</option>
                      {courses
                        ?.filter((c) => !['04_workshops', '06_express'].includes(c.id))
                        .map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  <ul className="space-y-2 text-body-sm text-mp-gray-600">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Все видеоуроки курса
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      AI-помощник по материалам
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Конспекты уроков
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto">
                  {hasActiveCourseSubscription ? (
                    <Link href="/profile" className="block w-full">
                      <Button variant="outline" className="w-full">
                        Управление подпиской
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handlePayment('COURSE')}
                      disabled={isProcessing || !widgetReady || !selectedCourseId}
                    >
                      {isProcessing ? 'Обработка...' : 'Оформить подписку'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )}

            {/* PLATFORM plan */}
            {platformPlan && (
              <Card className="relative h-full flex flex-col border-2 border-mp-blue-500">
                <div className="absolute top-4 right-4">
                  {hasActivePlatformSubscription ? (
                    <Badge variant="success">Ваш план</Badge>
                  ) : (
                    <Badge variant="primary">Выгодно</Badge>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="text-heading">{platformPlan.name}</CardTitle>
                  <p className="text-body-sm text-mp-gray-500">
                    Полный доступ ко всем курсам
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-display-sm text-mp-gray-900">
                    {formatPrice(platformPlan.price)}{' '}
                    <span className="text-body text-mp-gray-500">/ мес</span>
                  </div>

                  <ul className="space-y-2 text-body-sm text-mp-gray-600">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Все курсы (400+ видеоуроков)
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Экспресс-курсы и практические воркшопы
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      AI-помощник по всем материалам
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      AI-диагностика навыков
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-mp-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Персональный план обучения
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto">
                  {hasActivePlatformSubscription ? (
                    <Link href="/profile" className="block w-full">
                      <Button variant="outline" className="w-full">
                        Управление подпиской
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="featured"
                      className="w-full"
                      onClick={() => handlePayment('PLATFORM')}
                      disabled={isProcessing || !widgetReady}
                    >
                      {isProcessing ? 'Обработка...' : 'Оформить подписку'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
