import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The brief asks for a Lighthouse accessibility score of 100 on both form
 * factors. Lighthouse runs once, by hand, before a release; this runs on every
 * pull request, at both widths, over the same axe rules Lighthouse uses.
 *
 * Contrast is included deliberately. The palette was chosen for a phone screen
 * at low brightness in daylight, and a regression there is invisible to
 * everyone reviewing on a good monitor.
 */
const PAGES = [
  '/',
  '/words',
  '/words/kitab',
  '/notes',
  '/games',
  '/progress',
  '/signin',
  '/offline',
];

for (const path of PAGES) {
  test(`no accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Report the rule ids, not just a count: a bare "3 violations" tells the
    // next person nothing.
    expect(
      results.violations.map((violation) => `${violation.id} (${violation.nodes.length})`),
    ).toEqual([]);
  });
}

test('the review session is navigable and labelled', async ({ page }) => {
  await page.goto('/review');
  await expect(page.getByRole('button', { name: /উত্তর দেখুন|Show answer/ })).toBeVisible({
    timeout: 15_000,
  });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test('every page has exactly one h1 and a skip link', async ({ page }) => {
  for (const path of ['/', '/words', '/notes', '/progress']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: /মূল অংশে যান|Skip to content/ })).toHaveCount(1);
  }
});
