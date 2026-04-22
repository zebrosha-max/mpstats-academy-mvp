'use client';

import { useEffect, useRef, useState, CSSProperties } from 'react';

/**
 * Hook: count from 0 to `end` over `duration` ms when element scrolls into view.
 * Uses easeOutCubic.
 */
export function useCountUp(end: number, duration = 1500, delay = 0) {
  const ref = useRef<HTMLElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let raf = 0;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          timer = setTimeout(() => {
            const start = performance.now();
            const tick = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
              setValue(Math.round(end * eased));
              if (progress < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
          }, delay);
          observer.disconnect();
        }
      },
      { threshold: 0.3, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [end, duration, delay]);

  return { ref, value };
}

interface CounterProps {
  end: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  /** Use ru-RU thousands formatting ("3 000"). Default true. */
  format?: boolean;
}

/** Animated number that counts from 0 to `end` when scrolled into view. */
export function Counter({
  end,
  suffix = '',
  prefix = '',
  duration = 1500,
  delay = 0,
  className,
  style,
  format = true,
}: CounterProps) {
  const { ref, value } = useCountUp(end, duration, delay);
  const display = format ? new Intl.NumberFormat('ru-RU').format(value) : String(value);
  return (
    <span ref={ref as never} className={className} style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
