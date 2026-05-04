'use client';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';

interface Package {
  id: string;
  days: number;
  status: string;
  issuedAt: Date | string;
  usedAt: Date | string | null;
}

export function ReferralPackageList({
  pending,
  used,
  isActivating,
  onActivate,
}: {
  pending: Package[];
  used: Package[];
  isActivating: boolean;
  onActivate: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-heading-md font-semibold mb-2">Доступные пакеты</h2>
        {pending.length === 0 ? (
          <div className="text-sm text-mp-gray-500 border border-dashed border-mp-gray-300 rounded-lg p-4">
            Пока ни одного пакета. Поделись ссылкой с друзьями.
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border border-mp-gray-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-mp-blue-500" />
                  <div>
                    <div className="text-sm font-medium">+{p.days} дней доступа</div>
                    <div className="text-xs text-mp-gray-500">
                      Получен {new Date(p.issuedAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onActivate(p.id)}
                  disabled={isActivating}
                >
                  Активировать
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {used.length > 0 && (
        <div>
          <h2 className="text-heading-md font-semibold mb-2">История</h2>
          <ul className="space-y-2">
            {used.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm text-mp-gray-600 border border-mp-gray-100 rounded-lg p-3 bg-mp-gray-50"
              >
                <span>+{p.days} дней — активирован</span>
                <span className="text-xs">
                  {p.usedAt ? new Date(p.usedAt).toLocaleDateString('ru-RU') : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
