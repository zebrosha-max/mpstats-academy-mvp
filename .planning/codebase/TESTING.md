# Testing Patterns

**Analysis Date:** 2026-02-16

## Test Framework

**Runner:**
- Vitest 2.1.3 (unit/integration tests)
- Playwright 1.48.1 (E2E tests)
- Config files:
  - `apps/web/vitest.config.ts` — unit tests
  - `apps/web/playwright.config.ts` — E2E tests

**Assertion Library:**
- Vitest built-in assertions (Jest-compatible)
- `@testing-library/jest-dom` for DOM matchers (extended assertions)

**Run Commands:**
```bash
pnpm test              # Run all unit tests (vitest run)
pnpm test:watch        # Watch mode (vitest)
pnpm test:e2e          # Run all E2E tests
pnpm test:e2e:ui       # Playwright UI mode (interactive debugging)
pnpm typecheck         # TypeScript check (tsc --noEmit)
```

## Test File Organization

**Location:**
- Unit tests: `apps/web/tests/**/*.test.{ts,tsx}` or co-located `src/**/*.test.{ts,tsx}`
- E2E tests: `apps/web/tests/e2e/**/*.spec.ts`
- Setup file: `apps/web/tests/setup.ts`

**Naming:**
- Unit/integration: `*.test.ts` or `*.test.tsx`
- E2E: `*.spec.ts`

**Structure:**
```
apps/web/
├── tests/
│   ├── setup.ts              # Vitest setup (imports jest-dom)
│   └── e2e/
│       └── landing.spec.ts   # E2E test for landing page
└── src/
    └── **/*.test.tsx         # Co-located unit tests (optional)
```

## Test Structure

**Suite Organization (E2E):**
```typescript
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
```

**Patterns:**
- Use `test.describe()` to group related tests
- Descriptive test names with `should` prefix
- Async/await for all Playwright operations
- Page fixture automatically provided by Playwright

**Setup:**
- Global setup: `apps/web/tests/setup.ts`
  ```typescript
  import '@testing-library/jest-dom';
  ```
- Per-test setup: Inline within `test()` blocks (no separate `beforeEach` in current tests)

**Teardown:**
- Not explicitly needed (Playwright handles cleanup)
- Database reset would go in `afterEach` (when DB tests added)

## Mocking

**Framework:**
- Vitest built-in mocking (`vi.mock()`, `vi.fn()`)
- Not yet used in codebase (Sprint 2 focused on UI with mock data)

**Patterns (for future tests):**

**tRPC mocking:**
```typescript
import { vi } from 'vitest';

// Mock tRPC client
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    learning: {
      getLesson: {
        useQuery: vi.fn(() => ({
          data: { id: 'test-lesson', title: 'Test Lesson' },
          isLoading: false,
        })),
      },
    },
  },
}));
```

**Supabase mocking:**
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user', email: 'test@example.com' } },
      })),
    },
  })),
}));
```

**What to Mock:**
- External API calls (Supabase, OpenRouter)
- tRPC queries/mutations in component tests
- Database operations (Prisma client)
- File system operations (if any)

**What NOT to Mock:**
- Utility functions (`cn()`, `formatTimecode()`)
- Pure business logic
- React components (render actual components)
- Tailwind classes

## Fixtures and Factories

**Test Data:**
- Current approach: Mock data defined in `packages/api/src/mocks/`
  - `mocks/dashboard.ts` — `MOCK_USER_STATS`, `MOCK_RECENT_ACTIVITY`, `MOCK_SKILL_PROFILE`
  - `mocks/questions.ts` — `MOCK_QUESTIONS`
  - `mocks/courses.ts` — `MOCK_LESSONS`, `MOCK_COURSES`

**Pattern (for unit tests):**
```typescript
// test/fixtures/user.ts
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

// Usage in test
const user = createMockUser({ email: 'custom@example.com' });
```

**Location:**
- Shared fixtures: `apps/web/tests/fixtures/` (to be created)
- Test-specific data: Inline in test file

## Coverage

**Requirements:**
- Target: 70% for business logic (stated in project docs)
- Not enforced yet (Sprint 0-2 UI-first approach)

**View Coverage:**
```bash
pnpm test -- --coverage
```

**Configuration (vitest.config.ts):**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  exclude: ['node_modules/', '.next/', 'tests/'],
}
```

**Coverage Output:**
- Terminal: Text summary
- Browser: Open `coverage/index.html`

**What to Measure:**
- Business logic in `packages/api/src/routers/`
- AI functions in `packages/ai/src/`
- Utility functions in `apps/web/src/lib/`

**What to Exclude:**
- UI components (focus on E2E instead)
- Config files
- Type definitions
- Mock data files

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities
- Approach: Test pure functions in isolation
- Example targets:
  - `cn()` utility (`apps/web/src/lib/utils.ts`)
  - `formatTimecode()` (`packages/ai/src/retrieval.ts`)
  - `calculateSkillGaps()` (`packages/api/src/routers/diagnostic.ts`)

