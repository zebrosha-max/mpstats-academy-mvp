'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '1rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            padding: '3rem 2rem',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <svg width="40" height="57" viewBox="0 0 100 143" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M91.5463 37.7559L27.0743 0.534714C24.4536 -0.982506 21.163 0.909093 21.163 3.94353V78.3858C21.163 81.4203 24.4536 83.3119 27.0743 81.7947L91.5463 44.5735C94.167 43.0563 94.167 39.2731 91.5463 37.7559Z" fill="#2C4FF8"/>
                <path d="M98.3041 82.2873L74.994 68.8294C73.7724 68.12 72.2749 68.12 71.0532 68.8294L16.3939 100.395C13.7732 101.913 10.4826 100.021 10.4826 96.9866V38.4653C10.4826 35.5688 8.13783 33.224 5.24131 33.224C2.3448 33.224 0 35.5688 0 38.4653V139.055C0 142.089 3.27089 143.981 5.91125 142.464L98.3238 89.105C100.944 87.5878 100.944 83.8046 98.3238 82.2873H98.3041Z" fill="#2C4FF8"/>
              </svg>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.5rem' }}>
              Критическая ошибка
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
              Произошла серьёзная ошибка приложения. Попробуйте обновить страницу.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => reset()}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Повторить
              </button>
              <a
                href="/"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: '#3366FF',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: 'inline-block',
                }}
              >
                На главную
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
