import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The Bookings status filter should use the same wording as the stat boxes:
// Expected (waiting), On Bike (active), Completed (done).
test('status filter labels match the dashboard boxes', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    queue_entries: [{ id: 'q1', name: 'R', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:00:00Z' }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const opts = await page.evaluate(`[...document.querySelectorAll('#tab-queue .filter-select')].flatMap(s=>[...s.options].map(o=>o.textContent))`);
  const set = new Set(opts as string[]);
  expect(set.has('Expected')).toBe(true);   // was "Waiting"
  expect(set.has('Completed')).toBe(true);  // was "Done"
  expect(set.has('On Bike')).toBe(true);
  expect(set.has('Waiting')).toBe(false);   // old label gone
  expect(set.has('Done')).toBe(false);
  // filtering by value still works
  await page.evaluate(`setSfStatus('done')`);
  expect(await page.evaluate('S.sfStatus')).toBe('done');
});
