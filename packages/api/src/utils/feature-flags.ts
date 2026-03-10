import { prisma } from '@mpstats/db';

/**
 * Check if a feature flag is enabled.
 * Returns false if the flag doesn't exist (safe default).
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
  });
  return flag?.enabled ?? false;
}
