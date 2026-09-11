import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Check-in is the desk's job, so it got two accelerants. The modal now offers the bike staff
// would have scrolled to anyway — free, right type, right size — as one button, claimed with
// the same compare-and-swap as a reservation so two tills cannot hand over one bike. And a
// party checks in as a chain: confirm one rider, the next one's modal opens by itself.

const S1 = '2099-01-01';
const sessions = [{ id: S1, session_date: S1, day: 'Sunday', status: 'open', capacity: 20, created_at: 1 }];
const bikes = [
  { id: 'bM', name: 'R-11', type: 'Road', size: 'M', status: 'available', colors: [] },
  { id: 'bL', name: 'R-12', type: 'Road', size: 'L', status: 'available', colors: [] },
  { id: 'hS', name: 'H-01', type: 'Hybrid', size: 'S', status: 'available', colors: [] },
];
const e = (id: string, x: Record<string, unknown> = {}) => ({
  id, session_id: S1, session_day: 'Sunday', session_date: S1, queue_num: 1, name: 'R ' + id,
  phone: '0550000001', type_preference: 'Road', size: 'M', status: 'waiting', paid: false,
  price: 75, registered_at: '2099-01-01T10:00:00Z', ...x });

async function boot(page: import('@playwright/test').Page, queue_entries: Record<string, unknown>[],
                    bikesOverride?: Record<string, unknown>[]) {
  await stubSupabase(page, { sessions, queue_entries, bikes: bikesOverride ?? bikes });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  await page.waitForFunction(`getBikes().length>0`);   // the Bike field resolves against the fleet
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';S.sfSession='${S1}';renderStaffQueue()`);
  await page.waitForTimeout(250);
}

test('a party chains: confirming one opens the next', async ({ page }) => {
  await boot(page, [
    e('p1', { group_id: 'grp', name: 'First Rider' }),
    e('p2', { group_id: 'grp', name: 'Second Rider', queue_num: 2 }),
    e('solo', { name: 'Solo', queue_num: 3 }),
  ]);
  await page.evaluate(`showCheckinModal('p1')`);
  await expect(page.locator('#checkin-modal')).toContainText('next rider in this party (1 left)');
  await page.locator('#checkin-modal').getByRole('button', { name: /Confirm/i }).click();
  await expect(page.locator('#checkin-modal')).toContainText('Second Rider');   // opened by itself
  // (what the party line says NOW is fixture-fought: the stub echoes the original queue back
  // on the post-confirm reload, so p1 reads as expected again. The chain opening is the test.)
});

test('unticking the chain stops it', async ({ page }) => {
  await boot(page, [
    e('p1', { group_id: 'grp', name: 'First Rider' }),
    e('p2', { group_id: 'grp', name: 'Second Rider', queue_num: 2 }),
  ]);
  await page.evaluate(`showCheckinModal('p1')`);
  await page.locator('#checkin-modal input[type="checkbox"]').uncheck();
  await page.locator('#checkin-modal').getByRole('button', { name: /Confirm/i }).click();
  await page.waitForTimeout(400);
  const shown = await page.evaluate(`(document.getElementById('checkin-modal')||{}).style?.display||'none'`);
  expect(shown).not.toBe('flex');
});

test('a solo rider sees no party line', async ({ page }) => {
  await boot(page, [e('a')]);
  await page.evaluate(`showCheckinModal('a')`);
  await expect(page.locator('#checkin-modal')).not.toContainText('party (');
});
