import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The glance layer: what is free on the rack, who still owes, who has been out too long, and
// which phone is holding two bikes — all computed from data the page already loads.

const S1 = '2099-01-01';
const sessions = [{ id: S1, session_date: S1, day: 'Sunday', status: 'open', capacity: 20, created_at: 1 }];
const bikes = [
  { id: 'b1', name: 'R-01', type: 'Road', size: 'M', status: 'available', colors: [] },
  { id: 'b2', name: 'R-02', type: 'Road', size: 'M', status: 'available', colors: [] },
  { id: 'b3', name: 'R-03', type: 'Road', size: 'L', status: 'in-use', colors: [] },
  { id: 'h1', name: 'H-01', type: 'Hybrid', size: 'S', status: 'available', colors: [] },
];
const e = (id: string, x: Record<string, unknown> = {}) => ({
  id, session_id: S1, session_day: 'Sunday', session_date: S1, queue_num: 1, name: 'R ' + id,
  phone: '0550000001', type_preference: 'Road', size: 'M', status: 'waiting', paid: false,
  price: 75, registered_at: '2099-01-01T10:00:00Z', ...x });

async function boot(page: import('@playwright/test').Page, queue_entries: Record<string, unknown>[]) {
  await stubSupabase(page, { sessions, queue_entries, bikes });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';S.sfSession='${S1}';renderStaffQueue()`);
  await page.waitForTimeout(250);
}

test('the fleet strip counts what is free, by type and size', async ({ page }) => {
  // R-03 needs an actual rider: a bike marked in-use with nobody on it gets self-healed
  // back to available, so an inconsistent fixture would count 4.
  await boot(page, [e('a'), e('rider3', { queue_num: 9, status: 'active', assigned_bike_id: 'b3' })]);
  const strip = await page.evaluate(`(document.querySelector('.fleet-strip')||{}).innerText||''`) as string;
  expect(strip).toContain('3');            // three free in total
  expect(strip).toMatch(/Road.*M:2/);      // R-03 is in use, so Road M counts 2
  expect(strip).toMatch(/Mountain.*—/);    // none owned reads as none, not as zero-hidden
});

test('SAR due sums the unpaid and clicking it filters to them', async ({ page }) => {
  await boot(page, [
    e('a', { price: 75 }),                                   // owes 75
    e('b', { queue_num: 2, price: 60, paid: true }),         // settled
    e('c', { queue_num: 3, price: 40, status: 'cancelled' }),// gone — owes nothing
  ]);
  await expect(page.locator('.stat-card', { hasText: 'SAR due' })).toContainText('75');
  await page.locator('.stat-card', { hasText: 'SAR due' }).click();
  expect(await page.evaluate('S.sfPay')).toBe('pending');
});

test('a rider out past two hours reads amber with a warning', async ({ page }) => {
  const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  await boot(page, [e('a', { status: 'active', checked_in_at: threeHoursAgo, assigned_bike_id: 'b3' })]);
  const cell = await page.evaluate(`document.querySelector('#tab-queue tbody').innerHTML`) as string;
  expect(cell).toContain('⚠');
  expect(cell).toContain('over two hours');
});

test('a fresh check-in stays green', async ({ page }) => {
  const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
  await boot(page, [e('a', { status: 'active', checked_in_at: tenMinAgo, assigned_bike_id: 'b3' })]);
  const cell = await page.evaluate(`document.querySelector('#tab-queue tbody').innerHTML`) as string;
  expect(cell).not.toContain('⚠');
  expect(cell).toContain('min');
});

test('one phone on two separate live bookings is flagged; a party sharing one is not', async ({ page }) => {
  await boot(page, [
    e('a', { phone: '0551112222' }),
    e('b', { queue_num: 2, phone: '0551112222', name: 'Double Booker' }),   // separate booking, same phone
    e('g1', { queue_num: 3, phone: '0553334444', group_id: 'grp' }),
    e('g2', { queue_num: 4, phone: '0553334444', group_id: 'grp' }),        // one party, shared contact
  ]);
  const rows = await page.evaluate(`document.querySelector('#tab-queue tbody').innerText`) as string;
  const flags = (rows.match(/⚠/g) || []).length;
  expect(flags).toBe(2);                    // both halves of the duplicate, neither of the party
});
