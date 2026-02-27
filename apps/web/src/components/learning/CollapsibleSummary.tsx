'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface CollapsibleSummaryProps {
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  maxCollapsedHeight?: number;
}

export function CollapsibleSummary({
  children,
  isLoading = false,
  error = null,
  maxCollapsedHeight = 200,
}: CollapsibleSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure content height to decide if collapse is needed
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const check = () => {
      setNeedsCollapse(el.scrollHeight > maxCollapsedHeight + 20);
    };

    check();

    // Re-check on resize
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxCollapsedHeight, children]);

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center gap-2 text-body-sm text-mp-blue-600">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Генерирую резюме...
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 bg-mp-gray-200 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-body-sm font-medium text-red-700">Ошибка загрузки резюме</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const isCollapsed = needsCollapse && !expanded;

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isCollapsed ? `${maxCollapsedHeight}px` : '5000px',
        }}
      >
        {children}
      </div>

      {/* Gradient fade when collapsed */}
      {isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      )}

      {/* Expand/collapse toggle */}
      {needsCollapse && (
        <div className={isCollapsed ? 'relative -mt-2' : 'mt-2'}>
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            className="text-body-sm text-mp-blue-600 hover:text-mp-blue-700 font-medium transition-colors"
          >
            {expanded ? 'Свернуть' : 'Показать полностью'}
          </button>
        </div>
      )}
    </div>
  );
}
