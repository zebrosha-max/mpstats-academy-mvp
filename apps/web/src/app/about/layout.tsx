import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'О Платформе MPSTATS Academy' },
  description: '3000+ селлеров учились в Академии за 3 года. Команда практиков WB и Ozon. AI-диагностика, персональный план и 400+ уроков по 5 осям навыков.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'О Платформе MPSTATS Academy',
    description: '3000+ селлеров учились в Академии за 3 года. Команда практиков WB и Ozon. AI-диагностика, персональный план и 400+ уроков по 5 осям навыков.',
    url: '/about',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
