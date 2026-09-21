import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Every ride's roster shows when each booking was made, under its number, the way the Saturday
// Social Ride always has. A party shows when its booking was made: its earliest rider, not a
// companion added later. Times are Riyadh's, whatever the desk's clock says.
const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
const row = (id: string, qn: number, name: string, registered_at: string, group_id: string | null = null) => ({
  id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn,
  name, phone: '', customer_id: null, group_id, status: 'waiting', paid: false,
  type_preference: 'Hybrid', price: 57.5, walk_in: false, registered_at,
});
const queue_entries = [
  row('e1', 1, 'Solo One', '2099-01-01T10:05:00Z'),         // 13:05 in Riyadh
  row('e2', 2, 'Party Lead', '2099-01-02T11:00:00Z', 'g1'), // 14:00: when the party booked
  row('e3', 3, 'Party Late', '2099-01-02T17:30:00Z', 'g1'), // added later that evening
];

async function roster(page: Page) {
  await stubSupabase(page, { queue_entries, sessions });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.staffTab='queue';renderStaffQueue()`);
}

test('every booking on the roster shows when it was made', async ({ page }) => {
  await roster(page);
  const times = page.locator('#tab-queue .q-booked-at').filter({ visible: true });
  await expect(times).toHaveText(['1 Jan · 13:05', '2 Jan · 14:00']);
  await expect(times.first()).toHaveAttribute('title', 'Reserved at');
});

test('an open party still shows one booking time, the one it booked at', async ({ page }) => {
  await roster(page);
  await page.evaluate(`S._partyExpandAll=true;renderStaffQueue()`);
  await expect(page.locator('#tab-queue').getByText('Party Late').filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('#tab-queue .q-booked-at').filter({ visible: true })).toHaveText(['1 Jan · 13:05', '2 Jan · 14:00']);
});
