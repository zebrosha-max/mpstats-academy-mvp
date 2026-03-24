import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'tester@mpstats.academy';
const TEST_PASSWORD = 'TestUser2024';

test.describe('Learning Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });
  });

  test('should display course list on /learn', async ({ page }) => {
    await page.goto('/learn');
    // Wait for courses to load
    await expect(page.getByText(/Все курсы/i).first()).toBeVisible({ timeout: 15000 });
    // At least one course card should be visible
    const courseCards = page.locator('[class*="CardTitle"], h3').filter({ hasText: /.{5,}/ });
    await expect(courseCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should open a lesson page', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.getByText(/Все курсы/i).first()).toBeVisible({ timeout: 15000 });

    // Click first lesson link
    const lessonLink = page.locator('a[href*="/learn/"]').first();
    await expect(lessonLink).toBeVisible({ timeout: 10000 });
    await lessonLink.click();

    // Should navigate to lesson page
    await page.waitForURL(/\/learn\/[^/]+$/, { timeout: 15000 });
  });

  test('should show video player on lesson page', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.getByText(/Все курсы/i).first()).toBeVisible({ timeout: 15000 });

    const lessonLink = page.locator('a[href*="/learn/"]').first();
    await lessonLink.click();
    await page.waitForURL(/\/learn\/[^/]+$/, { timeout: 15000 });

    // Kinescope iframe should be present
    await expect(
      page.locator('iframe[src*="kinescope"]').or(page.locator('[class*="aspect-video"]'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should show AI summary tab on lesson page', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/learn');
    await expect(page.getByText(/Все курсы/i).first()).toBeVisible({ timeout: 15000 });

    const lessonLink = page.locator('a[href*="/learn/"]').first();
    await lessonLink.click();
    await page.waitForURL(/\/learn\/[^/]+$/, { timeout: 15000 });

    // Look for AI summary section/tab
    const summaryTab = page.getByText(/Конспект|Summary|Краткое содержание|AI/i).first();
    if (await summaryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await summaryTab.click();
    }

    // Summary content should appear (prose markdown block)
    await expect(
      page.locator('[class*="prose"]').first()
    ).toBeVisible({ timeout: 60000 });
  });
});
