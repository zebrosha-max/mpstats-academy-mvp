'use client';

import { useState } from 'react';
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
  const avatarUrl = user.user_metadata?.avatar_url;
  const [imgError, setImgError] = useState(false);

  const showFallback = !avatarUrl || imgError;

  return (
    <div className="flex items-center gap-3">
      <Link href="/profile">
        <div className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          {!showFallback && (
            <img
              src={avatarUrl}
              alt={name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-mp-gray-100"
              onError={() => setImgError(true)}
            />
          )}
          {showFallback && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mp-blue-500 to-mp-blue-600 text-white flex items-center justify-center text-body-sm font-semibold shadow-mp-sm">
              {initials}
            </div>
          )}
          <span className="text-body-sm font-medium text-mp-gray-700 hidden md:block">{name}</span>
        </div>
      </Link>
      <form action={signOut}>
        <Button variant="ghost" size="sm" type="submit" className="text-mp-gray-500 hover:text-mp-gray-700">
          Выйти
        </Button>
      </form>
    </div>
  );
}
