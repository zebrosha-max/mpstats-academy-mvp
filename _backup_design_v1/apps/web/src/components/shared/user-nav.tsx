'use client';

import Link from 'next/link';
import { signOut } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

interface UserNavProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

export function UserNav({ user }: UserNavProps) {
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Пользователь';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <Link href="/profile">
        <div className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
          <span className="text-sm font-medium hidden md:block">{name}</span>
        </div>
      </Link>
      <form action={signOut}>
        <Button variant="ghost" size="sm" type="submit">
          Выйти
        </Button>
      </form>
    </div>
  );
}
