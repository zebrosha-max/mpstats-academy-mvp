/**
 * Ensures a UserProfile exists for the given Supabase user.
 *
 * Creates the profile on first call (e.g., after Google OAuth signup),
 * touches updatedAt on subsequent calls. Idempotent — safe to call multiple times.
 */

import type { PrismaClient } from '@mpstats/db';
import type { User } from '@supabase/supabase-js';

export async function ensureUserProfile(prisma: PrismaClient, user: User) {
  return prisma.userProfile.upsert({
    where: { id: user.id },
    update: { updatedAt: new Date() },
    create: {
      id: user.id,
      name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    },
  });
}
