'use client';

import { HelpCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTour } from './TourProvider';
import { getTourForPage } from '@/lib/tours/definitions';

export function HelpCircleButton() {
  const pathname = usePathname();
  const { startTour } = useTour();

  const page = getTourForPage(pathname);
  if (!page) return null;

  return (
    <button
      onClick={() => startTour(page)}
      className="w-10 h-10 rounded-lg flex items-center justify-center text-mp-gray-400 hover:text-mp-blue-500 hover:bg-mp-gray-100 transition-colors duration-200"
      title="Повторить тур"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
}
