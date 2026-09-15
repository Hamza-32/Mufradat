import { expect, test } from '@playwright/test';

/**
 * Google re-checks the privacy policy and terms URLs to keep the OAuth consent
 * screen valid, and it reaches them by following links from the home page. If
 * either 404s, or the footer linking to them is refactored away, Google sign-in
 * stops working — with no error anywhere in this codebase to explain why.
 *
 * So these assertions are less about the prose than about the two things that
 * silently break it: the routes existing, and being reachable from the front.
 */
test.describe('policy pages', () => {
  for (const path of ['/privacy', '/terms']) {
    test(`${path} renders without a session or a database`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // A policy with no way to contact anyone is not a policy.
      await expect(page.locator('a[href^="mailto:"]')).toBeVisible();
    });
  }

  test('both are reachable from the landing page', async ({ page }) => {
    await page.goto('/');
    const privacy = page.locator('a[href="/privacy"]').first();
    const terms = page.locator('a[href="/terms"]').first();
    await expect(privacy).toBeVisible();
    await expect(terms).toBeVisible();

    await privacy.click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('both are reachable from the sign-in page', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
    await expect(page.locator('a[href="/terms"]').first()).toBeVisible();
  });

  test('they are listed in the sitemap so a crawler finds them', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('/privacy');
    expect(body).toContain('/terms');
  });
});
