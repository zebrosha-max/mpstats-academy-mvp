import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 51 — Notification Center E2E
 *
 * Полный flow:
 * 1. Юзер A создаёт root коммент на уроке X
 * 2. Юзер B логинится, открывает урок X, отвечает на коммент A
 * 3. Юзер A логинится, ждёт badge (≤90s polling tolerance)
 * 4. Открывает dropdown → видит уведомление от B
 * 5. Click на item → переход на /learn/X#comment-Y → highlight visible
 * 6. После reload bell badge = 0 (читал)
 *
 * Required env vars (set in GitHub Actions secrets / .env.test):
 *   - TEST_USER_A_EMAIL              email юзера A (получатель уведомления)
 *   - TEST_USER_A_PASSWORD           пароль юзера A
 *   - TEST_USER_B_EMAIL              email юзера B (отвечающий)
 *   - TEST_USER_B_PASSWORD           пароль юзера B
 *   - TEST_LESSON_ID                 ID free-tier урока, доступного обоим юзерам
 *
 * **Phase 51 NOT shipped until все 5 secrets выставлены** (см. acceptance criteria SPEC req 7).
 * Если secrets отсутствуют — тест явно падает с инструкцией, НЕ skip'ает.
 */

const USER_A_EMAIL = process.env.TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.TEST_USER_A_PASSWORD;
const USER_B_EMAIL = process.env.TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.TEST_USER_B_PASSWORD;
const TEST_LESSON_ID = process.env.TEST_LESSON_ID;

/** Пере-используемый login helper (тот же pattern что в lesson-materials.spec.ts) */
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|learn|diagnostic)/, { timeout: 15000 });
}

test.describe('Phase 51 — Notification Center COMMENT_REPLY flow', () => {
  test.beforeAll(() => {
    // Explicit fail (NOT skip) — phase NOT shipped without these secrets.
    const missing: string[] = [];
    if (!USER_A_EMAIL) missing.push('TEST_USER_A_EMAIL');
    if (!USER_A_PASSWORD) missing.push('TEST_USER_A_PASSWORD');
    if (!USER_B_EMAIL) missing.push('TEST_USER_B_EMAIL');
    if (!USER_B_PASSWORD) missing.push('TEST_USER_B_PASSWORD');
    if (!TEST_LESSON_ID) missing.push('TEST_LESSON_ID');
    if (missing.length > 0) {
      throw new Error(
        `Missing GitHub Actions secrets: ${missing.join(', ')}. ` +
          `Set via gh secret set <NAME> или Settings → Secrets and variables → Actions. ` +
          `Phase 51 NOT shipped until all 5 secrets configured.`,
      );
    }
  });

  test('reply → bell badge → click → markRead end-to-end', async ({ browser }) => {
    // Setup: два независимых browser context'а (clean cookies)
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // 1. Юзер A — login + create root comment
      await login(pageA, USER_A_EMAIL!, USER_A_PASSWORD!);
      await pageA.goto(`/learn/${TEST_LESSON_ID}`);

      const commentText = `e2e test root ${Date.now()}`;
      // VERIFIED selectors (CommentInput.tsx:146,172)
      await pageA.getByPlaceholder('Напишите комментарий...').fill(commentText);
      await pageA.getByRole('button', { name: 'Отправить' }).click();
      await expect(pageA.getByText(commentText)).toBeVisible({ timeout: 5000 });

      // 2. Юзер B — login и reply на коммент A
      await login(pageB, USER_B_EMAIL!, USER_B_PASSWORD!);
      await pageB.goto(`/learn/${TEST_LESSON_ID}`);

      // CommentItem root div имеет id="comment-<cuid>" (Phase 51 plan 06 Task 3)
      // Найти коммент A через текст и нажать "Ответить" в его контексте
      const commentAItem = pageB
        .locator('[id^="comment-"]')
        .filter({ hasText: commentText })
        .first();
      await commentAItem.getByRole('button', { name: /Ответить/ }).click();

      const replyText = `e2e reply ${Date.now()}`;
      await pageB.getByPlaceholder('Напишите ответ...').fill(replyText);
      await pageB.getByRole('button', { name: 'Отправить' }).click();
      await expect(pageB.getByText(replyText)).toBeVisible({ timeout: 5000 });

      // 3. Юзер A — открыть любую (main)/* страницу и ждать badge ≤ 90с
      // (polling 60c + первый refetch может произойти при mount instantly)
      await pageA.goto('/dashboard');
      const bellButton = pageA.getByRole('button', { name: 'Уведомления' });
      await expect(bellButton).toBeVisible();
      // Badge — span внутри bellButton (NotificationBell.tsx:382-389)
      const bellBadge = bellButton.locator('span').first();
      await expect(bellBadge).toContainText(/[1-9]/, { timeout: 90_000 });

      // 4. Click на bell → dropdown открывается → click первое item
      await bellButton.click();
      // Popover content виден (Radix popper-content)
      const dropdown = pageA.locator('[data-radix-popper-content-wrapper]').first();
      await expect(dropdown).toBeVisible({ timeout: 5000 });

      // Первое уведомление — Link c ctaUrl
      const firstNotif = dropdown.locator('a').first();
      await expect(firstNotif).toContainText(replyText.slice(0, 50));
      await firstNotif.click();

      // 5. Должен быть переход на /learn/X#comment-Y (ctaUrl format из notify.ts)
      await pageA.waitForURL(/\/learn\/.*#comment-/);
      const url = pageA.url();
      expect(url).toMatch(/#comment-/);

      // 6. Reload — bell badge должен исчезнуть (markRead сработал при click)
      await pageA.reload();
      const badgeAfter = pageA
        .getByRole('button', { name: 'Уведомления' })
        .locator('span')
        .first();
      await expect(badgeAfter).not.toBeVisible({ timeout: 30_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
