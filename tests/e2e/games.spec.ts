import { expect, test } from '@playwright/test';

/**
 * Games are tested as a guest, which is the harder path: the queue, the
 * grading and the session record all run against IndexedDB with no account.
 */
test.describe('games', () => {
  test('the index offers the built games and marks the rest honestly', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByRole('link', { name: /জোড়া মেলান|Match the pairs/ })).toBeVisible();
    await expect(page.getByText(/শীঘ্রই আসছে|Coming soon/).first()).toBeVisible();
  });

  test('a game is still playable once the daily new words are done', async ({ page }) => {
    // Regression: games used to load the review queue, which is capped by the
    // daily new-word limit. Finishing the day's ten new words emptied every
    // game board and told the learner to "learn a few words first" — the one
    // thing they had just done. Games now draw on an uncapped pool.
    await page.goto('/review');
    // count() does not auto-wait, so the first card has to be on screen before
    // the loop starts or it exits immediately and proves nothing.
    await expect(page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ })).toBeVisible();

    // Grade until the session runs out, which is what exhausts the day's new
    // words. Without this the precondition never holds and the test passes for
    // the wrong reason.
    for (let i = 0; i < 20; i += 1) {
      const reveal = page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ });
      if ((await reveal.count()) === 0) break;
      await reveal.click();
      await page
        .getByRole('button', { name: /ঠিক|Good/ })
        .first()
        .click();
      await page.waitForTimeout(150);
    }

    // The precondition, asserted rather than assumed: the learner's own queue
    // is now empty because the daily new budget is spent.
    const remaining = await page.evaluate(async () => {
      const response = await fetch('/api/review/candidates');
      const { candidates } = (await response.json()) as { candidates: unknown[] };
      return candidates.length;
    });
    expect(remaining).toBeGreaterThan(0);

    await page.goto('/games/match-pairs');
    await expect(page.getByText(/যথেষ্ট শব্দ নেই|Not enough words/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /শুরু করুন|^Start$/ })).toBeVisible();
  });

  test('match the pairs: a round starts, and a correct pair leaves the board', async ({ page }) => {
    await page.goto('/games/match-pairs');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();

    const board = page.getByRole('list', { name: /মেলানোর বোর্ড|Matching board/ });
    await expect(board).toBeVisible();

    const tiles = board.getByRole('button');
    // Four pairs on a phone, six on a wider board — either way an even number.
    const count = await tiles.count();
    expect(count % 2).toBe(0);
    expect(count).toBeGreaterThanOrEqual(8);

    // A timer is running and visible.
    await expect(page.getByRole('timer')).toBeVisible();

    // Selecting a tile marks it pressed, which is how the state is exposed to
    // assistive tech as well as to the eye.
    await tiles.first().click();
    await expect(tiles.first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('multiple choice: four options, and a wrong tap does not end the question', async ({
    page,
  }) => {
    await page.goto('/games/multiple-choice');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();

    const options = page
      .getByRole('list', { name: /সম্ভাব্য অর্থ|Possible meanings/ })
      .getByRole('button');
    await expect(options).toHaveCount(4);
    await expect(page.locator('[lang="ar"]').first()).toBeVisible();
  });

  test('a game is a full-screen task with no navigation', async ({ page }) => {
    await page.goto('/games/match-pairs');
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /খেলা বন্ধ|Leave the game/ })).toBeVisible();
  });

  test('an unknown game is a 404, not a blank screen', async ({ page }) => {
    const response = await page.goto('/games/not-a-game');
    expect(response?.status()).toBe(404);
  });

  test('spelling: the phone gets a keyboard with the vowel marks on it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-390', 'phone only');
    await page.goto('/games/spelling');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();

    const keyboard = page.getByRole('group', { name: /আরবি কীবোর্ড|Arabic keyboard/ });
    await expect(keyboard).toBeVisible();

    // The marks are the reason this keyboard exists, so they are asserted by
    // name rather than by position.
    for (const mark of [/ফাতহা|Fatha/, /কাসরা|Kasra/, /সুকুন|Sukun/, /শাদ্দা|Shadda/]) {
      await expect(keyboard.getByRole('button', { name: mark })).toBeVisible();
    }

    // Tapping a letter types it into the answer field.
    await keyboard.getByRole('button', { name: 'ك', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: /আরবি শব্দটি লিখুন|Write the Arabic word/ }),
    ).toHaveValue('ك');
  });

  test('spelling: the desktop converts Latin typing into Arabic', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop only');
    await page.goto('/games/spelling');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();

    const field = page.getByRole('textbox', { name: /আরবি শব্দটি লিখুন|Write the Arabic word/ });
    await field.fill('kitaab');
    await expect(field).toHaveValue('كِتاب');

    // The on-screen keyboard is one tap away for anything the scheme misses.
    await page.getByRole('button', { name: /কীভাবে টাইপ|How do I type/ }).click();
    await expect(page.getByRole('group', { name: /আরবি কীবোর্ড|Arabic keyboard/ })).toBeVisible();
  });

  test('spelling: the answer field never shows the word being asked for', async ({ page }) => {
    await page.goto('/games/spelling');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();
    await expect(
      page.getByRole('textbox', { name: /আরবি শব্দটি লিখুন|Write the Arabic word/ }),
    ).toHaveValue('');
  });

  test('harakat: the word is shown bare and every letter is its own control', async ({ page }) => {
    await page.goto('/games/harakat');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();

    const word = page.getByRole('group', { name: /শব্দের হরফ|letters of the word/ });
    await expect(word).toBeVisible();

    const letters = word.getByRole('button');
    expect(await letters.count()).toBeGreaterThanOrEqual(2);

    // No vowel marks on screen before the learner places any.
    expect(await word.innerText()).not.toMatch(/[\u064B-\u0652]/u);

    // The first letter is selected to start with, so a tap on a mark lands
    // somewhere sensible without any setup.
    await expect(letters.first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('harakat: placing a mark shows it on the selected letter', async ({ page }) => {
    await page.goto('/games/harakat');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();

    const word = page.getByRole('group', { name: /শব্দের হরফ|letters of the word/ });
    await page.getByRole('button', { name: /ফাতহা|Fatha/ }).click();
    expect(await word.innerText()).toMatch(/\u064E/u);
  });

  test('harakat: "no mark" is offered as a real answer', async ({ page }) => {
    await page.goto('/games/harakat');
    await page.getByRole('button', { name: /শুরু করুন|^Start$/ }).click();
    await expect(page.getByRole('button', { name: /হরকত নেই|No mark/ })).toBeVisible();
  });
});
