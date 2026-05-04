/**
 * Re-export shim — implementation lives in packages/api/src/services/referral/attribution.ts
 * so the tRPC router (packages/api) can import it without cross-package relative path hacks.
 */
export {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_TTL_DAYS,
  REFERRAL_COOKIE_TTL_SECONDS,
  isValidRefCodeShape,
  parseRefCodeFromUrl,
} from '../../../../../packages/api/src/services/referral/attribution';
