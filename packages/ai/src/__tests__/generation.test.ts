import { describe, it, expect, vi } from 'vitest';

// Mock server-only (throws in non-server environments)
vi.mock('server-only', () => ({}));

import { fixBrandNames } from '../generation';

describe('fixBrandNames', () => {
  it('replaces "Валберес" with "Wildberries"', () => {
    expect(fixBrandNames('Валберес')).toBe('Wildberries');
  });

  it('replaces "Валбериса" (genitive) with "Wildberries"', () => {
    expect(fixBrandNames('Валбериса')).toBe('Wildberries');
  });

  it('replaces "Валберёсу" (dative) with "Wildberries"', () => {
    expect(fixBrandNames('Валберёсу')).toBe('Wildberries');
  });

  it('replaces "Вайлдберриз" with "Wildberries"', () => {
    expect(fixBrandNames('Вайлдберриз')).toBe('Wildberries');
  });

  it('replaces "Вайлдберис" with "Wildberries"', () => {
    expect(fixBrandNames('Вайлдберис')).toBe('Wildberries');
  });

  it('replaces brand in context but keeps Озон', () => {
    expect(fixBrandNames('работа на Валберес и Озон')).toBe('работа на Wildberries и Озон');
  });

  it('returns unchanged text without brands', () => {
    expect(fixBrandNames('текст без брендов')).toBe('текст без брендов');
  });

  it('handles multiple occurrences in one string', () => {
    expect(fixBrandNames('Валберес и Вайлдберриз — оба маркетплейса')).toBe(
      'Wildberries и Wildberries — оба маркетплейса'
    );
  });

  it('handles case-insensitive matching', () => {
    expect(fixBrandNames('валберес')).toBe('Wildberries');
    expect(fixBrandNames('ВАЙЛДБЕРРИЗ')).toBe('Wildberries');
  });
});
