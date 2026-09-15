import { expect, test } from '@playwright/test';

/**
 * The scenario this whole step exists for: a learner mid-session when the
 * signal goes. Playwright's offline mode is the closest thing to a Dhaka bus
 * available in CI.
 */
test.describe('offline', () => {
  test('the app is installable, with a manifest that opens into a review', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);

    const manifest = (await response.json()) as {
      start_url: string;
      display: string;
      icons: { sizes: string; purpose?: string }[];
    };
    // Someone who installed a vocabulary app wants to review, not to read a
    // home page.
    expect(manifest.start_url).toBe('/review');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  });

  test('a review session keeps working when the connection drops', async ({ page, context }) => {
    await page.goto('/review');
    await expect(page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ })).toBeVisible({
      timeout: 15_000,
    });

    await context.setOffline(true);

    // Grading must still advance the queue: a guest's cards are local, and a
    // signed-in learner's answers go to the outbox.
    await page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ }).click();
    await page.getByRole('button', { name: /ঠিক|Good/ }).click();
    await expect(page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ })).toBeVisible();

    await context.setOffline(false);
  });

  test('the interface says what is happening, once, not per card', async ({ page, context }) => {
    await page.goto('/review');
    await expect(page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ })).toBeVisible({
      timeout: 15_000,
    });

    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const status = page.getByRole('status');
    await expect(status).toHaveCount(1);
    await context.setOffline(false);
  });

  test('the offline fallback page depends on nothing and still points somewhere useful', async ({
    page,
  }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /পড়া চালিয়ে|Carry on reviewing/ })).toBeVisible();
  });

  test('a guest review leaves something the migration can find', async ({ page }) => {
    // A regression guard. The device identity used to be created by a function
    // nothing called, so a guest could study for a week and then sign in to an
    // empty account — the migration looked at the device, found no id, and
    // reported nothing to move.
    await page.goto('/review');
    await page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ }).click();
    await page.getByRole('button', { name: /ঠিক|Good/ }).click();

    const found = await page.waitForFunction(
      async () =>
        new Promise<boolean>((resolve) => {
          const request = indexedDB.open('mufradat-guest');
          request.onerror = () => {
            resolve(false);
          };
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('meta')) {
              resolve(false);
              return;
            }
            const read = db.transaction('meta').objectStore('meta').get('guestId');
            read.onsuccess = () => {
              resolve(Boolean(read.result));
            };
            read.onerror = () => {
              resolve(false);
            };
          };
        }),
      undefined,
      { timeout: 8000 },
    );
    expect(await found.jsonValue()).toBe(true);
  });
});
