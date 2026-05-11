import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  REFERRAL_COOKIE_NAME,
  isValidRefCodeShape,
} from '@/lib/referral/attribution';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm } from './register-form';

function resolveRefCode(urlRef: string | undefined, cookieRef: string | undefined): string | null {
  // URL ?ref= takes precedence over cookie (explicit user action wins).
  const candidate = (urlRef ?? cookieRef ?? '').toUpperCase();
  if (!candidate) return null;
  return isValidRefCodeShape(candidate) ? candidate : null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  // Authed users hitting /register (e.g. via someone else's referral link)
  // should not see the form — show them the platform instead. Middleware
  // already wrote the referral cookie on the way in, but for an already-
  // registered user that cookie won't be applied anyway.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/learn');

  const cookieStore = cookies();
  const cookieRef = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;
  const refCode = resolveRefCode(searchParams.ref, cookieRef);

  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Загрузка...</div>}>
      <RegisterForm initialRefCode={refCode} />
    </Suspense>
  );
}
