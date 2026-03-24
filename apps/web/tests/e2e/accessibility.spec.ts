import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = 'tester@mpstats.academy';
const TEST_PASSWORD = 'TestUser2024';

// Pages to audit (public)
const publicPages = ['/', '/login', '/register', '/pricing'];

// Pages to audit (protected — need auth)
const protectedPages = ['/dashboard', '/diagnostic', '/learn', '/profile'];

test.describe('Accessibility Audit — Public Pages', () => {
  for (const pagePath of publicPages) {
    test(`${pagePath} should have no critical a11y violations`, async ({ page }) => {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast']) // color contrast can be noisy, check separately
        .analyze();

      const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      if (critical.length > 0) {
        const summary = critical.map(v =>
          `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`
        ).join('\n');
        console.log(`A11y issues on ${pagePath}:\n${summary}`);
      }
      expect(critical).toHaveLength(0);
    });
  }
});

test.describe('Accessibility Audit — Protected Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });
  });

  for (const pagePath of protectedPages) {
    test(`${pagePath} should have no critical a11y violations`, async ({ page }) => {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze();

      const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
      if (critical.length > 0) {
        const summary = critical.map(v =>
          `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`
        ).join('\n');
        console.log(`A11y issues on ${pagePath}:\n${summary}`);
      }
      expect(critical).toHaveLength(0);
    });
  }
});
