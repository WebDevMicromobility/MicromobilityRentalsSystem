import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

const fixtures = {
  sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, location: 'JCC' }],
  bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }],
  queue_entries: [],
};

test('booking flow shows a 1-2-3 progress stepper that advances', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setCustTab('register')`);

  const stepper = page.locator('#tab-register .reg-stepper');
  await expect(stepper).toBeVisible();
  await expect(stepper).toHaveAttribute('aria-label', '1 / 3'); // on step 1
  await expect(stepper).toContainText('Session');               // active label

  // advance to step 2
  await page.locator('.sess-card').first().click();
  await page.locator('#tab-register .mm-reg-foot button', { hasText: 'Continue' }).click();
  await expect(page.locator('#tab-register .reg-stepper')).toHaveAttribute('aria-label', '2 / 3');
  await expect(page.locator('#tab-register .reg-stepper')).toContainText('Riders');
});

test('the step action buttons are in a sticky footer bar', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setCustTab('register')`);
  // step 1 Continue lives in the sticky footer
  const foot = page.locator('#tab-register .mm-reg-foot');
  await expect(foot).toBeVisible();
  await expect(foot.locator('button', { hasText: 'Continue' })).toBeVisible();
});
