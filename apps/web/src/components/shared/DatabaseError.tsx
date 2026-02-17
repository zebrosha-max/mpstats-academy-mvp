'use client';

interface DatabaseErrorProps {
  error: { message: string } | null;
  className?: string;
}

export function DatabaseError({ error, className }: DatabaseErrorProps) {
  if (!error) return null;

  const isSupabasePaused = error.message?.includes('DATABASE_UNAVAILABLE');

  if (isSupabasePaused) {
    return (
      <div className={`rounded-lg border border-amber-200 bg-amber-50 p-6 ${className || ''}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-800">
              База данных приостановлена
            </h3>
            <p className="mt-2 text-amber-700">
              Supabase Free Tier приостанавливает проект после 7 дней неактивности.
            </p>
            <p className="mt-1 text-sm text-amber-600">
              Администратору нужно восстановить проект через{' '}
              <span className="font-medium">Supabase Dashboard &rarr; Restore project</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 p-6 ${className || ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-800">
            Ошибка подключения к базе данных
          </h3>
          <p className="mt-2 text-red-700">
            Не удалось загрузить данные. Попробуйте обновить страницу.
          </p>
        </div>
      </div>
    </div>
  );
}
