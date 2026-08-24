import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Checking a rider in should be the quickest thing at the desk. Two things stood in the way.
//
// A WAITLISTED rider was bounced to the classic bike-picker — a full-height modal — because
// showCheckinModal only accepted 'waiting'. That predates removing Promote, which made
// checking in the way a rider leaves the waitlist; on the Staff List, where waitlisted riders
// are exactly who is parked, it meant the fast path was never available.
//
// And a rebuild restored the scroll on the next frame, before the new rows had laid out, so
// the browser clamped it against a briefly-shorter page and the roster jumped to the top.

const sess = {
  id: '2099-09-06', session_date: '2099-09-06', day: 'Sunday', status: 'open', capacity: 6,
  created_at: 1, bike_slots: '{"_time":"21:00 - 23:00","_total":6}',
};
const other = { ...sess, id: '2099-09-09', session_date: '2099-09-09', day: 'Wednesday' };
const qe = (i: number, status: string) => ({
  id: 'e' + i, session_id: sess.id, session_day: 'Sunday', session_date: '2099-09-06',
  queue_num: i, waitlist_num: status === 'waitlist' ? i : null, name: 'Rider ' + i, size: 'M',
  type_preference: 'Road', status, paid: false, price: 75, registered_at: '2099-01-01T10:00:00Z',
});
const bikes = [{ id: 'b1', name: 'R1', size: 'M', type: 'Road', status: 'available', rental_price: 75 }];

async function boot(page: import('@playwright/test').Page, fixtures: Record<string, unknown>) {
  await stubSupabase(page, { sessions: [sess], bikes, ...fixtures });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
}

const shown = (page: import('@playwright/test').Page) => page.evaluate(
  `({quick:document.getElementById('checkin-modal').style.display,classic:document.getElementById('bike-modal').style.display})`,
) as Promise<{ quick: string; classic: string }>;

test('a waitlisted rider gets the brief modal, like everyone else', async ({ page }) => {
  await boot(page, { queue_entries: [qe(1, 'waitlist')] });
  await page.evaluate(`showCheckinModal('e1')`);
  expect(await shown(page)).toEqual({ quick: 'flex', classic: 'none' });
  // and it is the real thing: payment and bike type, the two decisions at the desk
  await expect(page.locator('#checkin-modal')).toContainText(/payment/i);
});

test('a rider already on a bike still gets the full picker', async ({ page }) => {
  await boot(page, { queue_entries: [qe(1, 'active')] });
  await page.evaluate(`showCheckinModal('e1')`);
  expect(await shown(page)).toEqual({ quick: 'none', classic: 'flex' });
});

test('the roster keeps its place when a check-in rebuilds it', async ({ page }) => {
  const rows = Array.from({ length: 14 }, (_, i) => qe(i + 1, 'waiting'));
  await boot(page, { queue_entries: rows });
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.evaluate(`setStaffTab('queue');S.sfSession='${sess.id}';renderStaffQueue()`);
  await page.evaluate(`window.scrollTo(0,700)`);
  const before = await page.evaluate('window.scrollY') as number;
  expect(before).toBeGreaterThan(100);                       // the page really is scrolled
  await page.evaluate(`(async()=>{S._ciId='e9';S._ciType='Road';S._ciPaid='pending';await confirmCheckinModal();})()`);
  await page.waitForTimeout(700);
  expect(await page.evaluate('window.scrollY') as number).toBeGreaterThan(before - 60);
});

test('a walk-up handed a bike goes to the session the Staff List is aimed at', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [sess, other], bikes, queue_entries: [],
    desk_waitlist: [{
      id: 'm1', name: 'Walk Up', phone: '0500000000', bike_type: 'Road', status: 'waiting',
      kind: 'managed', sort_order: 1, booking_id: null, created_at: '2099-01-01T11:00:00Z',
    }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const inserts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) inserts.push(r.postData() || '');
  });
  await page.evaluate(`setStaffTab('queue');S.queueView='managed';mwSetSess('2099-09-09');`);
  await page.evaluate(`giveDeskBike('m1')`);
  await expect.poll(() => inserts.length).toBe(1);
  expect(inserts[0]).toContain('2099-09-09');               // not "the first open session"
});
