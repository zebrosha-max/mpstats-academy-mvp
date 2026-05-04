import { describe, expect, it, vi } from 'vitest';
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_TTL_DAYS,
  parseRefCodeFromUrl,
  isValidRefCodeShape,
} from '../attribution';

describe('parseRefCodeFromUrl', () => {
  it('extracts code from ?ref= param', () => {
    const url = new URL('https://platform.mpstats.academy/?ref=REF-X7K2P1');
    expect(parseRefCodeFromUrl(url)).toBe('REF-X7K2P1');
  });

  it('returns null when ?ref= absent', () => {
    const url = new URL('https://platform.mpstats.academy/');
    expect(parseRefCodeFromUrl(url)).toBeNull();
  });

  it('uppercases lowercase ref code', () => {
    const url = new URL('https://platform.mpstats.academy/?ref=ref-x7k2p1');
    expect(parseRefCodeFromUrl(url)).toBe('REF-X7K2P1');
  });

  it('rejects malformed codes (returns null)', () => {
    const url = new URL('https://platform.mpstats.academy/?ref=garbage123');
    expect(parseRefCodeFromUrl(url)).toBeNull();
  });
});

describe('isValidRefCodeShape', () => {
  it('accepts REF-XXXXXX format', () => {
    expect(isValidRefCodeShape('REF-A2B3C4')).toBe(true);
  });

  it('accepts internal codes (CARE-NAME etc)', () => {
    expect(isValidRefCodeShape('CARE-ANNA')).toBe(true);
    expect(isValidRefCodeShape('SALES-TEAM')).toBe(true);
  });

  it('rejects empty', () => {
    expect(isValidRefCodeShape('')).toBe(false);
  });

  it('rejects too long', () => {
    expect(isValidRefCodeShape('REF-' + 'A'.repeat(50))).toBe(false);
  });
});

describe('constants', () => {
  it('cookie TTL is 30 days', () => {
    expect(REFERRAL_COOKIE_TTL_DAYS).toBe(30);
  });

  it('cookie name is referral_code', () => {
    expect(REFERRAL_COOKIE_NAME).toBe('referral_code');
  });
});
