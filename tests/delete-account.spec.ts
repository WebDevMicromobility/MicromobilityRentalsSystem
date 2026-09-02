import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Staff can delete a customer account. What goes is the login and everything personal hanging
// off it; what stays is the riding record, name and all, so rosters, close-outs and analytics
// read exactly as they did. The order matters more than it looks: queue_entries.customer_id is
// a real foreign key, so the bookings have to be unlinked BEFORE the account row goes, or
// Postgres refuses the delete and the staffer is left with a half-deleted account.

const sessions = [{
  id: '2099-07-05', day: 'Sunday', session_date: '2099-07-05', capacity: 9, status: 'open',
  created_at: 1, bike_slots: '{"_time":"21:00 - 23:00","_total":9}',
}];
const customers = [
  { id: 'c1', name: 'Gone Rider', email: 'gone@example.com', phone: '0551110000', created_at: 1 },
  { id: 'c2', name: 'Stays Rider', email: 'stays@example.com', phone: '0551110001', created_at: 2 },
];
const booking = (id: string, cust: string, status: string) => ({
  id, session_id: sessions[0].id, session_day: 'Sunday', session_date: '2099-07-05',
  queue_num: 3, name: 'Gone Rider', phone: '0551110000', customer_id: cust, size: 'M',
  type_preference: 'Road', status, paid: true, price: 75, registered_at: '2099-01-01T10:00:00Z',
});

/** Every write the client sent, in order, so the FK-safe sequence can be asserted. */
function watchWrites(page: import('@playwright/test').Page) {
  const calls: { method: string; table: string; body: string }[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/\/rest\/v1\/([^/?]+)/);
    if (!m || !['POST', 'PATCH', 'DELETE'].includes(r.method())) return;
    calls.push({ method: r.method(), table: m[1], body: r.postData() || '' });
  });
  return calls;
}

async function openEditor(page: import('@playwright/test').Page, queue_entries: Record<string, unknown>[], admin = true) {
  await stubSupabase(page, { sessions, customers, bikes: [], queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  if (!admin) await page.evaluate(`S.staffRole='frontdesk';S._isAdmin=false`);
  // The delete reads the rider's bookings to decide what to unlink, so wait for the queue to
  // be in memory — otherwise the test races the first load and proves nothing about linking.
  await page.waitForFunction(`getQueue().length>0`);
  await page.evaluate(`showEditCustomerModal('c1')`);
}

test('deletes the account, and unlinks the bookings first so the key holds', async ({ page }) => {
  await openEditor(page, [booking('b1', 'c1', 'done')]);
  const calls = watchWrites(page);

  await page.getByRole('button', { name: /Delete account/i }).click();
  await page.locator('#confirm-modal').getByRole('button', { name: /Delete account/i }).click();

  await expect.poll(() => calls.some((c) => c.table === 'customers' && c.method === 'DELETE')).toBe(true);
  const unlink = calls.findIndex((c) => c.table === 'queue_entries' && c.method === 'PATCH' && /"customer_id":null/.test(c.body));
  const del = calls.findIndex((c) => c.table === 'customers' && c.method === 'DELETE');
  expect(unlink).toBeGreaterThanOrEqual(0);
  expect(unlink).toBeLessThan(del);                    // unlink BEFORE delete, or the FK refuses
  // everything personal goes with it
  for (const table of ['customer_tags', 'push_subscriptions']) {   // notes were removed from the app
    expect(calls.some((c) => c.table === table && c.method === 'DELETE')).toBe(true);
  }
  // the booking row itself is never deleted — the riding record stays
  expect(calls.some((c) => c.table === 'queue_entries' && c.method === 'DELETE')).toBe(false);
});

test('refuses while the rider is on a live booking', async ({ page }) => {
  await openEditor(page, [booking('b1', 'c1', 'waiting')]);
  const calls = watchWrites(page);

  await page.getByRole('button', { name: /Delete account/i }).click();
  await expect(page.locator('.toast')).toContainText(/live booking/i);
  await page.waitForTimeout(300);
  expect(calls).toHaveLength(0);                       // nothing was written at all
  await expect(page.locator('#confirm-modal')).toBeHidden();
});

test('offers an undo that puts the account and its links back', async ({ page }) => {
  await openEditor(page, [booking('b1', 'c1', 'done')]);
  await page.getByRole('button', { name: /Delete account/i }).click();
  await page.locator('#confirm-modal').getByRole('button', { name: /Delete account/i }).click();
  await expect(page.locator('#undo-bar-btn')).toBeVisible();

  const calls = watchWrites(page);
  await page.locator('#undo-bar-btn').click();
  await expect.poll(() => calls.some((c) => c.table === 'customers' && c.method === 'POST')).toBe(true);
  // the re-link is a second, later write — poll for it rather than racing it
  await expect.poll(() => calls.some((c) => c.table === 'queue_entries' && /"customer_id":"c1"/.test(c.body))).toBe(true);
});

test('Front Desk never sees the button', async ({ page }) => {
  await openEditor(page, [booking('b1', 'c1', 'done')], false);
  await expect(page.getByRole('button', { name: /Delete account/i })).toHaveCount(0);
});
