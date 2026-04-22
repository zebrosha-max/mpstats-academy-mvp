'use client';

import { useRef, useEffect, useState, CSSProperties, ReactNode } from 'react';

/**
 * Hook: returns { ref, visible, style }. Attach ref and spread style on any element.
 * When hidden: opacity 0 + translateY(distance). When visible: runs `v8-fade-up` keyframes
 * animation so that after completion there is NO inline transform — allowing CSS :hover
 * transforms (e.g. Tailwind `hover:-translate-y-1`) to apply cleanly.
 */
export function useReveal<T extends HTMLElement>(delay = 0, distance = 20) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  // Once animation finishes, clear inline style so CSS :hover transforms apply cleanly.
  useEffect(() => {
    if (!visible || done) return;
    const timer = setTimeout(() => setDone(true), delay + 650);
    return () => clearTimeout(timer);
  }, [visible, done, delay]);

  const style: CSSProperties = done
    ? {}
    : visible
      ? { animation: `v8-fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both` }
      : { opacity: 0, transform: `translateY(${distance}px)` };

  return { ref, visible, style };
}

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  distance?: number;
  as?: 'div' | 'section' | 'article' | 'header' | 'footer';
}

/** Drop-in div replacement with fade-up on scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className = '',
  style: userStyle,
  distance = 20,
  as: Tag = 'div',
}: RevealProps) {
  const { ref, style: revealStyle } = useReveal<HTMLDivElement>(delay, distance);
  return (
    <Tag ref={ref as never} className={className} style={{ ...userStyle, ...revealStyle }}>
      {children}
    </Tag>
  );
}
