/**
 * Phase 53A backfill: assign REF-* code to every UserProfile that doesn't have one.
 *
 * Idempotent — re-running skips users already with a code.
 *
 * Usage:
 *   npx tsx scripts/backfill-referral-codes.ts --dry-run
 *   npx tsx scripts/backfill-referral-codes.ts --apply
 */

import { PrismaClient } from '@prisma/client';
import { generateRefCode } from '../apps/web/src/lib/referral/code-generator';

const prisma = new PrismaClient();

/** Generate a code not already present in the existing codes set. */
async function generateUniqueCode(existingCodes: Set<string>): Promise<string> {
  const MAX_RETRIES = 10;
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateRefCode();
    if (!existingCodes.has(code)) {
      existingCodes.add(code);
      return code;
    }
  }
  throw new Error(`Could not generate unique ref code after ${MAX_RETRIES} retries`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');

  if (!dryRun && !apply) {
    console.error('Usage: --dry-run or --apply');
    process.exit(1);
  }

  const users = await prisma.userProfile.findMany({
    where: { referralCode: null },
    select: { id: true, name: true },
  });

  console.log(`Found ${users.length} users without referralCode.`);

  if (dryRun) {
    console.log('[DRY RUN] Would assign codes to:');
    for (const u of users.slice(0, 10)) {
      console.log(`  - ${u.id} (${u.name ?? '<no name>'})`);
    }
    if (users.length > 10) console.log(`  ... and ${users.length - 10} more`);
    return;
  }

  // Pre-load existing codes to avoid DB round-trips for uniqueness checks.
  const existingRows = await prisma.userProfile.findMany({
    where: { referralCode: { not: null } },
    select: { referralCode: true },
  });
  const existingCodes = new Set(existingRows.map((r) => r.referralCode as string));

  let assigned = 0;
  for (const user of users) {
    try {
      const code = await generateUniqueCode(existingCodes);
      await prisma.userProfile.update({
        where: { id: user.id },
        data: { referralCode: code },
      });
      assigned++;
      if (assigned % 25 === 0) {
        console.log(`Assigned ${assigned}/${users.length}...`);
      }
    } catch (err) {
      console.error(`Failed for user ${user.id}:`, err);
    }
  }
  console.log(`Done. Assigned ${assigned} codes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
