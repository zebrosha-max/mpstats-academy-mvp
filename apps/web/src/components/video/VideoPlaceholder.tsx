'use client';

export function VideoPlaceholder() {
  return (
    <div className="aspect-video bg-mp-gray-900 rounded-xl flex items-center justify-center">
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-mp-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-mp-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-mp-gray-400 text-sm font-medium mb-1">
          Видео готовится к публикации
        </p>
        <p className="text-mp-gray-500 text-xs">
          AI-панель работает на основе транскрипта урока
        </p>
      </div>
    </div>
  );
}
