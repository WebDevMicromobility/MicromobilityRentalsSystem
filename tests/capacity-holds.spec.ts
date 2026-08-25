import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, unlockStaff, waitForSb, captureBookingRows } from './helpers/supabase';

// The number staff put in is the number of riders, full stop. A place is taken when it is
// booked and given back only when the booking is CANCELLED — not when the rider checks in, not
// when they finish, and not when they are marked no-show (they took a place and did not come,
// which is a loss, not a vacancy). The old rule let places quietly reappear as the evening went
// on, so the waitlist "started late" and a 4-bike session served more than four people.

const sess = {
  id: '2099-12-06', day: 'Sunday', session_date: '2099-12-06', capacity: 4, status: 'open',
  created_at: 1, bike_slots: '{"_time":"21:00 - 23:00","_total":4}',
};
const bikes = [{ id: 'b1', name: 'R1', size: 'M', type: 'Road', status: 'available', rental_price: 75 }];
const row = (id: string, n: number, status: string, extra: Record<string, unknown> = {}) => ({
  id, session_id: sess.id, session_day: 'Sunday', session_date: '2099-12-06', queue_num: n,
  name: 'Rider ' + n, size: 'M', type_preference: 'Road', status, paid: false, price: 75,
  registered_at: '2099-01-01T10:00:00Z', ...extra,
});

const spots = (page: import('@playwright/test').Page) =>
  page.evaluate(`spotsLeft('${sess.id}')`) as Promise<number>;

async function staff(page: import('@playwright/test').Page, rows: Record<string, unknown>[]) {
  await stubSupabase(page, { sessions: [sess], bikes, queue_entries: rows });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
}

test.describe('a place is held until the booking is cancelled', () => {
  test('four bookings fill a four-bike session, whatever state they reach', async ({ page }) => {
    await staff(page, [
      row('a', 1, 'waiting'), row('b', 2, 'active'), row('c', 3, 'done'), row('d', 4, 'noshow'),
    ]);
    expect(await spots(page)).toBe(0); // checked in, finished and no-showed all still hold theirs
  });

  test('cancelling gives exactly one back', async ({ page }) => {
    await staff(page, [row('a', 1, 'waiting'), row('b', 2, 'active'), row('c', 3, 'cancelled'), row('d', 4, 'removed')]);
    expect(await spots(page)).toBe(2); // the two live ones hold; cancelled and removed do not
  });

  test('a rider on their own bike takes no place', async ({ page }) => {
    await staff(page, [row('a', 1, 'waiting'), row('b', 2, 'waiting', { type_preference: 'Own' })]);
    expect(await spots(page)).toBe(3);
  });

  test('the roster agrees with the booking form about how full it is', async ({ page }) => {
    await staff(page, [row('a', 1, 'done'), row('b', 2, 'noshow')]);
    await page.evaluate(`setStaffTab('queue');S.queueView='sessions';renderStaffQueue()`);
    const html = await page.evaluate(`document.getElementById('tab-queue').innerHTML`) as string;
    expect(html).toContain('2');            // two of four taken on the session card
    expect(await spots(page)).toBe(2);      // and the same number underneath
  });
});

test('a rider booking into a full session is waitlisted, even after riders finish', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [sess], bikes,
    queue_entries: [row('a', 1, 'done'), row('b', 2, 'done'), row('c', 3, 'noshow'), row('d', 4, 'active')],
  });
  await loginCustomer(page, { id: 'c1', name: 'Late Rider' });
  await page.goto('/');
  await waitForSb(page);
  const rows = await captureBookingRows(page);
  await page.evaluate(
    `S.selSession='${sess.id}'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Road'];
     S.regRiderNames=['Late Rider']; S.promoApplied=null; submitReg();`,
  );
  await expect.poll(() => rows.length).toBe(1);
  expect(rows[0].status).toBe('waitlist');
});

test('a no-show no longer promotes; a cancellation does', async ({ page }) => {
  const withWaitlist = [row('a', 1, 'waiting'), row('b', 2, 'waiting'), row('c', 3, 'waiting'),
    row('d', 4, 'waiting'), row('w', 5, 'waitlist', { waitlist_num: 1 })];
  await staff(page, withWaitlist);
  const patches: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('queue_entries')) patches.push(r.postData() || '');
  });

  await page.evaluate(`doNoShow('a')`);
  await page.waitForTimeout(500);
  expect(patches.some((b) => /"status":"noshow"/.test(b))).toBe(true);
  expect(patches.some((b) => /"status":"waiting"/.test(b))).toBe(false); // nobody promoted

  patches.length = 0;
  await page.evaluate(`staffCancelEntry('b')`);
  await page.locator('#confirm-modal').getByRole('button', { name: /cancel booking/i }).click();
  await expect.poll(() => patches.some((b) => /"status":"cancelled"/.test(b))).toBe(true);
  await expect.poll(() => patches.some((b) => /"status":"waiting"/.test(b))).toBe(true); // the freed place is filled
});
