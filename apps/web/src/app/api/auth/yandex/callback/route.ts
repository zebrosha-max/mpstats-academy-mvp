import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { YandexProvider } from '@/lib/auth/oauth-providers';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    // 1. Validate code parameter
    if (!code) {
      return NextResponse.redirect(new URL('/login?error=missing_code', siteUrl));
    }

    // 2. CSRF state verification
    const cookieStore = await cookies();
    const storedState = cookieStore.get('yandex_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(new URL('/login?error=invalid_state', siteUrl));
    }

    // 3. Delete state cookie (one-time use)
    cookieStore.delete('yandex_oauth_state');

    // 4. Exchange code for access token
    const provider = new YandexProvider();
    const { accessToken } = await provider.exchangeCode(code);

    // 5. Fetch user info from Yandex
    const userInfo = await provider.getUserInfo(accessToken);

    // 6. Find or create Supabase user
    const admin = getSupabaseAdmin();

    const { data: listData } = await admin.auth.admin.listUsers();
    const existingUser = listData?.users?.find(
      (u) => u.email === userInfo.email
    );

    let supabaseUser;

    if (existingUser) {
      supabaseUser = existingUser;
    } else {
      const { data: createData, error: createError } =
        await admin.auth.admin.createUser({
          email: userInfo.email,
          email_confirm: true,
          user_metadata: {
            full_name: userInfo.name,
            yandex_id: userInfo.id,
          },
        });

      if (createError || !createData.user) {
        console.error('Failed to create user:', createError);
        Sentry.captureException(createError ?? new Error('createUser returned no user'), {
          tags: { route: 'yandex-callback', stage: 'create-user' },
        });
        return NextResponse.redirect(
          new URL('/login?error=auth_callback_error', siteUrl)
        );
      }

      supabaseUser = createData.user;
    }

    // 7. Generate Supabase session via magiclink trick
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: supabaseUser.email!,
      });

    if (linkError || !linkData) {
      console.error('Failed to generate link:', linkError);
      Sentry.captureException(linkError ?? new Error('generateLink returned no data'), {
        tags: { route: 'yandex-callback', stage: 'generate-link' },
      });
      return NextResponse.redirect(
        new URL('/login?error=auth_callback_error', siteUrl)
      );
    }

    // 8. Verify OTP to get session tokens
    const { data: otpData, error: otpError } = await admin.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (otpError || !otpData.session) {
      console.error('Failed to verify OTP:', otpError);
      Sentry.captureException(otpError ?? new Error('verifyOtp returned no session'), {
        tags: { route: 'yandex-callback', stage: 'verify-otp' },
      });
      return NextResponse.redirect(
        new URL('/login?error=auth_callback_error', siteUrl)
      );
    }

    // 9. Update UserProfile.yandexId via Prisma upsert (handles race with trigger)
    try {
      await prisma.userProfile.upsert({
        where: { id: supabaseUser.id },
        update: { yandexId: userInfo.id },
        create: {
          id: supabaseUser.id,
          name: userInfo.name,
          yandexId: userInfo.id,
        },
      });
    } catch (prismaError) {
      // Non-fatal: yandexId binding failed but session is valid
      console.error('Failed to update yandexId:', prismaError);
    }

    // 10. Create redirect response and set session cookies
    const response = NextResponse.redirect(new URL('/dashboard', siteUrl));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll(
            cookiesToSet: {
              name: string;
              value: string;
              options: Record<string, unknown>;
            }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as Record<string, unknown>);
            });
          },
        },
      }
    );

    await supabase.auth.setSession({
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
    });

    return response;
  } catch (error) {
    console.error('Yandex OAuth callback error:', error);
    Sentry.captureException(error, {
      tags: { route: 'yandex-callback', stage: 'unhandled' },
    });
    return NextResponse.redirect(
      new URL('/login?error=auth_callback_error', siteUrl)
    );
  }
}
