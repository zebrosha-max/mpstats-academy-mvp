'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
type EntityKind = 'lesson' | 'course';

interface HideConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: EntityKind;
  title: string;
  action: 'hide' | 'unhide';
  currentUserRole: Role;
  onConfirm: () => void;
  isPending?: boolean;
}

const ENTITY_LABELS: Record<EntityKind, { nom: string; acc: string }> = {
  lesson: { nom: 'урок', acc: 'урок' },
  course: { nom: 'курс', acc: 'курс' },
};

export function HideConfirmDialog({
  open,
  onOpenChange,
  kind,
  title,
  action,
  currentUserRole,
  onConfirm,
  isPending = false,
}: HideConfirmDialogProps) {
  const labels = ENTITY_LABELS[kind];
  const isHide = action === 'hide';
  const isAdminOnly = currentUserRole === 'ADMIN';

  let header: string;
  let description: string;
  let confirmText: string;

  if (isHide) {
    header = `Скрыть ${labels.acc}?`;
    description = isAdminOnly
      ? `«${title}» перестанет отображаться на платформе. После скрытия вы не сможете вернуть ${labels.acc} самостоятельно — обратитесь к суперадмину при ошибке.`
      : `«${title}» перестанет отображаться на платформе. Вы сможете вернуть ${labels.acc} в любой момент.`;
    confirmText = 'Скрыть';
  } else {
    header = `Вернуть ${labels.acc} на платформу?`;
    description = `«${title}» снова будет доступен пользователям.`;
    confirmText = 'Вернуть';
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{header}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // keep dialog open during mutation
              onConfirm();
            }}
            disabled={isPending}
            className={cn(
              isHide &&
                buttonVariants({ variant: 'default' }) +
                  ' bg-red-600 hover:bg-red-700 text-white',
            )}
          >
            {isPending ? '...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
