import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display the landing page with hero heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Учитесь продавать/i })).toBeVisible();
  });

  test('should have login link and register CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Войти/i })).toBeVisible();
    await expect(page.getByRole('link', { href: '/register' }).first()).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Войти');
    await expect(page).toHaveURL('/login');
  });

  test('should have key sections', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Как это работает/i })).toBeVisible();
    await expect(page.getByText(/Готовы узнать свой уровень/i)).toBeVisible();
    await expect(page.getByText(/MPSTATS Academy/i).first()).toBeVisible();
  });
});
