import { test, expect } from '@playwright/test';

/**
 * Phase 49 - Lesson Materials E2E (D-26, D-29, D-25, D-32).
 *
 * Scenarios:
 *   1. User with subscription sees materials section on a lesson with attached materials.
 *   2. Locked lesson does NOT render materials section in DOM (D-29 / D-37).
 *   3. Admin can navigate to /admin/content/materials and see the table (D-32).
 *
 * Required env vars (set in CI / .env.test):
 *   - TEST_USER_PASSWORD            password for tester@mpstats.academy
 *   - TEST_LESSON_WITH_MATERIALS    lesson id that has at least one Material attached
 *   - TEST_LOCKED_LESSON_WITH_MATERIALS  lesson id that is locked for the no-subscription user
 *   - TEST_LOCKED_USER_EMAIL        no-subscription test user email
 *   - TEST_LOCKED_USER_PASSWORD     no-subscription test user password
 *   - TEST_USER_IS_ADMIN            'true' if tester@mpstats.academy has ADMIN/SUPERADMIN role
 *
 * Tests gracefully `test.skip()` if env vars are not set, so they never fail in
 * environments without seeded fixtures.
 */

const TEST_EMAIL = 'tester@mpstats.academy';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestUser2024';

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });
}

test.describe('Phase 49 - Lesson Materials', () => {
  test('subscriber sees materials section + CTA on lesson with attached materials', async ({ page }) => {
    const lessonId = process.env.TEST_LESSON_WITH_MATERIALS;
    test.skip(!lessonId, 'TEST_LESSON_WITH_MATERIALS env var not set — seed a lesson with attached Material first');

    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto(`/learn/${lessonId}`);

    // Section is rendered via data-testid="lesson-materials" (LessonMaterials.tsx:61)
    const section = page.getByTestId('lesson-materials');
    await expect(section).toBeVisible({ timeout: 15000 });

    // Heading "Материалы к уроку" present (D-26 / D-27)
    await expect(section.getByRole('heading', { name: /Материалы к уроку/ })).toBeVisible();

    // At least one MaterialCard CTA present (data-testid="material-cta-{id}", MaterialCard.tsx:102)
    const ctas = page.locator('[data-testid^="material-cta-"]');
    await expect(ctas.first()).toBeVisible({ timeout: 5000 });
    expect(await ctas.count()).toBeGreaterThanOrEqual(1);
  });

  test('locked lesson does NOT render materials section in DOM (D-29 / D-37)', async ({ page }) => {
    const lockedLessonId = process.env.TEST_LOCKED_LESSON_WITH_MATERIALS;
    const lockedEmail = process.env.TEST_LOCKED_USER_EMAIL;
    const lockedPassword = process.env.TEST_LOCKED_USER_PASSWORD;
    test.skip(
      !lockedLessonId || !lockedEmail || !lockedPassword,
      'Locked-lesson fixtures not configured (TEST_LOCKED_LESSON_WITH_MATERIALS / TEST_LOCKED_USER_EMAIL / TEST_LOCKED_USER_PASSWORD)',
    );

    await login(page, lockedEmail!, lockedPassword!);
    await page.goto(`/learn/${lockedLessonId}`);

    // Section MUST be absent from DOM — backend returns materials: [] for locked lessons,
    // and frontend short-circuits before rendering (LessonMaterials.tsx: if (length === 0) return null).
    const section = page.getByTestId('lesson-materials');
    await expect(section).toHaveCount(0);
  });

  test('admin can open /admin/content/materials and see the table (D-32)', async ({ page }) => {
    const isAdmin = process.env.TEST_USER_IS_ADMIN === 'true';
    test.skip(!isAdmin, 'TEST_USER_IS_ADMIN not set — tester user must have ADMIN or SUPERADMIN role');

    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await page.goto('/admin/content/materials');

    // Heading "Материалы к урокам" present
    await expect(page.getByRole('heading', { name: /Материалы (к урокам|урок)/ })).toBeVisible({ timeout: 10000 });

    // Add-material button visible (D-32: + Добавить материал)
    await expect(page.getByRole('link', { name: /Добавить материал/ })).toBeVisible();
  });
});
