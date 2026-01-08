import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display the landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /MPSTATS Academy/i })).toBeVisible();
  });

  test('should have login and register links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Войти/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Регистрация/i })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Войти');
    await expect(page).toHaveURL('/login');
  });
});
