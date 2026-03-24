import { test, expect } from '@playwright/test';

const protectedRoutes = ['/dashboard', '/diagnostic', '/learn', '/profile', '/admin'];

test.describe('Protected Routes', () => {
  for (const route of protectedRoutes) {
    test(`${route} should redirect to /login when not authenticated`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/login/);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('/login should be accessible without auth', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: /Вход/i })).toBeVisible();
  });

  test('/register should be accessible without auth', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: /Создать аккаунт/i })).toBeVisible();
  });
});
