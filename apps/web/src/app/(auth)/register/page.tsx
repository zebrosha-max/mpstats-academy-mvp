import { Suspense } from 'react';
import { cookies } from 'next/headers';
import {
  REFERRAL_COOKIE_NAME,
  isValidRefCodeShape,
} from '@/lib/referral/attribution';
import { RegisterForm } from './register-form';

function resolveRefCode(urlRef: string | undefined, cookieRef: string | undefined): string | null {
  // URL ?ref= takes precedence over cookie (explicit user action wins).
  const candidate = (urlRef ?? cookieRef ?? '').toUpperCase();
  if (!candidate) return null;
  return isValidRefCodeShape(candidate) ? candidate : null;
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const cookieStore = cookies();
  const cookieRef = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;
  const refCode = resolveRefCode(searchParams.ref, cookieRef);

  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Загрузка...</div>}>
      <RegisterForm initialRefCode={refCode} />
    </Suspense>
  );
}
