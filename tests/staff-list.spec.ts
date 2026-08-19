import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// "To staff list" (mwFromBooking) used to accept ONLY waitlisted bookings and return in
// silence for anything else — so on a normal queued booking the action simply did nothing
// and read as broken. It now takes any booking that has not ridden yet, and says why when
// it refuses. The insert itself is RLS-gated on is_staff(), so a device whose Auth session
// has lapsed gets a denial — which the error bar now reports rather than swallowing.

const D = '2099-02-08';
const sessions = [{
  id: 's0', day: 'Sunday', session_date: D, capacity: 9, status: 'open',
  created_at: 1, bike_slots: null, location: 'JCC', addons: null,
}];
const qe = (id: string, num: number, extra: Record<string, unknown>) => ({
  id, session_id: 's0', session_day: 'Sunday', session_date: D, queue_num: num,
  name: `Rider ${num}`, phone: `05000000${num}`, customer_id: null,
  type_preference: 'Hybrid', registered_at: '2099-01-01T10:00:00Z', ...extra,
});
const queue_entries = [
  qe('e-wait', 1, { status: 'waiting', paid: false, price: 60 }),
  qe('e-wl', 2, { status: 'waitlist', paid: false, price: 60, waitlist_num: 1 }),
  qe('e-done', 3, { status: 'done', paid: true, price: 60 }),
];

async function boot(page: import('@playwright/test').Page, failWrite?: Parameters<typeof stubSupabase>[2]) {
  await stubSupabase(page, { sessions, queue_entries, desk_waitlist: [] }, failWrite);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
}

/** Rows the client tried to add to the staff list. */
function watchInserts(page: import('@playwright/test').Page) {
  const rows: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/desk_waitlist')) {
      const b = r.postDataJSON();
      (Array.isArray(b) ? b : [b]).forEach((x: Record<string, unknown>) => rows.push(x));
    }
  });
  return rows;
}

test.describe('adding a booking to the staff list', () => {
  test('a plain queued booking can be added — it used to do nothing at all', async ({ page }) => {
    await boot(page);
    const rows = watchInserts(page);
    await page.evaluate(`mwFromBooking('e-wait')`);
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].booking_id).toBe('e-wait');
    expect(rows[0].kind).toBe('managed');
  });

  test('a waitlisted booking still works, as before', async ({ page }) => {
    await boot(page);
    const rows = watchInserts(page);
    await page.evaluate(`mwFromBooking('e-wl')`);
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].booking_id).toBe('e-wl');
  });

  test('a booking that already rode is refused out loud, not silently', async ({ page }) => {
    await boot(page);
    const rows = watchInserts(page);
    await page.evaluate(`mwFromBooking('e-done')`);
    await expect(page.locator('.toast')).toContainText(/staff list/i);
    expect(rows).toHaveLength(0);
  });

  test('adding the same booking twice is refused', async ({ page }) => {
    await boot(page);
    const rows = watchInserts(page);
    await page.evaluate(`(async () => { await mwFromBooking('e-wait'); await mwFromBooking('e-wait'); })()`);
    await expect.poll(() => rows.length).toBe(1); // the second attempt never reaches the server
  });

  test('an RLS denial is reported instead of looking like nothing happened', async ({ page }) => {
    // What a staff device with a lapsed Auth session hits: the policy is is_staff().
    await boot(page, { table: 'desk_waitlist' });
    await page.evaluate(`mwFromBooking('e-wait')`);
    await expect(page.locator('#err-bar-el')).toBeVisible();
    await expect(page.locator('#err-bar-el')).toContainText(/session may have expired/i);
  });

  test('the button is offered on queued rows, not only waitlisted ones', async ({ page }) => {
    await boot(page);
    await page.evaluate(`setStaffTab('queue')`);
    await page.waitForTimeout(300);
    const html = await page.evaluate(`document.getElementById('q-results').innerHTML`) as string;
    expect(html).toContain(`mwFromBooking('e-wait')`);
    expect(html).toContain(`mwFromBooking('e-wl')`);
  });
});

