import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A known staff device paints the last snapshot before the supabase-js script and the auth
// round trip, then the fresh load replaces it. Every visit after the first shows the roster
// at once, whatever the network is doing.
const sessions = [{ id: '2099-02-10', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
const queue_entries = [{ id: 'e1', session_id: '2099-02-10', session_day: 'Friday', session_date: '2099-02-10', queue_num: 1, name: 'Snapshot Rider', phone: '', customer_id: null, status: 'waiting', paid: false, price: 30, walk_in: true, registered_at: '2099-01-01T10:00:00Z', type_preference: 'Road', size: 'M' }];

test('the second visit paints the roster from the snapshot before any data request', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await expect.poll(() => page.evaluate('!!localStorage.getItem("cq_snapshot")')).toBe(true); // the first load saved it

  // Second visit: every data request is held back for three seconds.
  await page.route(/\/rest\/v1\//, async (route) => { await new Promise((r) => setTimeout(r, 3000)); await route.fallback(); });
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.locator('#tab-queue')).toContainText('Snapshot Rider', { timeout: 1500 });
  expect(Date.now() - t0).toBeLessThan(1500);
  await expect(page.locator('body')).toHaveClass(/view-staff/);
});
