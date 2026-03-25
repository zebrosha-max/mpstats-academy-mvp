'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-mp-blue-600' : 'bg-gray-300'
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function saveConsent(prefs: CookiePreferences) {
    localStorage.setItem('cookie_consent', JSON.stringify(prefs));
    setVisible(false);
  }

  function acceptAll() {
    saveConsent({ necessary: true, analytics: true, marketing: true, timestamp: Date.now() });
  }

  function savePreferences() {
    saveConsent({ necessary: true, analytics, marketing, timestamp: Date.now() });
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 animate-slide-up">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl shrink-0">&#x1F36A;</div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Мы используем cookies</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Для корректной работы сайта, аналитики и персонализации. Подробнее в{' '}
              <Link href="/legal/cookies" className="text-blue-600 hover:underline">
                политике cookies
              </Link>
              .
            </p>
          </div>
        </div>

        {showSettings && (
          <div className="border-t border-gray-100 pt-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Необходимые</p>
                <p className="text-xs text-gray-400">Авторизация, безопасность</p>
              </div>
              <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Всегда вкл</div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Аналитика</p>
                <p className="text-xs text-gray-400">Яндекс Метрика</p>
              </div>
              <Toggle checked={analytics} onChange={setAnalytics} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Маркетинг</p>
                <p className="text-xs text-gray-400">Carrot Quest</p>
              </div>
              <Toggle checked={marketing} onChange={setMarketing} />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={acceptAll}
            className="flex-1 bg-mp-blue-600 hover:bg-mp-blue-700 text-white text-sm h-9 rounded-lg"
          >
            Принять все
          </Button>
          {!showSettings ? (
            <Button
              variant="outline"
              onClick={() => setShowSettings(true)}
              className="flex-1 text-sm h-9 rounded-lg"
            >
              Настроить
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={savePreferences}
              className="flex-1 text-sm h-9 rounded-lg"
            >
              Сохранить выбор
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
