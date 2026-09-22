import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Handing a bike over is two writes: the bike goes in-use, then the booking goes active one
// round trip later, and the bike's realtime event repaints every roster in between. The roster
// used to free every in-use bike it could not see a rider on - on sight - so a staff screen
// painted in that gap wrote 'available' for a bike a rider was being handed. A candidate now
// waits out a grace period and the database is asked before the write.

const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
const entry = (status: string) => ({
  id: 'e1', session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: 1, name: 'Rider A',
  phone: '0511111111', customer_id: null, type_preference: 'Road', status, paid: false, price: 30,
  registered_at: '2099-01-01T10:00:00Z', assigned_bike_id: 'b1',
});
const bikes = [{ id: 'b1', name: 'R-01', type: 'Road', size: 'M', status: 'in-use', colors: [] }];

async function boot(page: import('@playwright/test').Page, serverStatus: string) {
  await stubSupabase(page, { sessions, queue_entries: [entry(serverStatus)], bikes });
  await unlockStaff(page);
  const bikePatches: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/bikes')) bikePatches.push(r.postDataJSON());
  });
  await page.goto('/');
  await waitForSb(page);
  return bikePatches;
}

test('a bike mid-hand-over is not freed by a roster repaint', async ({ page }) => {
  const bikePatches = await boot(page, 'waiting'); // reserved bike already in-use, booking not active yet
  await page.evaluate(`S.staffTab='queue';S.queueView='bookings';renderStaffQueue();renderStaffQueue();`);
  await page.waitForTimeout(1200);
  expect(bikePatches).toHaveLength(0);
  expect(await page.evaluate(`getBikes().find(b=>b.id==='b1').status`)).toBe('in-use');
});

test('once the grace is over and the database agrees nobody holds it, the bike is freed', async ({ page }) => {
  const bikePatches = await boot(page, 'waiting');
  await page.evaluate(`renderStaffQueue()`);
  await page.evaluate(`_orphanSeen.set('b1', Date.now() - ORPHAN_GRACE_MS - 1000)`);
  await page.evaluate(`reconcileOrphanBikes()`);
  await expect.poll(() => bikePatches.length).toBe(1);
  expect(bikePatches[0]).toEqual({ status: 'available' });
  await expect.poll(() => page.evaluate(`getBikes().find(b=>b.id==='b1').status`)).toBe('available');
});

test('a stale local copy cannot free a bike the database says is out', async ({ page }) => {
  const bikePatches = await boot(page, 'active'); // the server: the rider is on it
  // This device's copy lags: it still has the booking waiting.
  await page.evaluate(`S.queue=S.queue.map(e=>e.id==='e1'?{...e,status:'waiting'}:e)`);
  await page.evaluate(`_orphanSeen.set('b1', Date.now() - ORPHAN_GRACE_MS - 1000)`);
  await page.evaluate(`reconcileOrphanBikes()`);
  await page.waitForTimeout(800);
  expect(bikePatches).toHaveLength(0);
  expect(await page.evaluate(`getBikes().find(b=>b.id==='b1').status`)).toBe('in-use');
});
