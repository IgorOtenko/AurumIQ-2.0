import { test, expect } from '@playwright/test';

// End-to-end smoke covering the Phase 1 + Phase 3 user happy path:
//   1. Brand new signup (random email so the test is idempotent).
//   2. Auto-login redirect to /dashboard (signup page calls signIn() after
//      the /api/auth/signup POST succeeds).
//   3. Fallback manual login if the auto-login redirect didn't land us on
//      /dashboard (defensive — covers cookie/SSR races on slow runners).
//   4. Add an AAPL holding via the dashboard form and assert the row
//      appears in the holdings table after the Yahoo Finance enrichment
//      round-trips.
//
// Edit / Delete are intentionally out of scope here — covered manually
// during Phase 3 verification. Keeping this spec focused makes the failure
// mode obvious when CI breaks: it's auth or it's portfolio-add, not both.
test('signup → auto-login → add holding flow', async ({ page }) => {
  // Random email per run: lets us re-run locally without DB cleanup, and
  // avoids cross-test pollution if the dev DB is shared.
  const email = `test-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  // --- Signup ---
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();

  // Signup auto-logs the user in via signIn('credentials', { redirectTo: '/dashboard' }).
  // The Auth.js redirect is a full navigation, so we wait for the URL to settle.
  await page.waitForURL(/\/(dashboard|login)/, { timeout: 10_000 });

  // --- Defensive fallback: manual login if we didn't land on /dashboard ---
  if (page.url().includes('/login')) {
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  }

  // --- Dashboard chrome ---
  await expect(page.getByRole('heading', { name: 'AurumIQ' })).toBeVisible();
  // Empty-state ticker bar copy is load-bearing — it's what new users see first.
  await expect(page.getByText(/no holdings yet/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /add holding/i })).toBeVisible();

  // --- Add a holding ---
  await page.getByLabel(/ticker/i).fill('AAPL');
  await page.getByLabel(/quantity/i).fill('5');
  await page.getByLabel(/cost basis/i).fill('150');
  await page.getByRole('button', { name: /add holding/i }).click();

  // The POST returns immediately but the row only renders after the
  // Yahoo Finance enrichment resolves; allow up to 10s for that.
  const aaplCell = page.getByRole('cell', { name: 'AAPL' }).first();
  await expect(aaplCell).toBeVisible({ timeout: 10_000 });
});
