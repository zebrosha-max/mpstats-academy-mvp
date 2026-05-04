/**
 * Re-export shim — implementation lives in packages/api/src/services/referral/activation.ts
 * so the tRPC router (packages/api) can import it without cross-package relative path hacks.
 */
export {
  activatePackage,
  PackageActivationError,
} from '../../../../../packages/api/src/services/referral/activation';
