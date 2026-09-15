import { expect, test } from '@playwright/test';

/**
 * A guest must be able to complete a review session with no account at all.
 * These run against IndexedDB, which is why they are e2e and not unit tests.
 */
test.describe('review session, as a guest', () => {
  test('a card can be flipped and graded, and the queue advances', async ({ page }) => {
    await page.goto('/review');

    const reveal = page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ });
    await expect(reveal).toBeVisible({ timeout: 15_000 });

    const firstWord = await page.locator('[lang="ar"]').first().innerText();
    await reveal.click();

    // All four grades are present, each with its own interval preview.
    for (const label of [/আবার|Again/, /কঠিন|Hard/, /ঠিক|Good/, /সহজ|Easy/]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    await page.getByRole('button', { name: /ঠিক|Good/ }).click();
    await expect(page.locator('[lang="ar"]').first()).not.toHaveText(firstWord);
  });

  test('the session has no navigation to wander out of', async ({ page }) => {
    await page.goto('/review');
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /সেশন বন্ধ|End session/ })).toBeVisible();
  });

  test('the keyboard drives the whole session on the desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop only');
    await page.goto('/review');
    await expect(page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: /ঠিক|Good/ })).toBeVisible();

    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.keyboard.press('3');
    await expect(page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ })).toBeVisible();
  });

  test('progress is announced, not just drawn', async ({ page }) => {
    await page.goto('/review');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', /\d+/);
  });
});
