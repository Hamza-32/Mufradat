import { expect, test } from '@playwright/test';

/**
 * Guest mode is the default path, so it is the one tested hardest: a learner
 * must be able to reach the app without an account, and a signed-out visitor
 * must never see an account page.
 */

test('a visitor can start without signing in', async ({ page }) => {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const guest = page.getByRole('link', { name: /সাইন ইন ছাড়াই|without signing in/ });
  await expect(guest).toBeVisible();
  await guest.click();
  await expect(page).toHaveURL('/');
});

test('the account page is not reachable while signed out', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/signin/);
});

test('the migration endpoint refuses an unauthenticated caller', async ({ request }) => {
  const response = await request.post('/api/account/migrate-guest', {
    data: {
      guestId: 'aaaaaaaaaaaaaaaa',
      final: true,
      settings: null,
      cards: [],
      logs: [],
      games: [],
      notes: [],
    },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).error.code).toBe('unauthorized');
});

test('the migration endpoint rejects a malformed payload before touching the database', async ({
  request,
}) => {
  const response = await request.post('/api/account/migrate-guest', {
    data: { guestId: 'short', final: 'yes' },
  });
  // 401 first for an anonymous caller — auth is checked before validation, so
  // an unauthenticated prober learns nothing about the schema.
  expect(response.status()).toBe(401);
});
