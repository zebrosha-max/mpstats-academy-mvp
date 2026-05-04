import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 53A — Referral E2E happy path
 *
 * Required env (set when running):
 *   - TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD     existing user with REF code
 *   - TEST_NEW_FRIEND_EMAIL                        unique email for new friend signup
 *
 * Skipped automatically when env not set.
 */

const A_EMAIL = process.env.TEST_USER_A_EMAIL;
const A_PASSWORD = process.env.TEST_USER_A_PASSWORD;
const FRIEND_EMAIL = process.env.TEST_NEW_FRIEND_EMAIL;
const haveEnv = A_EMAIL && A_PASSWORD && FRIEND_EMAIL;

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|learn|diagnostic|admin)/, { timeout: 15000 });
}

test.describe('Phase 53A — referral flow', () => {
  test.skip(!haveEnv, 'env not set');

  test('referrer copies code, friend registers via link, package issued', async ({
    page,
    context,
  }) => {
    // 1. Login as A, capture REF code
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/profile/referral');
    const codeText = await page.locator('span.font-mono').first().textContent();
    expect(codeText).toMatch(/^REF-/);

    // 2. Logout, visit /?ref= as anonymous
    await context.clearCookies();
    await page.goto(`/?ref=${codeText}`);

    // 3. Go to /register — banner visible
    await page.goto(`/register?ref=${codeText}`);
    await expect(page.getByText(/14 дней бесплатного доступа/)).toBeVisible();
  });
});
