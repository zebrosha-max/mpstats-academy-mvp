'use client';

import { createContext, useContext, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
  const hasAutoStartedRef = useRef<Set<TourPage>>(new Set());

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
      onDestroyed: () => {
        localStorage.setItem(key, 'true');
      },
    });

    driverObj.drive();
  }, []);

  useEffect(() => {
    const page = getTourForPage(pathname);
    if (!page) return;

    // Guard: already auto-started this page in current session
    if (hasAutoStartedRef.current.has(page)) return;

    const key = getLocalStorageKey(page);
    if (localStorage.getItem(key) === 'true') return;

    const isMobile = !window.matchMedia('(min-width: 768px)').matches;
    const steps = getSteps(page, isMobile);

    const timer = setTimeout(() => {
      // Re-check guards inside callback (state may have changed during 1.5s delay)
      if (hasAutoStartedRef.current.has(page)) return;
      if (localStorage.getItem(key) === 'true') return;

      // Check if enough tour targets exist in DOM (skip if page hasn't loaded full UI,
      // e.g. diagnostic not completed → learn page shows CTA instead of track sections)
      const targetsFound = steps.filter(
        (s) => s.element && document.querySelector(s.element as string)
      ).length;
      const threshold = Math.ceil(steps.length * 0.5);
      if (targetsFound < threshold) return;

      hasAutoStartedRef.current.add(page);

      const driverObj = driver({
        showProgress: true,
        steps,
        progressText: tourConfig.progressText,
        nextBtnText: tourConfig.nextBtnText,
        prevBtnText: tourConfig.prevBtnText,
        doneBtnText: tourConfig.doneBtnText,
        allowClose: true,
        onDestroyed: () => {
          localStorage.setItem(key, 'true');
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
