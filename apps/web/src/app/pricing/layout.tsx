import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Тарифы и цены',
  description: 'Выберите тарифный план MPSTATS Academy: подписка на отдельный курс или полный доступ к 400+ видеоурокам.',
  openGraph: {
    title: 'Тарифы и цены | MPSTATS Academy',
    description: 'Подписка на курсы по маркетплейсам: аналитика, маркетинг, контент, финансы.',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
