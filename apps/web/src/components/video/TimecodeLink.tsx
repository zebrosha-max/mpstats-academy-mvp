'use client';

import { cn } from '@/lib/utils';

interface TimecodeLinkProps {
  startSeconds: number;
  formattedTime: string;
  onSeek: (seconds: number) => void;
  disabled?: boolean;
}

export function TimecodeLink({
  startSeconds,
  formattedTime,
  onSeek,
  disabled = false,
}: TimecodeLinkProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onSeek(startSeconds);
      }}
      disabled={disabled}
      className={cn(
        'text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1 transition-colors',
        disabled
          ? 'text-mp-gray-400 bg-mp-gray-100 cursor-not-allowed'
          : 'text-mp-blue-600 bg-mp-blue-50 hover:bg-mp-blue-100 cursor-pointer'
      )}
    >
      {/* Play icon */}
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M4 2.5v7l5.5-3.5L4 2.5z" />
      </svg>
      {formattedTime}
    </button>
  );
}
