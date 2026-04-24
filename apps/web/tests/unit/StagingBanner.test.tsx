import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StagingBanner } from '@/components/shared/StagingBanner';

describe('StagingBanner', () => {
  const originalEnv = process.env.NEXT_PUBLIC_STAGING;

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_STAGING = originalEnv;
  });

  it('renders banner text when NEXT_PUBLIC_STAGING === "true"', () => {
    process.env.NEXT_PUBLIC_STAGING = 'true';
    const { container, getByText } = render(<StagingBanner />);
    expect(getByText(/STAGING/)).toBeDefined();
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('returns null when NEXT_PUBLIC_STAGING is undefined', () => {
    delete process.env.NEXT_PUBLIC_STAGING;
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when NEXT_PUBLIC_STAGING === "false"', () => {
    process.env.NEXT_PUBLIC_STAGING = 'false';
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when NEXT_PUBLIC_STAGING === "" (empty string)', () => {
    process.env.NEXT_PUBLIC_STAGING = '';
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });
});
