'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

const PROMO_STORAGE_KEY = 'pending_promo_code';

interface PromoCodeInputProps {
  isAuthenticated: boolean;
  initialCode?: string;
}

export function PromoCodeInput({ isAuthenticated, initialCode }: PromoCodeInputProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(!!initialCode);
  const [code, setCode] = useState(initialCode || '');
  const [error, setError] = useState('');

  // Restore pending promo code from sessionStorage after login redirect
  useEffect(() => {
    if (!initialCode && isAuthenticated) {
      try {
        const stored = sessionStorage.getItem(PROMO_STORAGE_KEY);
        if (stored) {
          setCode(stored);
          setIsOpen(true);
          sessionStorage.removeItem(PROMO_STORAGE_KEY);
        }
      } catch {
        // sessionStorage unavailable
      }
    }
  }, [initialCode, isAuthenticated]);

  const activate = trpc.promo.activate.useMutation({
    onSuccess: (data) => {
      toast.success('Промо-код активирован!', {
        description: `Доступ до ${new Date(data.accessUntil).toLocaleDateString('ru-RU')}`,
      });
      setTimeout(() => router.push('/dashboard'), 1500);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleActivate = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Введите промо-код');
      return;
    }
    setError('');

    if (!isAuthenticated) {
      // Save code for after login, redirect to login
      try {
        sessionStorage.setItem(PROMO_STORAGE_KEY, trimmed);
      } catch {
        // sessionStorage unavailable
      }
      const encoded = encodeURIComponent(trimmed);
      router.push(`/login?redirect=/pricing&promo=${encoded}`);
      return;
    }

    activate.mutate({ code: trimmed });
  };

  return (
    <div className="max-w-md mx-auto text-center">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-body-sm text-mp-blue-600 hover:text-mp-blue-700 hover:underline transition-colors"
        >
          Есть промо-код?
        </button>
      ) : (
        <div className="p-6 rounded-xl border border-mp-gray-200 bg-white shadow-sm space-y-4">
          <p className="text-body-sm font-medium text-mp-gray-700">Введите промо-код</p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError('');
              }}
              placeholder="Введите промо-код"
              className="uppercase"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleActivate();
              }}
              disabled={activate.isPending}
            />
            <Button
              onClick={handleActivate}
              disabled={activate.isPending || !code.trim()}
              className="shrink-0"
            >
              {activate.isPending ? 'Проверка...' : 'Активировать'}
            </Button>
          </div>
          {error && (
            <p className="text-body-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
