import { describe, it, expect } from 'vitest';

import {
  resolveIncludeHidden,
  canToggleHidden,
} from '../../../../packages/api/src/utils/visibility';

describe('resolveIncludeHidden', () => {
  it('ADMIN never sees hidden content even if they ask for it', () => {
    expect(resolveIncludeHidden('ADMIN', true)).toBe(false);
    expect(resolveIncludeHidden('ADMIN', false)).toBe(false);
    expect(resolveIncludeHidden('ADMIN', undefined)).toBe(false);
  });

  it('SUPERADMIN defaults to seeing hidden content', () => {
    expect(resolveIncludeHidden('SUPERADMIN', undefined)).toBe(true);
  });

  it('SUPERADMIN can opt-out of seeing hidden content', () => {
    expect(resolveIncludeHidden('SUPERADMIN', false)).toBe(false);
  });

  it('SUPERADMIN explicit true keeps hidden content visible', () => {
    expect(resolveIncludeHidden('SUPERADMIN', true)).toBe(true);
  });
});

describe('canToggleHidden', () => {
  it('ADMIN can hide but cannot unhide', () => {
    expect(canToggleHidden('ADMIN', true)).toBe(true);
    expect(canToggleHidden('ADMIN', false)).toBe(false);
  });

  it('SUPERADMIN can both hide and unhide', () => {
    expect(canToggleHidden('SUPERADMIN', true)).toBe(true);
    expect(canToggleHidden('SUPERADMIN', false)).toBe(true);
  });
});
