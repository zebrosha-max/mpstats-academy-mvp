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

  it('normalizes both Wildberries and Ozon transliterations in same sentence', () => {
    expect(fixBrandNames('работа на Валберес и Озон')).toBe('работа на Wildberries и Ozon');
  });

  it('normalizes Kandinsky misheard from transcripts (Канцински)', () => {
    expect(fixBrandNames('используем Канцински для генерации')).toBe('используем Kandinsky для генерации');
    expect(fixBrandNames('Кандинский генерирует')).toBe('Kandinsky генерирует');
  });

  it('normalizes ChatGPT and Midjourney variants', () => {
    expect(fixBrandNames('Чат гпт и Миджорни')).toBe('ChatGPT и Midjourney');
    expect(fixBrandNames('чатжпт')).toBe('ChatGPT');
  });

  it('normalizes MPSTATS variants', () => {
    expect(fixBrandNames('Ампостат — это сервис')).toBe('MPSTATS — это сервис');
    expect(fixBrandNames('мп статс')).toBe('MPSTATS');
  });

  it('does not touch Russian words that just start with Озон-prefix', () => {
    // Озон regex uses negative lookahead for Cyrillic continuation,
    // so genuine Russian words like Озонатор/Озонирование are preserved.
    expect(fixBrandNames('Озонатор воздуха')).toBe('Озонатор воздуха');
    expect(fixBrandNames('Озонирование')).toBe('Озонирование');
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
