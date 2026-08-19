import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Add-on stock has ONE invariant, and it is easy to break by accident:
//
//   a booking holds its add-on stock exactly while it is CONFIRMED (waiting or active);
//   it holds none while waitlisted, cancelled, no-showed or removed.
//
// Every transition therefore has to consume or restock, and the pairing is spread across a
// dozen call sites. Removing the Promote button broke it in one move — promotion had been
// the only place a waitlisted booking reserved stock — and nothing failed loudly: the stock
// simply drifted upward on the next cancel, one unit at a time.
//
// These tests walk the transitions a rider actually goes through and assert the NET stock
// movement, so the next path that forgets its half fails here instead of in the store room.

const sess = {
  id: '2099-03-01', session_date: '2099-03-01', day: 'Sunday', status: 'open', capacity: 2,
  created_at: 1, bike_slots: '{"_time":"21:00 - 23:00","_total":2}', addons: '["inv1"]',
};
const inventory = [{ id: 'inv1', name: 'Energy Gel', category: 'Nutrition', price: 10, qty: 50, active: true }];
const entry = (id: string, n: number, status: string, extra: Record<string, unknown> = {}) => ({
  id, session_id: sess.id, session_day: 'Sunday', session_date: '2099-03-01', queue_num: n,
  name: 'Rider ' + n, size: 'M', type_preference: 'Road', status, paid: false, price: 75,
  addons: '["inv1"]', registered_at: '2099-01-01T10:00:00Z', ...extra,
});

/** Every stock level the client WROTE, in order. Asserting on the writes rather than on
 *  local state keeps this honest: a refetch would paper over a missing write. */
function watchStock(page: import('@playwright/test').Page) {
  const written: number[] = [];
  page.on('request', (r) => {
    if (!r.url().includes('/rest/v1/inventory') || r.method() !== 'PATCH') return;
    const m = (r.postData() || '').match(/"qty":\s*(-?\d+)/);
    if (m) written.push(Number(m[1]));
  });
  return written;
}

async function boot(page: import('@playwright/test').Page, rows: Record<string, unknown>[]) {
  await stubSupabase(page, { sessions: [sess], bikes: [], inventory, queue_entries: rows });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('queue');S.sfSession='${sess.id}';renderStaffQueue()`);
}

test.describe('a confirmed booking holds its add-on stock', () => {
  test('checking a WAITLISTED rider in reserves it — the case Promote used to cover', async ({ page }) => {
    await boot(page, [entry('w1', 1, 'waitlist', { waitlist_num: 1 })]);
    const written = watchStock(page);
    await page.evaluate(`(async()=>{S._ciId='w1';S._ciType='Road';S._ciPaid='pending';await confirmCheckinModal();})()`);
    await expect.poll(() => written).toEqual([49]); // one unit reserved, exactly once
  });

  test('a rider who never left the waitlist releases nothing when cancelled', async ({ page }) => {
    // The mirror image, and the one that inflates stock if a path forgets: a waitlisted
    // booking never reserved anything, so cancelling it must not hand a unit back.
    await boot(page, [entry('w1', 1, 'waitlist', { waitlist_num: 1 })]);
    const written = watchStock(page);
    await page.evaluate(`staffCancelEntry('w1')`); // a waitlisted row cancels without a dialog
    await page.waitForTimeout(400);
    expect(written).toEqual([]);
  });

  test('a confirmed rider no-showed gives the unit back', async ({ page }) => {
    await boot(page, [entry('q1', 1, 'waiting')]);
    const written = watchStock(page);
    await page.evaluate(`doNoShow('q1')`);
    await expect.poll(() => written).toEqual([51]);          // handed back while they are not riding
    // The undo half (they turn up after all) is not asserted here: the stub answers every GET
    // from the fixture, so the refetch after the no-show puts the row back to 'waiting' and a
    // second transition on the same row cannot be represented. One step per test instead.
  });

  test('a rider cancelled after checking in gives back exactly one', async ({ page }) => {
    await boot(page, [entry('q1', 1, 'waiting')]);
    const written = watchStock(page);
    await page.evaluate(`(async()=>{S._ciId='q1';S._ciType='Road';S._ciPaid='pending';await confirmCheckinModal();})()`);
    await page.waitForTimeout(200);
    expect(written).toEqual([]);                              // already reserved at booking: nothing to do
    await page.evaluate(`staffCancelEntry('q1')`);
    await page.locator('#confirm-modal').getByRole('button', { name: /cancel booking/i }).click();
    await expect.poll(() => written).toEqual([51]);           // released once, not twice
  });
});
