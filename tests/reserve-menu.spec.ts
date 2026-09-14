import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Reserving from the row's ⋯ menu: the bike picker opens with the best free bike already
// selected so Reserve bike is one tap; a reserved rider gets Release instead.

const S1 = '2099-01-09';
const sessions = [{ id: S1, day: 'Friday', session_date: S1, capacity: 12, status: 'open', created_at: 1 }];
const bikes = [
  { id: 'rL', name: 'R-12', type: 'Road', size: 'L', status: 'available', colors: [] },
  { id: 'rM', name: 'R-11', type: 'Road', size: 'M', status: 'available', colors: [] },
  { id: 'hM', name: 'H-01', type: 'Hybrid', size: 'M', status: 'available', colors: [] },
];
const row = (id: string, x: Record<string, unknown> = {}) => ({
  id, name: 'Rider ' + id, session_id: S1, session_day: 'Friday', session_date: S1, queue_num: 1, status: 'waiting', paid: false,
  price: 30, registered_at: S1 + 'T10:00:00Z', type_preference: 'Road', size: 'M', phone: '0550000001', ...x });

async function boot(page: import('@playwright/test').Page, rows: Record<string, unknown>[]) {
  await stubSupabase(page, { sessions, bikes, queue_entries: rows });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('getBikes().length>0');
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';S.sfSession='${S1}';renderStaffQueue()`);
}

test('Reserve bike… sits in the menu, opens the picker with the right-size bike selected, and Reserve holds it', async ({ page }) => {
  await boot(page, [row('q1')]);
  const menu = await page.evaluate(`((S._rowMenus||{})['q1']||[]).map(i=>i.run).join('|')`) as string;
  expect(menu).toContain("_reserveFromMenu('q1')");
  expect(menu).not.toContain('_releaseReserved');
  const patches: string[] = [];
  page.on('request', r => { if (r.method() === 'PATCH' && /queue_entries/.test(r.url())) patches.push(r.postData() || ''); });
  await page.evaluate(`_reserveFromMenu('q1')`);
  expect(await page.evaluate('S.modalBikes')).toEqual(['rM']);          // Road M, not the L
  await page.evaluate(`reserveBike()`);
  await expect.poll(() => patches.length).toBeGreaterThan(0);
  expect(JSON.parse(patches[0]).assigned_bike_id).toBe('rM');
  await expect.poll(() => page.evaluate(`_isReserved(getQueue().find(e=>e.id==='q1'))`)).toBe(true);
});

test('a reserved rider gets Release reserved bike instead, and it lets the bike go', async ({ page }) => {
  const held: Record<string, unknown> = row('q1', { assigned_bike_id: 'rM' });
  await boot(page, [held]);
  // The stub echoes fixtures on every reload: once the release is written, the fixture follows it.
  await page.route(/\/rest\/v1\/queue_entries\?.*id=eq\.q1/, async (route) => {
    if (route.request().method() === 'PATCH' && /"assigned_bike_id":null/.test(route.request().postData() || '')) held.assigned_bike_id = null;
    await route.fallback();
  });
  const menu = await page.evaluate(`((S._rowMenus||{})['q1']||[]).map(i=>i.run).join('|')`) as string;
  expect(menu).toContain("_releaseReserved('q1')");
  expect(menu).not.toContain('_reserveFromMenu');
  const patches: string[] = [];
  page.on('request', r => { if (r.method() === 'PATCH' && /queue_entries/.test(r.url())) patches.push(r.postData() || ''); });
  await page.evaluate(`_releaseReserved('q1')`);
  await expect.poll(() => patches.length).toBeGreaterThan(0);
  expect(JSON.parse(patches[0]).assigned_bike_id).toBeNull();
  await expect.poll(() => page.evaluate(`((S._rowMenus||{})['q1']||[]).map(i=>i.run).join('|')`)).toContain('_reserveFromMenu');
});

test('a bike held for someone else is not offered', async ({ page }) => {
  await boot(page, [row('q1'), row('q2', { queue_num: 2, assigned_bike_id: 'rM' })]);
  await page.evaluate(`_reserveFromMenu('q1')`);
  expect(await page.evaluate('S.modalBikes')).toEqual(['rL']);          // the M is held for q2; the L is the free Road left
});
