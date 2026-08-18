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
