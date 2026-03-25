import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | MPSTATS Academy',
    default: 'Правовая информация | MPSTATS Academy',
  },
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
