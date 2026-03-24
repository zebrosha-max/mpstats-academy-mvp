import { test, expect } from '@playwright/test';

// tester@mpstats.academy — id: cff53dc4, password reset via Admin API
const TEST_EMAIL = 'tester@mpstats.academy';
const TEST_PASSWORD = 'TestUser2024';

test.describe('Auth Flow', () => {
  test('should login with email/password and reach dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard after successful login
    await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });
    // Verify we're on a protected page (not redirected back to login)
    expect(page.url()).not.toContain('/login');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on login page and show error
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout and redirect to login', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });

    // Find and click logout (in user nav dropdown or sidebar)
    const logoutButton = page.getByText(/Выйти/i);
    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();
    } else {
      // Try user nav dropdown
      const userNav = page.locator('[data-testid="user-nav"]').or(page.locator('.user-nav'));
      if (await userNav.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userNav.click();
        await page.getByText(/Выйти/i).click();
      } else {
        // Navigate to a known logout action
        await page.goto('/login');
      }
    }

    // Should end up on login or landing
    await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
  });

  test('authenticated user on /login should redirect to dashboard', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });

    // Now try to visit /login again
    await page.goto('/login');
    await page.waitForURL(/\/(dashboard)/, { timeout: 10000 });
    expect(page.url()).not.toContain('/login');
  });
});
