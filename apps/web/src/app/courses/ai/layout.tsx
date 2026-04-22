import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Курс «Нейросети для селлера» — MPSTATS Academy' },
  description: 'Применение AI на маркетплейсах: карточки, описания, инфографика, SEO, анализ конкурентов. Для селлеров WB и Ozon без технического бэкграунда.',
  alternates: { canonical: '/courses/ai' },
  openGraph: {
    title: 'Курс «Нейросети для селлера» — MPSTATS Academy',
    description: 'Применение AI на маркетплейсах: карточки, описания, инфографика, SEO, анализ конкурентов. Для селлеров WB и Ozon без технического бэкграунда.',
    url: '/courses/ai',
  },
};

export default function CourseAiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
