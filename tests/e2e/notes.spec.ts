import { expect, test } from '@playwright/test';

/**
 * Notes are tested as a guest, against IndexedDB. The things worth asserting
 * are the ones a unit test cannot reach: that mixed scripts lay out correctly,
 * that the editor saves without being asked, and that markup in a note stays
 * inert.
 */
test.describe('notes', () => {
  test('a note can be written and it saves itself', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: /নতুন নোট|New note/ }).click();

    const body = page.getByRole('textbox', { name: /নোটের লেখা|Note text/ });
    await body.fill('كِتَاب মানে **বই**');

    // No save button exists; the note must appear in the list on its own.
    await expect(page.getByRole('button', { name: /كِتَاب/ })).toBeVisible({ timeout: 6000 });
  });

  test('the editor lays out by content direction, not by a setting', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: /নতুন নোট|New note/ }).click();
    const body = page.getByRole('textbox', { name: /নোটের লেখা|Note text/ });
    await expect(body).toHaveAttribute('dir', 'auto');
  });

  test('markup inside a note is shown, not executed', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: /নতুন নোট|New note/ }).click();
    await page
      .getByRole('textbox', { name: /নোটের লেখা|Note text/ })
      .fill('<img src=x onerror="window.__pwned=1">');
    await page.getByRole('button', { name: /দেখতে কেমন|Preview/ }).click();

    await expect(page.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => '__pwned' in window)).toBe(false);
  });

  test('preview renders the markdown a learner wrote', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: /নতুন নোট|New note/ }).click();
    await page
      .getByRole('textbox', { name: /নোটের লেখা|Note text/ })
      .fill('## Heading\n\n- one\n- two');
    await page.getByRole('button', { name: /দেখতে কেমন|Preview/ }).click();

    await expect(page.getByRole('heading', { name: 'Heading' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'one' })).toBeVisible();
  });

  test('the layout is full-screen editor on a phone and two panes on a desktop', async ({
    page,
  }, testInfo) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: /নতুন নোট|New note/ }).click();
    const editor = page.getByRole('region', { name: /নোট সম্পাদনা|Note editor/ });

    const box = await editor.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) return;

    if (testInfo.project.name === 'phone-390') {
      expect(box.width).toBeGreaterThan(viewport.width * 0.9);
      await expect(page.getByRole('button', { name: /নোট বন্ধ|Close note/ })).toBeVisible();
    } else {
      expect(box.width).toBeLessThan(viewport.width * 0.8);
    }
  });

  test('a word page offers to open a note attached to that word', async ({ page }) => {
    await page.goto('/words/kitab');
    await page.getByRole('link', { name: /নোট লিখুন|Write a note/ }).click();
    await expect(page).toHaveURL(/\/notes\?word=kitab/);
    await expect(page.getByRole('region', { name: /নোট সম্পাদনা|Note editor/ })).toBeVisible();
  });
});
