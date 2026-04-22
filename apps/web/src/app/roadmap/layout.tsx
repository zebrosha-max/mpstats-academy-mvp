import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Roadmap MPSTATS Academy — что готово и в работе' },
  description: 'Живая платформа, которая растёт и обновляется под изменения WB и Ozon. Что готово, что в работе, что исследуем. Changelog по релизам.',
  alternates: { canonical: '/roadmap' },
  openGraph: {
    title: 'Roadmap MPSTATS Academy — что готово и в работе',
    description: 'Живая платформа, которая растёт и обновляется под изменения WB и Ozon. Что готово, что в работе, что исследуем. Changelog по релизам.',
    url: '/roadmap',
  },
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
