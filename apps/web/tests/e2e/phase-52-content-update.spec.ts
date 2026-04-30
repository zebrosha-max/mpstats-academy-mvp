import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 52 — Content Triggers E2E
 *
 * Happy path:
 *  1. Admin logs in
 *  2. Opens course management, finds a hidden lesson, unhides with notify=true
 *  3. Switches to test user (with prior progress in same course + active sub)
 *  4. Sees CONTENT_UPDATE notification in bell
 *  5. Click navigates to lesson page
 *
 * Required env (set in GitHub Actions secrets or .env.test):
 *   - TEST_ADMIN_EMAIL          / TEST_ADMIN_PASSWORD       admin/superadmin role
 *   - TEST_USER_A_EMAIL         / TEST_USER_A_PASSWORD      user with progress in course
 *   - TEST_HIDDEN_LESSON_ID     ID of a hidden lesson the admin can unhide
 *   - TEST_HIDDEN_LESSON_TITLE  expected title (for assertion)
 *
 * Skipped automatically when env not set — meant for manual / staging runs.
 */

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const USER_A_EMAIL = process.env.TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.TEST_USER_A_PASSWORD;
const HIDDEN_LESSON_ID = process.env.TEST_HIDDEN_LESSON_ID;
const HIDDEN_LESSON_TITLE = process.env.TEST_HIDDEN_LESSON_TITLE;

const haveEnv =
  ADMIN_EMAIL &&
  ADMIN_PASSWORD &&
  USER_A_EMAIL &&
  USER_A_PASSWORD &&
  HIDDEN_LESSON_ID &&
  HIDDEN_LESSON_TITLE;

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|learn|diagnostic|admin)/, { timeout: 15000 });
}

async function logout(page: Page) {
  await page.goto('/api/auth/logout', { waitUntil: 'load' }).catch(() => {});
  await page.context().clearCookies();
}

test.describe('Phase 52 — CONTENT_UPDATE flow', () => {
  test.skip(!haveEnv, 'Phase 52 e2e env vars not set — skipping');

  test('admin unhides lesson with notify → user sees CONTENT_UPDATE', async ({
    page,
  }) => {
    // 1. Login as admin
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);

    // 2. Open admin courses, find hidden lesson, click "Показать"
    await page.goto('/admin');
    // The CourseManager renders nested lesson rows. Filter visibility includes
    // hidden lessons via includeHidden toggle — click it first.
    await page
      .getByRole('button', { name: /Скрытые|включить скрытые/i })
      .first()
      .click()
      .catch(() => {
        // toggle may already be on; ignore
      });
    // Locate row by lesson title and click "Вернуть"/"Показать"
    const row = page.getByText(HIDDEN_LESSON_TITLE!, { exact: false }).first();
    await row.scrollIntoViewIfNeeded();
    await row
      .locator('xpath=ancestor::*[contains(@class,"lesson-row") or self::li][1]')
      .getByRole('button', { name: /Показать|вернуть/i })
      .click();

    // 3. Confirm dialog with notify checkbox
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByText(/Уведомить подписчиков курса/i).click();
    await dialog.getByRole('button', { name: /Вернуть/i }).click();

    // 4. Logout, login as test user A
    await logout(page);
    await login(page, USER_A_EMAIL!, USER_A_PASSWORD!);

    // 5. Open notification bell — wait for new CONTENT_UPDATE
    await page.goto('/learn');
    await page
      .getByRole('button', { name: /уведомлен/i })
      .first()
      .click();
    const notifTitle = page.getByText(/Новый урок:|Добавлено .* в курсе/i).first();
    await expect(notifTitle).toBeVisible({ timeout: 30_000 });

    // 6. Click → navigates to /learn/<lessonId>
    await Promise.all([
      page.waitForURL(new RegExp(`/learn/${HIDDEN_LESSON_ID}`)),
      notifTitle.click(),
    ]);
  });
});
