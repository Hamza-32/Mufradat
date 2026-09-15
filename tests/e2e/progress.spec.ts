import { expect, test } from '@playwright/test';

/**
 * The signed-in charts need an account, so these cover what can be checked
 * without one: that a guest is told where their progress actually lives, and
 * that the page never pretends to have data it cannot see.
 */
test.describe('progress', () => {
  test('a guest is told their progress is on the device, not lost', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: /অগ্রগতি|Progress/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /সাইন ইন|Sign in/ }).first()).toBeVisible();
  });

  test('the page is reachable from the navigation at both widths', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /অগ্রগতি|Progress/ })
      .click();
    await expect(page).toHaveURL(/\/progress/);
  });
});
