'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface SourceData {
  id: string;
  content: string;
  timecodeFormatted: string;
  timecode_start: number;
}

interface SourceTooltipProps {
  index: number;
  source: SourceData;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
}

export function SourceTooltip({ index, source, onSeek, disabled = false }: SourceTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showDelay = 200;

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      // Determine position based on viewport space
      if (badgeRef.current) {
        const rect = badgeRef.current.getBoundingClientRect();
        const spaceAbove = rect.top;
        setPosition(spaceAbove < 120 ? 'below' : 'above');
      }
      setShowTooltip(true);
    }, showDelay);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowTooltip(false);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!disabled) {
      onSeek(source.timecode_start);
      document.getElementById('video-player')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const snippet = source.content.length > 100
    ? source.content.slice(0, 100) + '...'
    : source.content;

  return (
    <span className="relative inline-block">
      <button
        ref={badgeRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        aria-label={`Источник ${index}, ${source.timecodeFormatted}`}
        className={`
          inline-flex items-center justify-center
          w-[18px] h-[18px] rounded-full
          text-[10px] font-semibold leading-none
          align-super -translate-y-0.5
          transition-all duration-150
          ${disabled
            ? 'bg-mp-gray-300 text-mp-gray-500 cursor-not-allowed'
            : 'bg-mp-blue-600 text-white hover:bg-mp-blue-700 cursor-pointer hover:scale-110'
          }
        `}
      >
        {index}
      </button>

      {showTooltip && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-50 w-64 p-2.5 rounded-lg shadow-lg
            bg-mp-gray-900 text-white text-xs
            pointer-events-none
            animate-fade-in
            ${position === 'above'
              ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              : 'top-full mt-2 left-1/2 -translate-x-1/2'
            }
          `}
        >
          {/* Arrow */}
          <div
            className={`
              absolute left-1/2 -translate-x-1/2
              w-0 h-0
              border-x-[6px] border-x-transparent
              ${position === 'above'
                ? 'top-full border-t-[6px] border-t-mp-gray-900'
                : 'bottom-full border-b-[6px] border-b-mp-gray-900'
              }
            `}
          />

          <p className="leading-relaxed text-gray-200 mb-1.5">{snippet}</p>
          <div className="flex items-center gap-1.5 text-mp-blue-300 font-medium">
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4 2.5v7l5.5-3.5L4 2.5z" />
            </svg>
            {source.timecodeFormatted}
          </div>
        </div>
      )}
    </span>
  );
}
