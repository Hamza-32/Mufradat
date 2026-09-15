import { expect, test } from '@playwright/test';

/**
 * Search is the feature the whole normalisation layer exists for, so the test
 * is written the way a learner behaves: type what you can remember, in
 * whatever script comes to hand.
 */
test.describe('word browse', () => {
  test('the list renders before JavaScript does anything', async ({ page }) => {
    await page.goto('/words');
    // Deliberately not a named word: the first page is ordered by frequency, so
    // naming one couples this test to the content and it breaks every time a
    // commoner word is added. What matters is that the server sent a list.
    const first = page.locator('a[href^="/words/"]').first();
    await expect(first).toBeVisible();
    await expect(first.locator('[lang="ar"]')).toBeVisible();
  });

  test.describe('finds the same word from every script', () => {
    for (const query of ['kitab', 'kitāb', 'كتاب', 'كِتَاب', 'বই', 'book']) {
      test(`"${query}"`, async ({ page }) => {
        await page.goto('/words');
        await page.getByRole('searchbox').fill(query);
        await expect(page.getByRole('link', { name: /كِتَاب/ })).toBeVisible({ timeout: 5000 });
      });
    }
  });

  test('an unmatched search offers a way out rather than a dead end', async ({ page }) => {
    await page.goto('/words');
    await page.getByRole('searchbox').fill('zzzzqqq');
    await expect(page.getByRole('button', { name: /খোঁজা বাদ|Clear search/ })).toBeVisible();
  });

  test('the word page carries the root family and the source reference', async ({ page }) => {
    await page.goto('/words/kitab');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('Al-Baqarah 2:2')).toBeVisible();
    await expect(page.getByRole('link', { name: /كَتَبَ/ })).toBeVisible();
  });

  test('filters live in a sheet on the phone and a rail on the desktop', async ({
    page,
  }, testInfo) => {
    await page.goto('/words');
    const filterButton = page.getByRole('button', { name: /ফিল্টার|Filters/ });
    if (testInfo.project.name === 'phone-390') {
      await expect(filterButton).toBeVisible();
      await filterButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    } else {
      await expect(filterButton).toBeHidden();
      await expect(page.getByRole('group', { name: /ডেক|Deck/ }).first()).toBeVisible();
    }
  });
});
