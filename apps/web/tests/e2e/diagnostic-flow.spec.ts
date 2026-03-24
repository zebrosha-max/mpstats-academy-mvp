import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'tester@mpstats.academy';
const TEST_PASSWORD = 'TestUser2024';

test.describe('Diagnostic Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });
  });

  test('should show diagnostic intro page', async ({ page }) => {
    await page.goto('/diagnostic');
    await expect(page.getByText(/Начать диагностику/i)).toBeVisible({ timeout: 10000 });
  });

  test('should start session and show first question', async ({ page }) => {
    await page.goto('/diagnostic');
    await page.getByText(/Начать диагностику/i).click();
    await page.waitForURL(/\/diagnostic\/session/, { timeout: 30000 });

    // Wait for question text and answer button to appear
    await expect(page.getByRole('button', { name: /Ответить/i })).toBeVisible({ timeout: 60000 });
  });

  test('should answer a question and see feedback', async ({ page }) => {
    await page.goto('/diagnostic');
    await page.getByText(/Начать диагностику/i).click();
    await page.waitForURL(/\/diagnostic\/session/, { timeout: 30000 });

    // Wait for "Ответить" button (question loaded)
    await expect(page.getByRole('button', { name: /Ответить/i })).toBeVisible({ timeout: 60000 });

    // Click first answer option (the option buttons contain A, B, C, D letters)
    const options = page.locator('button.w-full.p-4.text-left');
    await options.first().click();

    // Click "Ответить"
    await page.getByRole('button', { name: /Ответить/i }).click();

    // Should see feedback (Правильно/Неправильно) and next button
    await expect(
      page.getByText(/Правильно|Неправильно/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /Следующий вопрос|Посмотреть результаты/i })
    ).toBeVisible();
  });

  test('should complete full diagnostic and show radar chart', async ({ page }) => {
    test.setTimeout(300000); // 5 min for AI generation

    await page.goto('/diagnostic');
    await page.getByText(/Начать диагностику/i).click();
    await page.waitForURL(/\/diagnostic\/session/, { timeout: 30000 });

    const maxQuestions = 25;
    for (let i = 0; i < maxQuestions; i++) {
      // Wait for question or results
      const answerBtn = page.getByRole('button', { name: /Ответить/i });
      const resultsBtn = page.getByRole('button', { name: /Посмотреть результаты/i });

      // Check if we're already seeing "Посмотреть результаты"
      if (await resultsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await resultsBtn.click();
        break;
      }

      // Wait for "Ответить" button (question loaded)
      try {
        await answerBtn.waitFor({ state: 'visible', timeout: 60000 });
      } catch {
        // Maybe results appeared instead
        if (await resultsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await resultsBtn.click();
          break;
        }
        break; // Unknown state
      }

      // Select first answer option
      const options = page.locator('button.w-full.p-4.text-left');
      const count = await options.count();
      if (count > 0) {
        await options.first().click();
      }

      // Click "Ответить"
      await answerBtn.click();

      // Wait for feedback
      await expect(
        page.getByText(/Правильно|Неправильно/i).first()
      ).toBeVisible({ timeout: 10000 });

      // Click "Следующий вопрос" or "Посмотреть результаты"
      const nextBtn = page.getByRole('button', { name: /Следующий вопрос/i });
      const finalBtn = page.getByRole('button', { name: /Посмотреть результаты/i });

      if (await finalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await finalBtn.click();
        break;
      }
      await nextBtn.click();
      // Small pause for next question to load
      await page.waitForTimeout(500);
    }

    // Should arrive at results page
    await page.waitForURL(/\/diagnostic\/results/, { timeout: 30000 });

    // Radar chart should be visible (Recharts SVG)
    await expect(
      page.locator('.recharts-wrapper').first()
    ).toBeVisible({ timeout: 10000 });
  });
});
