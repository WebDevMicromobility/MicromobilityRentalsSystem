import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Dashboard boxes above the Bookings filter show live per-status counts and act as one-tap filters.
test('queue dashboard boxes show counts and drive the status filter', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    queue_entries: [
      { id: 'w1', name: 'W1', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:00:00Z' },
      { id: 'w2', name: 'W2', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 2, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:01:00Z' },
      { id: 'a1', name: 'A1', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 3, status: 'active', paid: false, price: 30, registered_at: '2099-01-09T10:02:00Z' },
      { id: 'd1', name: 'D1', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 4, status: 'done', paid: true, price: 30, registered_at: '2099-01-09T10:03:00Z' },
    ],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const dash = page.locator('.q-dash');
  await expect(dash).toBeVisible();
  const boxes = dash.locator('button');
  await expect(boxes).toHaveCount(5); // All, Waiting, On Bike, Done, No-show
  await expect(boxes.nth(0)).toContainText('4'); // All (waiting+active+done+noshow)
  await expect(boxes.nth(1)).toContainText('2'); // Waiting
  await expect(boxes.nth(2)).toContainText('1'); // On Bike
  await expect(boxes.nth(3)).toContainText('1'); // Done

  // tapping the Waiting box sets the status filter
  await boxes.nth(1).click();
  expect(await page.evaluate('S.sfStatus')).toBe('waiting');
  await expect(page.locator('.q-dash button').nth(1)).toHaveAttribute('aria-pressed', 'true'); // active box highlighted
});

test('editing a bike with no colors array does not crash (latent bug found by chaos)', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await stubSupabase(page, {
    bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }], // no colors/color_names
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`startEdit('b1')`);
  expect(errs, errs.join('\n')).toEqual([]);
  expect(await page.evaluate('Array.isArray(S.addBikeColorNames) && S.addBikeColorNames.length')).toBe(1);
});
