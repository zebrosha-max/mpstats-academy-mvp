'use client';

import { trpc } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { NOTIFICATION_TYPE_DESCRIPTIONS, type NotificationTypeName } from '@mpstats/shared';

/**
 * Phase 51 — /profile/notifications
 *
 * Страница настройки in-app + email уведомлений по 7 типам.
 * Email Switch — hard-disabled на этой фазе (Phase 52+ запустит реальную доставку
 * через CQ-шаблоны, тогда disabled снимется per-type).
 *
 * Optimistic update: переключение Switch'а сразу применяется локально (setData),
 * при ошибке — rollback (setData previous), независимо от исхода — invalidate.
 */

type NotifType = NotificationTypeName;

/** Короткие русские названия (D-14 tone «ты»). NOTIFICATION_TYPE_DESCRIPTIONS — длинные подписи (D-16). */
const TYPE_LABELS: Record<NotifType, { label: string; description: string }> = {
  COMMENT_REPLY: {
    label: 'Ответы на комментарии',
    description: NOTIFICATION_TYPE_DESCRIPTIONS.COMMENT_REPLY,
  },
  ADMIN_COMMENT_REPLY: {
    label: 'Ответы методологов',
    description: NOTIFICATION_TYPE_DESCRIPTIONS.ADMIN_COMMENT_REPLY,
  },
  CONTENT_UPDATE: {
    label: 'Новые уроки и материалы',
    description: NOTIFICATION_TYPE_DESCRIPTIONS.CONTENT_UPDATE,
  },
  PROGRESS_NUDGE: {
    label: 'Напоминания о прогрессе',
    description: NOTIFICATION_TYPE_DESCRIPTIONS.PROGRESS_NUDGE,
  },
  INACTIVITY_RETURN: {
    label: 'Возвращение после паузы',
    description: NOTIFICATION_TYPE_DESCRIPTIONS.INACTIVITY_RETURN,
  },
  WEEKLY_DIGEST: {
    label: 'Недельный дайджест',
    description: NOTIFICATION_TYPE_DESCRIPTIONS.WEEKLY_DIGEST,
  },
  BROADCAST: {
    label: 'Анонсы и новости',
    description: NOTIFICATION_TYPE_DESCRIPTIONS.BROADCAST,
  },
};

interface PreferenceRow {
  userId: string;
  type: NotifType;
  inApp: boolean;
  email: boolean;
}

export default function NotificationsPreferencesPage() {
  const utils = trpc.useUtils();
  const { data: prefs, isLoading } = trpc.notifications.getPreferences.useQuery();

  const updatePreference = trpc.notifications.updatePreference.useMutation({
    // Optimistic update — мгновенный UX (D-14 tone «всё под контролем»)
    onMutate: async (variables) => {
      await utils.notifications.getPreferences.cancel();
      const previous = utils.notifications.getPreferences.getData();

      if (previous) {
        const next = previous.map((p: PreferenceRow) =>
          p.type === variables.type
            ? {
                ...p,
                ...(variables.inApp !== undefined && { inApp: variables.inApp }),
                ...(variables.email !== undefined && { email: variables.email }),
              }
            : p,
        );
        utils.notifications.getPreferences.setData(undefined, next);
      }

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback при ошибке
      if (ctx?.previous) {
        utils.notifications.getPreferences.setData(undefined, ctx.previous);
      }
    },
    onSettled: () => {
      utils.notifications.getPreferences.invalidate();
    },
  });

  // Loading skeleton
  if (isLoading || !prefs) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 w-2/3 bg-mp-gray-100 rounded animate-pulse" />
        <Card className="p-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-mp-gray-100 rounded animate-pulse" />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mp-gray-900">
          Настрой, как хочешь получать уведомления.
        </h1>
        <p className="text-sm text-mp-gray-500 mt-1">
          Выбери, какие уведомления показывать и куда отправлять.
        </p>
      </div>

      <Card className="overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-mp-gray-50 text-[11px] uppercase tracking-wide text-mp-gray-500 font-semibold">
          <span>Тип</span>
          <span className="text-center w-16">In-app</span>
          <span className="text-center w-16">Email</span>
        </div>

        <div className="divide-y divide-mp-gray-100">
          {prefs.map((pref: PreferenceRow) => {
            const meta = TYPE_LABELS[pref.type] ?? {
              label: pref.type,
              description: '',
            };

            return (
              <div
                key={pref.type}
                className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 items-center"
              >
                {/* Колонка 1: Title + description */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-mp-gray-900">{meta.label}</p>
                  {meta.description && (
                    <p className="text-xs text-mp-gray-500 mt-0.5">{meta.description}</p>
                  )}
                </div>

                {/* Колонка 2: In-app toggle (живой) */}
                <div className="flex justify-center w-16">
                  <Switch
                    checked={pref.inApp}
                    onCheckedChange={(value) =>
                      updatePreference.mutate({ type: pref.type, inApp: value })
                    }
                    disabled={updatePreference.isPending}
                    aria-label={`В приложении: ${meta.label}`}
                  />
                </div>

                {/* Колонка 3: Email toggle (hard-disabled на Phase 51) */}
                <div className="flex justify-center w-16" title="Скоро">
                  <Switch
                    checked={pref.email}
                    disabled
                    aria-label={`По email: ${meta.label} (скоро)`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-xs text-mp-gray-400">
        Email-уведомления появятся скоро — мы работаем над шаблонами.
      </p>
    </div>
  );
}
