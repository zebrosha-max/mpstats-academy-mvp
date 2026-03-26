'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

interface UserNavProps {
  user: {
    email?: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

export function UserNav({ user }: UserNavProps) {
  // Use tRPC for live profile data (syncs with sidebar after avatar/name change)
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Prefer tRPC data, fall back to server-passed props
  const name = profile?.name || user.name || user.email?.split('@')[0] || 'Пользователь';
  const initials = name.slice(0, 2).toUpperCase();
  const avatarUrl = profile?.avatarUrl || user.avatarUrl;
  const [imgError, setImgError] = useState(false);

  const showFallback = !avatarUrl || imgError;

  return (
    <div className="flex items-center gap-3">
      <Link href="/profile">
        <div className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          {!showFallback && (
            <img
              src={avatarUrl!}
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
