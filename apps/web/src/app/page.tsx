import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Logo, LogoMark } from '@/components/shared/Logo';

const features = [
  {
    title: 'AI-диагностика',
    description: 'Пройдите тест и получите объективную оценку навыков по 5 ключевым направлениям',
    icon: '🎯',
    color: 'blue' as const,
  },
  {
    title: 'Персональный трек',
    description: 'Система подберёт уроки именно для вас, скрыв то, что вы уже знаете',
    icon: '🛤️',
    color: 'green' as const,
  },
  {
    title: 'AI-ассистент',
    description: 'Задавайте вопросы по урокам и получайте ответы с точными таймкодами',
    icon: '🤖',
    color: 'pink' as const,
  },
  {
    title: 'Радар навыков',
    description: 'Отслеживайте прогресс по аналитике, маркетингу, контенту, операциям и финансам',
    icon: '📊',
    color: 'blue' as const,
  },
];

const steps = [
  { step: '1', title: 'Пройдите диагностику', description: '15-20 вопросов для оценки текущего уровня' },
  { step: '2', title: 'Получите трек', description: 'Персонализированный план обучения' },
  { step: '3', title: 'Учитесь эффективно', description: 'Видеоуроки с AI-поддержкой' },
];

const stats = [
  { value: '5', label: 'направлений навыков' },
  { value: '50+', label: 'видеоуроков' },
  { value: '24/7', label: 'AI-поддержка' },
];

const cardVariants = {
  blue: 'soft-blue',
  green: 'soft-green',
  pink: 'soft-pink',
} as const;

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-mp-gray-50">
      {/* Header */}
      <header className="border-b border-mp-gray-200 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="md" />
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Войти</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Начать бесплатно</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 bg-mp-hero-gradient">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="featured" className="mb-6">
              Новый подход к обучению
            </Badge>
            <h1 className="text-display-sm md:text-display text-mp-gray-900 mb-6">
              Учитесь продавать на маркетплейсах{' '}
              <span className="text-mp-blue-500">эффективно</span>
            </h1>
            <p className="text-body-lg text-mp-gray-600 mb-8 max-w-2xl mx-auto">
              AI-платформа определит ваш уровень и построит персональный трек обучения.
              Не тратьте время на то, что уже знаете.
            </p>

            {/* Stats row */}
            <div className="flex justify-center gap-8 md:gap-12 mb-10">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-heading-xl text-mp-blue-600 font-bold">{stat.value}</div>
                  <div className="text-body-sm text-mp-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/register">
                <Button size="lg" className="text-body-lg px-8 shadow-mp-md hover:shadow-mp-lg transition-shadow">
                  Начать диагностику
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-body-lg px-8">
                  Узнать больше
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="analytics" className="mb-4">Возможности</Badge>
            <h2 className="text-display-sm text-mp-gray-900">
              Почему MPSTATS Academy?
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                variant={cardVariants[feature.color]}
                className="text-center hover:shadow-mp-card-hover transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="text-4xl mb-3">{feature.icon}</div>
                  <CardTitle className="text-heading">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-body-sm">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-mp-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="content" className="mb-4">Процесс</Badge>
            <h2 className="text-display-sm text-mp-gray-900">
              Как это работает
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((item, index) => (
              <div key={item.step} className="text-center relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-mp-blue-200" />
                )}
                <div className="w-12 h-12 rounded-full bg-mp-blue-500 text-white text-heading font-bold flex items-center justify-center mx-auto mb-4 relative z-10 shadow-mp">
                  {item.step}
                </div>
                <h3 className="font-semibold text-heading-sm text-mp-gray-900 mb-2">{item.title}</h3>
                <p className="text-body-sm text-mp-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-mp-blue-500 to-mp-blue-700 text-white">
        <div className="container mx-auto px-4 text-center">
          <LogoMark size="xl" variant="white" href={undefined} className="mx-auto mb-6" />
          <h2 className="text-display-sm mb-4">
            Готовы начать?
          </h2>
          <p className="text-body-lg text-mp-blue-100 mb-8">
            Регистрация занимает меньше минуты
          </p>
          <Link href="/register">
            <Button size="lg" variant="success" className="text-body-lg px-8 shadow-mp-lg">
              Создать аккаунт
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-mp-gray-900 text-mp-gray-400">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" variant="white" />
            <p className="text-body-sm">&copy; 2025 MPSTATS Academy. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