**Integration Tests:**
- Scope: tRPC routers with mocked database
- Approach: Test procedure logic with fixtures
- Example targets:
  - `diagnostic.startSession()` → creates session
  - `diagnostic.submitAnswer()` → validates answer
  - `ai.getLessonSummary()` → retrieves/generates summary

**E2E Tests:**
- Framework: Playwright
- Scope: Full user flows
- Current tests: `apps/web/tests/e2e/landing.spec.ts`
  - Landing page loads
  - Navigation links work
  - Login/register navigation

**Planned E2E tests (not yet implemented):**
- Auth flow (register → verify → login → dashboard)
- Diagnostic flow (start → answer questions → view results)
- Learning flow (browse courses → watch lesson → mark complete)
- Profile flow (update settings → view history)

## Common Patterns

**Async Testing (Playwright):**
```typescript
test('should navigate to login page', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Войти');
  await expect(page).toHaveURL('/login');
});
```

**Pattern:**
- All Playwright operations are async (await required)
- Use `page.goto()` for navigation
- Use `page.click()` or `page.getByRole().click()` for interactions
- Use `expect(page).toHaveURL()` for navigation assertions
- Use `expect(element).toBeVisible()` for presence checks

**Error Testing (tRPC - example pattern):**
```typescript
import { expect, test } from 'vitest';
import { TRPCError } from '@trpc/server';

test('should throw UNAUTHORIZED without user', async () => {
  const ctx = { user: null, prisma };

  await expect(
    protectedProcedure.query({ ctx })
  ).rejects.toThrow(TRPCError);
});
```

**Component Testing (React - example pattern):**
```typescript
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Button } from '@/components/ui/button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

## Vitest Configuration

**Config:** `apps/web/vitest.config.ts`

**Key Settings:**
```typescript
{
  plugins: [react()],
  test: {
    environment: 'jsdom',           // DOM environment for React
    globals: true,                  // Global test/expect/vi
    setupFiles: ['./tests/setup.ts'], // jest-dom matchers
    include: [
      'tests/**/*.test.{ts,tsx}',   // Primary test location
      'src/**/*.test.{ts,tsx}'      // Co-located tests
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Match Next.js alias
    },
  },
}
```

## Playwright Configuration

**Config:** `apps/web/playwright.config.ts`

**Key Settings:**
```typescript
{
  testDir: './tests/e2e',
  fullyParallel: true,              // Run tests in parallel
  forbidOnly: !!process.env.CI,     // Prevent .only in CI
  retries: process.env.CI ? 2 : 0,  // Retry flaky tests in CI
  workers: process.env.CI ? 1 : undefined, // Single worker in CI
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',        // Record trace for debugging
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
}
```

**Multi-Browser Testing:**
- Desktop: Chromium, Firefox, WebKit (Safari)
- Mobile: Pixel 5 (Chrome)
- Runs automatically on `pnpm test:e2e`

**Dev Server Integration:**
- Playwright starts dev server automatically
- Waits for `http://localhost:3000` to be ready
- Reuses existing server in local dev

## Current Test Status

**Implemented:**
- ✅ E2E: Landing page (`apps/web/tests/e2e/landing.spec.ts`)
  - Page load
  - Login/register links
  - Navigation

**Not Yet Implemented (Sprint 1-2 QA tasks):**
- Unit tests for utilities
- Integration tests for tRPC routers
- E2E: Auth flow
- E2E: Diagnostic flow
- E2E: Learning flow
- E2E: Protected routes
- Component tests (React Testing Library)

**Why Limited Tests:**
- Project in Sprint 2: UI-first approach with mock data
- Focus on building features, testing deferred to later sprints
- E2E framework ready, tests to be added in QA-focused sprints

## Testing Best Practices

**Test Independence:**
- Each test should be runnable in isolation
- No shared state between tests
- Clean up after each test (Playwright does this automatically)

**Descriptive Names:**
- Use `should` prefix: "should display the landing page"
- Include what's being tested and expected outcome
- Russian strings use regex for flexibility: `/Войти/i`

**Arrange-Act-Assert:**
```typescript
test('should navigate to login page', async ({ page }) => {
  // Arrange: Navigate to landing
  await page.goto('/');

  // Act: Click login link
  await page.click('text=Войти');

  // Assert: Verify URL
  await expect(page).toHaveURL('/login');
});
```

**Accessibility-First Selectors:**
- Use `getByRole()` over CSS selectors:
  ```typescript
  page.getByRole('heading', { name: /MPSTATS Academy/i })
  page.getByRole('link', { name: /Войти/i })
  ```
- Use `getByText()` for text matching: `page.click('text=Войти')`
- Avoid brittle selectors like `.class-name` or `#id`

**Wait Strategies:**
- Prefer implicit waits (built into Playwright assertions):
  ```typescript
  await expect(element).toBeVisible(); // Auto-waits up to timeout
  ```
- Avoid explicit `page.waitForTimeout()` (flaky)
- Use `page.waitForURL()` or `page.waitForSelector()` when needed

---

*Testing analysis: 2026-02-16*
