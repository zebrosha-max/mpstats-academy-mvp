/**
 * REF-* code generation (Phase 53A).
 *
 * Format: REF- + 6 chars from safe alphabet (excludes I, L, O, 0, 1
 * for visual readability — copy-paste resilience).
 *
 * Address space: 30^6 ≈ 730M combinations.
 * At 100K users: ~0.013% collision probability per generation. 5 retries
 * make practical collision unreachable.
 */

import { prisma } from '@mpstats/db/client';

export const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateRefCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    chars.push(REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]);
  }
  return `REF-${chars.join('')}`;
}

export async function generateUniqueRefCode(maxRetries = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateRefCode();
    const exists = await prisma.userProfile.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error(`Could not generate unique ref code after ${maxRetries} retries`);
}
