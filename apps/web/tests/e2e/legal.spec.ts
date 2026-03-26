import { test, expect } from '@playwright/test';

const PROD = 'https://platform.mpstats.academy';

const legalPages = [
  { path: '/legal/offer', title: /оферт/i },
  { path: '/legal/pdn', title: /персональн/i },
  { path: '/legal/adv', title: /реклам/i },
  { path: '/legal/cookies', title: /cookie/i },
  { path: '/policy', title: /конфиденциальност/i },
];

test.describe('Legal Pages', () => {
  for (const page of legalPages) {
    test(`${page.path} should load and have correct heading`, async ({ page: p }) => {
      await p.goto(`${PROD}${page.path}`);
      await p.waitForLoadState('domcontentloaded');
      // Page should have a heading matching the expected title
      const heading = p.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      await expect(heading).toHaveText(page.title);
    });
  }

  test('/legal/offer should contain key offer details', async ({ page }) => {
    await page.goto(`${PROD}/legal/offer`);
    await expect(page.getByText(/platform\.mpstats\.academy\/legal\/offer/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/24 часа/)).toBeVisible();
    await expect(page.getByText(/МПСТАТС ПРОДВИЖЕНИЕ/).first()).toBeVisible();
    await expect(page.getByText(/CloudPayments/).first()).toBeVisible();
  });
});

test.describe('Registration Checkboxes', () => {
  test('should show 3 checkboxes on register page', async ({ page }) => {
    await page.goto(`${PROD}/register`);
    await page.waitForLoadState('domcontentloaded');

    // Find checkboxes (look for checkbox inputs or button[role=checkbox])
    const checkboxes = page.locator('button[role="checkbox"], input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('submit should be disabled without required checkboxes', async ({ page }) => {
    await page.goto(`${PROD}/register`);
    await page.waitForLoadState('domcontentloaded');

    // Fill form fields
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[type="email"]', 'test-legal@example.com');
    await page.fill('input[type="password"]', 'TestPassword123');

    // Submit button should be disabled (required checkboxes not checked)
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('submit should enable after checking required checkboxes', async ({ page }) => {
    await page.goto(`${PROD}/register`);
    await page.waitForLoadState('domcontentloaded');

    // Dismiss cookie banner if it blocks clicks
    const acceptBtn = page.getByRole('button', { name: /принять/i });
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
    }

    // Fill form fields
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[type="email"]', 'test-legal@example.com');
    await page.fill('input[type="password"]', 'TestPassword123');

    // Check first two required checkboxes (use visible button[role=checkbox] not hidden input)
    const checkboxes = page.locator('button[role="checkbox"]');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    // Submit should now be enabled
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
  });

  test('checkboxes should have links to legal pages', async ({ page }) => {
    await page.goto(`${PROD}/register`);
    await page.waitForLoadState('domcontentloaded');

    // Should have links to offer, pdn, adv
    await expect(page.locator('a[href*="/legal/offer"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('a[href*="/legal/pdn"]')).toBeVisible();
    await expect(page.locator('a[href*="/legal/adv"]')).toBeVisible();
  });
});

test.describe('Cookie Consent Banner', () => {
  test('should show cookie banner on first visit', async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.goto(`${PROD}`);
    await page.evaluate(() => localStorage.removeItem('cookie_consent'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Banner should be visible
    await expect(page.getByText(/cookie/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Footer Legal Links', () => {
  test('landing footer should have legal links', async ({ page }) => {
    await page.goto(`${PROD}`);
    await page.waitForLoadState('domcontentloaded');

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Should have legal links in footer
    const footer = page.locator('footer, [class*="footer"]').last();
    await expect(footer.locator('a[href*="/legal/offer"], a[href*="/policy"]').first()).toBeVisible({ timeout: 5000 });
  });
});
