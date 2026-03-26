'use client';

import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '@/styles/tour.css';
import {
  type TourPage,
  getTourForPage,
  getLocalStorageKey,
  getSteps,
  tourConfig,
} from '@/lib/tours/definitions';

interface TourContextValue {
  startTour: (page: TourPage) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const startTour = useCallback((page: TourPage) => {
    const isMobile = !window.matchMedia('(min-width: 768px)').matches;
    const key = getLocalStorageKey(page);
    const steps = getSteps(page, isMobile);

    const driverObj = driver({
      showProgress: true,
      steps,
      progressText: tourConfig.progressText,
      nextBtnText: tourConfig.nextBtnText,
      prevBtnText: tourConfig.prevBtnText,
      doneBtnText: tourConfig.doneBtnText,
      allowClose: true,
      overlayClickBehavior: 'none',
      onDestroyStarted: () => {
        localStorage.setItem(key, 'true');
        driverObj.destroy();
      },
    });

    driverObj.drive();
  }, []);

  useEffect(() => {
    const page = getTourForPage(pathname);
    if (!page) return;

    const key = getLocalStorageKey(page);
    if (localStorage.getItem(key) === 'true') return;

    const isMobile = !window.matchMedia('(min-width: 768px)').matches;
    const steps = getSteps(page, isMobile);

    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        steps,
        progressText: tourConfig.progressText,
        nextBtnText: tourConfig.nextBtnText,
        prevBtnText: tourConfig.prevBtnText,
        doneBtnText: tourConfig.doneBtnText,
        allowClose: true,
        overlayClickBehavior: 'none',
        onDestroyStarted: () => {
          localStorage.setItem(key, 'true');
          driverObj.destroy();
        },
      });

      driverObj.drive();
    }, 1500);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
    </TourContext.Provider>
  );
}
