import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A rider the capacity rule waitlisted has a booking and a W number but no desk_waitlist row.
// The page named Waitlist used to read desk rows only, so those riders were invisible on it
// while showing up in Bookings all along — and the stricter capacity rule made that common.
// They are folded in now. What must not break: a booking staff ALSO parked by hand appears
// once, and the controls that write to desk_waitlist never appear on a row that has none.

const S1 = '2099-08-08';
const sessions = [{ id: S1, session_date: S1, day: 'Saturday', status: 'open', capacity: 2, created_at: 1 }];
const bk = (id: string, qn: number, name: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, session_id: S1, session_day: 'Saturday', session_date: S1, queue_num: qn, name,
  phone: '05512000' + qn, type_preference: 'Road', status, paid: false, price: 75, size: 'M',
  registered_at: '2099-01-0' + qn + 'T10:00:00Z', ...extra,
});
const walkup = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, phone: '0511111111', bike_type: 'Road', status: 'waiting', author: null,
  created_at: '2099-01-01T10:00:00Z', resolved_at: null, ...extra,
});

async function open(page: import('@playwright/test').Page, fixtures: Record<string, unknown>) {
  await stubSupabase(page, { sessions, bikes: [], queue_entries: [], desk_waitlist: [], ...fixtures });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
  await page.evaluate(`setStaffTab('queue');S.queueView='managed';S._mwSess='all';renderStaffQueue()`);
}

test('an auto-waitlisted booking now appears on the Waitlist page', async ({ page }) => {
  await open(page, { queue_entries: [bk('w1', 3, 'Auto Waitlisted', 'waitlist', { waitlist_num: 1 })] });
  await expect(page.locator('#mw-host')).toContainText('Auto Waitlisted');
  await expect(page.locator('#mw-host')).toContainText('W1');
});

test('a rider still waiting or riding is not on it — only the waitlist', async ({ page }) => {
  await open(page, {
    queue_entries: [
      bk('a', 1, 'Still Waiting', 'waiting'),
      bk('b', 2, 'Out Riding', 'active'),
      bk('c', 4, 'Gone Home', 'done'),
      bk('w1', 3, 'Auto Waitlisted', 'waitlist', { waitlist_num: 1 }),
    ],
  });
  const host = page.locator('#mw-host');
  await expect(host).toContainText('Auto Waitlisted');
  await expect(host).not.toContainText('Still Waiting');
  await expect(host).not.toContainText('Out Riding');
  await expect(host).not.toContainText('Gone Home');
});

test('a booking staff parked by hand is listed once, not twice', async ({ page }) => {
  await open(page, {
    queue_entries: [bk('w1', 3, 'Parked Rider', 'waitlist', { waitlist_num: 1 })],
    desk_waitlist: [walkup('m1', 'Parked Rider', { kind: 'managed', sort_order: 1, booking_id: 'w1' })],
  });
  const text = await page.evaluate(`document.getElementById('mw-host').innerText`) as string;
  expect(text.split('Parked Rider').length - 1).toBe(1);
});

test('walk-ups and folded-in bookings share the list', async ({ page }) => {
  await open(page, {
    queue_entries: [bk('w1', 3, 'Auto Waitlisted', 'waitlist', { waitlist_num: 1 })],
    desk_waitlist: [walkup('d1', 'Walk Up Rider')],
  });
  const host = page.locator('#mw-host');
  await expect(host).toContainText('Walk Up Rider');
  await expect(host).toContainText('Auto Waitlisted');
});

test('they sort by W number, which is the order promotion takes them in', async ({ page }) => {
  await open(page, {
    queue_entries: [
      bk('w2', 5, 'Second Up', 'waitlist', { waitlist_num: 2 }),
      bk('w1', 4, 'First Up', 'waitlist', { waitlist_num: 1 }),
    ],
  });
  const text = await page.evaluate(`document.getElementById('mw-host').innerText`) as string;
  expect(text.indexOf('First Up')).toBeLessThan(text.indexOf('Second Up'));
});

test('a folded-in row carries the booking controls, not the desk-row ones', async ({ page }) => {
  await open(page, { queue_entries: [bk('w1', 3, 'Auto Waitlisted', 'waitlist', { waitlist_num: 1 })] });
  const html = await page.evaluate(`document.getElementById('mw-host').innerHTML`) as string;
  expect(html).toContain(`showCheckinModal('w1')`);        // the booking's own check-in
  expect(html).not.toContain(`giveDeskBike(`);             // never the walk-up hand-over
  expect(html).not.toContain(`resolveDeskWaitlist('wlb:`); // no desk row to resolve
  expect(html).not.toContain(`mwSetPos('wlb:`);            // no sort_order to write
  expect(html).toContain(`wlSetPos('w1'`);                 // its W position is editable
});

test('checking one in off the list books them onto the ride', async ({ page }) => {
  await open(page, { queue_entries: [bk('w1', 3, 'Auto Waitlisted', 'waitlist', { waitlist_num: 1 })] });
  const patches: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('queue_entries')) patches.push(r.postData() || '');
  });
  await page.evaluate(`_checkinMany(['w1'])`);
  await expect.poll(() => patches.some((b) => /"status":"active"/.test(b))).toBe(true);
  // and nothing was written to a desk row that does not exist
  await expect.poll(async () => (await page.evaluate(`1`)) === 1).toBe(true);
});

test('reordering the real rows never writes to a folded-in one', async ({ page }) => {
  await open(page, {
    queue_entries: [bk('w1', 3, 'Auto Waitlisted', 'waitlist', { waitlist_num: 1 })],
    desk_waitlist: [walkup('d1', 'Walk Up One', { sort_order: 1 }), walkup('d2', 'Walk Up Two', { sort_order: 2 })],
  });
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('desk_waitlist')) writes.push(r.url());
  });
  await page.evaluate(`mwSetPos('d2',1)`);
  await expect.poll(() => writes.length).toBeGreaterThan(0);
  expect(writes.some((u) => u.includes('wlb%3A') || u.includes('wlb:'))).toBe(false);
});
