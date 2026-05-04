/**
 * Referral attribution — cookie + URL parsing (Phase 53A).
 *
 * Cookie set in middleware on ?ref= visit, read in /auth/confirm and Yandex
 * callback to attribute referral on DOI/OAuth completion.
 */

export const REFERRAL_COOKIE_NAME = 'referral_code';
export const REFERRAL_COOKIE_TTL_DAYS = 30;
export const REFERRAL_COOKIE_TTL_SECONDS = REFERRAL_COOKIE_TTL_DAYS * 24 * 60 * 60;

const SHAPE_REGEX = /^[A-Z][A-Z0-9_]{0,15}-[A-Z0-9]{2,12}$/;

export function isValidRefCodeShape(code: string): boolean {
  if (!code || code.length === 0 || code.length > 32) return false;
  return SHAPE_REGEX.test(code);
}

export function parseRefCodeFromUrl(url: URL): string | null {
  const raw = url.searchParams.get('ref');
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return isValidRefCodeShape(upper) ? upper : null;
}
