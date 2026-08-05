import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// Customer-page back navigation: a visible Back button (wizard step back, else the
// landing event picker) and a working browser Back (history states are deduped and
// carry the chosen event + wizard step).

const fixtures = {
  sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, location: 'JCC' }],
  bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }],
  queue_entries: [],
};

test('the Back button returns from the customer page to the landing event picker', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);

  // signed-in boot lands on the Reserve tab; the Back button is visible there
  await expect(page.locator('#cust-back-btn')).toBeVisible();
  await page.locator('#cust-back-btn').click();
  await page.waitForFunction(`S.view==='landing'`);
  // both event cards always render (the Saturday card shows even with no community session)
  await expect(page.locator('#land-events .landing-event-card')).toHaveCount(2);
});

test('browser Back returns from the customer page to the landing', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate('goLanding()');

  await page.locator('#land-events .landing-event-card').first().click();
  await page.waitForFunction(`S.view==='customer'`);

  await page.goBack();
  await page.waitForFunction(`S.view==='landing'`);
  await expect(page.locator('#land-events .landing-event-card')).toHaveCount(2);
});

test('Back walks the Reserve wizard steps (button and browser alike)', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setCustTab('register')`);

  await page.locator('.sess-card').first().click();
  await page.locator('#tab-register .mm-reg-foot button', { hasText: 'Continue' }).click();
  await page.waitForFunction('S.regStep===2');

  // browser Back: step 2 -> step 1 (not out of the app)
  await page.goBack();
  await page.waitForFunction('S.regStep===1');

  // forward again, then the visible Back button does the same
  await page.locator('#tab-register .mm-reg-foot button', { hasText: 'Continue' }).click();
  await page.waitForFunction('S.regStep===2');
  await page.locator('#cust-back-btn').click();
  await page.waitForFunction('S.regStep===1');
  expect(await page.evaluate('S.view')).toBe('customer');
});
