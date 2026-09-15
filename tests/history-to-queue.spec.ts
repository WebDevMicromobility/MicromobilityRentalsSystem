import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// History's Return to queue: a completed, no-show or cancelled booking goes back to waiting,
// so the booth can check the rider in again from the queue page. A removed row keeps its
// Restore button instead.

const S1 = '2099-01-09';
const sessions = [{ id: S1, day: 'Friday', session_date: S1, capacity: 12, status: 'open', created_at: 1 }];
const bikes = [{ id: 'b1', name: 'R-11', type: 'Road', size: 'M', status: 'available', colors: [] }];
const row = (id: string, n: number, x: Record<string, unknown> = {}) => ({
  id, name: 'Rider ' + id, session_id: S1, session_day: 'Friday', session_date: S1, queue_num: n, status: 'waiting', paid: false,
  price: 75, registered_at: S1 + 'T10:00:00Z', type_preference: 'Road', size: 'M', phone: '05500000' + n, ...x });
const rows = [
  row('w1', 1),
  row('d1', 2, { status: 'done', paid: true, assigned_bike_id: 'b1', checked_in_at: S1 + 'T16:00:00Z', checked_out_at: S1 + 'T16:40:00Z', ride_duration: 40 }),
  row('n1', 3, { status: 'noshow' }),
  row('c1', 4, { status: 'cancelled', cancelled_by: 'staff' }),
  row('r1', 5, { status: 'removed' }),
];

async function boot(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, bikes, queue_entries: rows });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('history');S.histView='rides';S.histSess='all';S.histStatus='all';S.histRange='all';renderHistory()`);
}
const histRow = (page: import('@playwright/test').Page, name: string) => page.locator('#tab-history tbody tr').filter({ hasText: name });

function watchPatches(page: import('@playwright/test').Page, id: string) {
  const patches: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries') && r.url().includes('id=eq.' + id)) patches.push(r.postDataJSON());
  });
  return patches;
}

test('every finished row offers Return to queue; a removed row offers Restore', async ({ page }) => {
  await boot(page);
  for (const id of ['d1', 'n1', 'c1']) await expect(histRow(page, 'Rider ' + id).getByRole('button', { name: 'Return to queue' })).toHaveCount(1);
  await expect(histRow(page, 'Rider r1').getByRole('button', { name: 'Return to queue' })).toHaveCount(0);
  await expect(histRow(page, 'Rider r1').getByRole('button', { name: 'Restore' })).toHaveCount(1);
  await expect(page.locator('#tab-history')).not.toContainText('Rider w1');   // the queue's own rows are not history
});

test('a completed ride goes back to waiting with a clean bike link and ride stamps, keeping its number', async ({ page }) => {
  await boot(page);
  const patches = watchPatches(page, 'd1');
  await histRow(page, 'Rider d1').getByRole('button', { name: 'Return to queue' }).click();
  await expect.poll(() => patches.length).toBeGreaterThan(0);
  expect(patches[0]).toEqual({ status: 'waiting', queue_num: 2, assigned_bike_id: null, checked_in_at: null, checked_out_at: null, ride_duration: null });
  await expect(page.locator('.toast, [role="status"]').filter({ hasText: '#2 Rider d1 is back in the queue' }).first()).toBeVisible();
  // The History log records it, with an undo that puts every field back.
  await page.evaluate(`S.showHistLog=true;renderHistory()`);
  await expect(page.locator('#tab-history')).toContainText('Returned to queue');
  await page.getByRole('button', { name: /Undo/ }).first().click();
  await expect.poll(() => patches.length).toBeGreaterThan(1);
  expect(patches[patches.length - 1]).toEqual({ status: 'done', queue_num: 2, assigned_bike_id: 'b1', checked_in_at: S1 + 'T16:00:00Z', checked_out_at: S1 + 'T16:40:00Z', ride_duration: 40 });
});

test('a no-show and a cancellation go back through their own restore paths', async ({ page }) => {
  await boot(page);
  const n = watchPatches(page, 'n1');
  await histRow(page, 'Rider n1').getByRole('button', { name: 'Return to queue' }).click();
  await expect.poll(() => n.length).toBeGreaterThan(0);
  expect(n[0]).toEqual({ status: 'waiting' });                              // the no-show keeps its own number
  const c = watchPatches(page, 'c1');
  await histRow(page, 'Rider c1').getByRole('button', { name: 'Return to queue' }).click();
  await expect.poll(() => c.length).toBeGreaterThan(0);
  expect(c[0]).toEqual({ status: 'waiting', queue_num: 4 });
});

test('at capacity, a cancelled booking asks before it comes back', async ({ page }) => {
  await boot(page);
  await page.evaluate(`S.sessions.find(s=>s.id==='${S1}').capacity=2`);    // w1 + d1 hold the two places
  const c = watchPatches(page, 'c1');
  await histRow(page, 'Rider c1').getByRole('button', { name: 'Return to queue' }).click();
  await expect(page.getByText('Session is full')).toBeVisible();
  expect(c.length).toBe(0);
  await page.locator('.modal-backdrop:visible, .modal:visible').getByRole('button', { name: 'Return to queue' }).first().click();
  await expect.poll(() => c.length).toBeGreaterThan(0);
  expect(c[0]).toEqual({ status: 'waiting', queue_num: 4 });
});
