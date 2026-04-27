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
import { trpc } from '@/lib/trpc/client';

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

  // Source of truth: per-user `toursCompleted` from DB.
  // localStorage is kept as a per-device cache that prevents a tour flash
  // before the profile query resolves on the very first render.
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const markCompleted = trpc.profile.markTourCompleted.useMutation({
    onSuccess: () => {
      void utils.profile.get.invalidate();
    },
  });

  const isCompleted = useCallback(
    (page: TourPage): boolean => {
      const dbCompleted = profile?.toursCompleted?.includes(page) ?? false;
      const cacheCompleted =
        typeof window !== 'undefined' &&
        localStorage.getItem(getLocalStorageKey(page)) === 'true';
      return dbCompleted || cacheCompleted;
    },
    [profile]
  );

  const persistCompleted = useCallback(
    (page: TourPage) => {
      try {
        localStorage.setItem(getLocalStorageKey(page), 'true');
      } catch {
        // ignore quota/private mode errors
      }
      markCompleted.mutate({ page });
    },
    [markCompleted]
  );

  const startTour = useCallback(
    (page: TourPage) => {
      const isMobile = !window.matchMedia('(min-width: 768px)').matches;
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
          persistCompleted(page);
        },
      });

      driverObj.drive();
    },
    [persistCompleted]
  );

  useEffect(() => {
    const page = getTourForPage(pathname);
    if (!page) return;

    // Wait for profile query to resolve — without this we may flash a tour
    // for a user who already completed it on a different device.
    if (profile === undefined) return;

    if (hasAutoStartedRef.current.has(page)) return;
    if (isCompleted(page)) return;

    const isMobile = !window.matchMedia('(min-width: 768px)').matches;
    const steps = getSteps(page, isMobile);

    const timer = setTimeout(() => {
      // Re-check guards inside callback (state may have changed during 1.5s delay)
      if (hasAutoStartedRef.current.has(page)) return;
      if (isCompleted(page)) return;

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
          persistCompleted(page);
        },
      });

      driverObj.drive();
    }, 1500);

    return () => clearTimeout(timer);
  }, [pathname, profile, isCompleted, persistCompleted]);

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
    </TourContext.Provider>
  );
}
