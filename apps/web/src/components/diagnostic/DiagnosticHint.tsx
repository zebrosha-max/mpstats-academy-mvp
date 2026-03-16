'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatTimecode } from '@mpstats/shared';

interface DiagnosticHintProps {
  lessonId: string;
  hints: Array<{
    questionText: string;
    timecodes: Array<{ start: number; end: number }>;
  }>;
  onSeek: (seconds: number) => void;
}

export function DiagnosticHint({ lessonId, hints, onSeek }: DiagnosticHintProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Check localStorage for permanent dismissal
  useEffect(() => {
    const key = `hint-dismissed-${lessonId}`;
    if (localStorage.getItem(key) === 'true') {
      setDismissed(true);
    }
  }, [lessonId]);

  if (dismissed || hints.length === 0) return null;

  const handleDismiss = () => {
    localStorage.setItem(`hint-dismissed-${lessonId}`, 'true');
    setDismissed(true);
  };

  const displayedHint = hints[0];

  return (
    <Card className="border-amber-200 bg-amber-50 shadow-sm">
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-body-sm font-medium text-amber-800">Подсказка из диагностики</span>
            </div>
            <p className="text-body-sm text-mp-gray-700 mb-2">{displayedHint.questionText}</p>
            {/* Timecodes */}
            <div className="flex flex-wrap gap-2">
              {displayedHint.timecodes.map((tc, i) => (
                <button
                  key={i}
                  onClick={() => onSeek(tc.start)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  <span>&#9654;</span>
                  <span>{formatTimecode(tc.start)}</span>
                </button>
              ))}
            </div>
            {/* Show more toggle */}
            {hints.length > 1 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="text-caption text-amber-600 hover:text-amber-700 mt-2 underline"
              >
                {`\u0415\u0449\u0451 ${hints.length - 1} \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043E\u043A`}
              </button>
            )}
          </div>
          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="sm"
            className="text-mp-gray-400 hover:text-mp-gray-600 h-auto p-1 flex-shrink-0"
            onClick={handleDismiss}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        {/* Show all hints expanded */}
        {showAll && hints.slice(1).map((hint, i) => (
          <div key={i} className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-body-sm text-mp-gray-700 mb-2">{hint.questionText}</p>
            <div className="flex flex-wrap gap-2">
              {hint.timecodes.map((tc, j) => (
                <button
                  key={j}
                  onClick={() => onSeek(tc.start)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  <span>&#9654;</span>
                  <span>{formatTimecode(tc.start)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
