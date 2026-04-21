import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { prisma } from '@mpstats/db/client';
import { sendWelcomeEmail } from '@/lib/carrotquest/emails';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  // Use SITE_URL for redirects — requestUrl.origin returns internal Docker address (0.0.0.0:3000)
  const origin = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Fire pa_registration_completed for first-time email confirmation
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const profile = await prisma.userProfile.findUnique({
            where: { id: user.id },
            select: { lastActiveAt: true, name: true },
          });
          // lastActiveAt === null means first authenticated request ever
          if (profile && profile.lastActiveAt === null) {
            sendWelcomeEmail(user.id, {
              name: profile.name || user.user_metadata?.name || '',
              email: user.email || '',
              phone: user.user_metadata?.phone || '',
            }).catch(err => console.error('[Auth] Welcome email failed:', err));
          }
        }
      } catch (err) {
        console.error('[Auth] Registration completed event error:', err);
      }

      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(
    new URL('/login?error=auth_callback_error', origin)
  );
}