// The section could only take a hand-typed name: everything staff wanted to park there —
// a queued booking, a waitlisted one, a regular who walked in — had to be retyped. The
// name field is now a search over all three, and the browse button lists every addable
// booking without typing anything.

const customers = [
  { id: 'c1', name: 'Salma Nour', phone: '0551112222', type_preference: 'Road', created_at: 1 },
  { id: 'c2', name: 'Rider 1', phone: '050000001', type_preference: 'Hybrid', created_at: 2 },
];

async function openStaffList(page: import('@playwright/test').Page) {
  await page.evaluate(`(()=>{ setStaffTab('queue'); S.queueView='managed'; renderStaffQueue(); })()`);
  await page.locator('#mw-name').waitFor();
}

test.describe('finding riders to put on the staff list', () => {
  async function bootWithCustomers(page: import('@playwright/test').Page) {
    await stubSupabase(page, { sessions, queue_entries, desk_waitlist: [], customers });
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await openStaffList(page);
  }

  test('browse lists every addable booking, waitlisted ones first', async ({ page }) => {
    await bootWithCustomers(page);
    await page.locator('#mw-browse').click();
    const rows = page.locator('#mw-suggest .mw-sug');
    await expect(rows).toHaveCount(2);          // the booking that already rode is not offered
    await expect(rows.first()).toContainText('Rider 2'); // waitlisted before queued
    await expect(rows.nth(1)).toContainText('Rider 1');
  });

  test('picking from the picker parks the booking, and browsing stays open', async ({ page }) => {
    await bootWithCustomers(page);
    const rows = watchInserts(page);
    await page.locator('#mw-browse').click();
    await page.locator('#mw-suggest .mw-sug').first().click();
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].booking_id).toBe('e-wl');
    // still open for the next pick, minus the one just added
    await expect(page.locator('#mw-suggest .mw-sug')).toHaveCount(1);
  });

  test('typing a name searches bookings; a customer with no booking is offered too', async ({ page }) => {
    await bootWithCustomers(page);
    await page.locator('#mw-name').fill('Salma');
    const rows = page.locator('#mw-suggest .mw-sug');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Salma Nour');
    // a customer who is already on the queue is offered as the booking, not twice
    await page.locator('#mw-name').fill('Rider 1');
    await expect(page.locator('#mw-suggest .mw-sug')).toHaveCount(1);
    await expect(page.locator('#mw-suggest .mw-sug')).toContainText('#1');
  });

  test('adding a customer writes a walk-up style row, not a linked booking', async ({ page }) => {
    await bootWithCustomers(page);
    const rows = watchInserts(page);
    await page.locator('#mw-name').fill('Salma');
    await page.locator('#mw-suggest .mw-sug').first().click();
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].name).toBe('Salma Nour');
    expect(rows[0].kind).toBe('managed');
    expect(rows[0].booking_id).toBeUndefined();
    expect(rows[0].bike_type).toBe('Road');
    await expect(page.locator('#mw-name')).toHaveValue(''); // search resets for the next rider
  });

  test('nothing to add says so instead of showing an empty box', async ({ page }) => {
    await bootWithCustomers(page);
    await page.locator('#mw-name').fill('zzzz');
    await expect(page.locator('#mw-suggest .mw-sug-empty')).toBeVisible();
  });

  test('a booking already on the list is not offered again', async ({ page }) => {
    await stubSupabase(page, {
      sessions, queue_entries, customers,
      desk_waitlist: [{ id: 'w1', name: 'Rider 2', phone: '05000002', bike_type: 'Hybrid',
        status: 'waiting', kind: 'managed', sort_order: 1, booking_id: 'e-wl', created_at: '2099-01-01T10:00:00Z' }],
    });
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await openStaffList(page);
    await page.locator('#mw-browse').click();
    const rows = page.locator('#mw-suggest .mw-sug');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Rider 1');
  });
});
