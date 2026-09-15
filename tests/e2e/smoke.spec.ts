import { expect, test } from '@playwright/test';

/**
 * Placeholder critical path. Real e2e coverage (guest review session, search,
 * offline queue flush) arrives with the features it tests. The point of having
 * it now is that CI runs at 390px and 1440px from the first commit.
 */
test('home page renders and does not scroll horizontally', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
