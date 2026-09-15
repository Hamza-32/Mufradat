import { expect, test } from '@playwright/test';

/**
 * Pronunciation is the reason the audio exists, and there are two ways it
 * quietly stops working that a screenshot would not reveal.
 *
 * The first is a download manager. Extensions like IDM watch for media requests
 * and hijack them, so a learner who has one installed gets a "save this file?"
 * dialog instead of hearing the word. Fetching the bytes and playing a blob
 * sidesteps that, which is why the request must stay resourceType `fetch` and
 * the element must be handed a blob: URL — this test fails if anyone
 * "simplifies" it back to `new Audio(url)`.
 *
 * The second is the Content-Security-Policy: `media-src` has to admit blob:,
 * and a violation there is silent unless someone is watching the console.
 */
test.describe('pronunciation', () => {
  test('plays from memory rather than a hijackable media URL', async ({ page }) => {
    const mediaRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('.mp3')) mediaRequests.push(request.resourceType());
    });
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) {
        violations.push(message.text());
      }
    });

    await page.goto('/words');
    await page.addInitScript(() => undefined);

    // Record the src the element is actually asked to play.
    await page.evaluate(() => {
      (window as unknown as { __played: string[] }).__played = [];
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
        (window as unknown as { __played: string[] }).__played.push(this.src);
        return original.call(this);
      };
    });

    const button = page.getByRole('button', { name: 'উচ্চারণ শুনুন' }).first();
    await button.click();

    await expect
      .poll(async () =>
        page.evaluate(() => (window as unknown as { __played: string[] }).__played.length),
      )
      .toBeGreaterThan(0);

    const played = await page.evaluate(
      () => (window as unknown as { __played: string[] }).__played,
    );
    expect(played[0]).toMatch(/^blob:/u);
    expect(mediaRequests).toEqual(['fetch']);
    expect(violations).toEqual([]);

    // Still enabled means play() resolved; the button falls back to the
    // "no recording" label when it does not.
    await expect(button).toBeEnabled();
  });

  test('a second press replays without going back to the network', async ({ page }) => {
    await page.goto('/words');
    const button = page.getByRole('button', { name: 'উচ্চারণ শুনুন' }).first();
    await button.click();
    await expect(button).toBeEnabled();

    let refetched = 0;
    page.on('request', (request) => {
      if (request.url().includes('.mp3')) refetched += 1;
    });
    await button.click();
    await page.waitForTimeout(800);
    expect(refetched).toBe(0);
  });
});
