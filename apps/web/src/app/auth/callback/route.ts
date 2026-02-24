import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  console.log('[Auth Callback] ANON_KEY last 10 chars:', anonKey.slice(-10));
  console.log('[Auth Callback] ANON_KEY length:', anonKey.length);
  console.log('[Auth Callback] code:', code ? 'present' : 'missing');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log('[Auth Callback] exchangeCodeForSession result:');
    console.log('[Auth Callback] - data:', data?.user?.email ?? 'no user');
    console.log('[Auth Callback] - error:', error?.message ?? 'no error');

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=auth_callback_error', requestUrl.origin)
  );
}
