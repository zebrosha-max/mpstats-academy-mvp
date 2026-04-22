import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Курс «Продажи на Ozon» — MPSTATS Academy' },
  description: 'Регистрация, FBO/FBS, продвижение, трафареты, аналитика на Ozon. Чем Ozon отличается от WB и как использовать это в свою пользу.',
  alternates: { canonical: '/courses/ozon' },
  openGraph: {
    title: 'Курс «Продажи на Ozon» — MPSTATS Academy',
    description: 'Регистрация, FBO/FBS, продвижение, трафареты, аналитика на Ozon. Чем Ozon отличается от WB и как использовать это в свою пользу.',
    url: '/courses/ozon',
  },
};

export default function CourseOzonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
