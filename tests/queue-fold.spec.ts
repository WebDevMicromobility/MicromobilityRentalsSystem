import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Tonight's list is the riders who still need something: finished parties fold to one line,
// and a party reads as one row until it is opened.

const S1 = '2099-01-09';
const sessions = [{ id: S1, day: 'Friday', session_date: S1, capacity: 12, status: 'open', created_at: 1 }];
const bikes = [{ id: 'b1', name: 'R-11', type: 'Road', size: 'M', status: 'available', colors: [] }];
const row = (id: string, n: number, x: Record<string, unknown> = {}) => ({
  id, name: 'Rider ' + id, session_id: S1, session_day: 'Friday', session_date: S1, queue_num: n, status: 'waiting', paid: false,
  price: 75, registered_at: S1 + 'T10:00:00Z', type_preference: 'Road', size: 'M', phone: '05500000' + n, ...x });
const rows = [
  row('w1', 1), row('a1', 2, { status: 'active' }), row('d1', 3, { status: 'done', paid: true }), row('n1', 4, { status: 'noshow' }), row('c1', 5, { status: 'cancelled' }),
  row('p1', 6, { group_id: 'g', name: 'Holder One' }), row('p2', 7, { group_id: 'g', status: 'noshow' }), row('p3', 8, { group_id: 'g', paid: true }),
];

async function boot(page: import('@playwright/test').Page, q = rows) {
  await stubSupabase(page, { sessions, bikes, queue_entries: q });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';S.sfSession='${S1}';S.sfStatus='all';renderStaffQueue()`);
}
const vis = (page: import('@playwright/test').Page, name: string) => page.locator('.queue-table tbody tr:visible, .q-card:visible').filter({ hasText: name });

test('finished riders fold to one line and open on tap', async ({ page }) => {
  await boot(page);
  await expect(vis(page, 'Rider w1')).toHaveCount(1);
  await expect(vis(page, 'Rider d1')).toHaveCount(0);
  await expect(vis(page, 'Rider n1')).toHaveCount(0);
  const fold = page.locator('.fold-btn:visible');
  await expect(fold).toHaveText('1 finished · 1 no-show — Show ▾');   // cancelled rows are not on the roster unless asked for
  await fold.click();
  await expect(vis(page, 'Rider d1')).toHaveCount(1);
  await expect(page.locator('.fold-btn:visible')).toHaveText('Hide finished ▴');
  await page.evaluate(`setSfStatus('done')`);                            // a status filter shows everything it names, no fold
  await expect(page.locator('.fold-btn')).toHaveCount(0);
  await expect(vis(page, 'Rider d1')).toHaveCount(1);
});

test('when everyone is finished, nothing folds', async ({ page }) => {
  await boot(page, [row('d1', 1, { status: 'done' }), row('n1', 2, { status: 'noshow' })]);
  await expect(page.locator('.fold-btn')).toHaveCount(0);
  await expect(vis(page, 'Rider d1')).toHaveCount(1);
});

test('a party is one row until opened: holder, shape, money, its own actions', async ({ page }) => {
  await boot(page);
  const party = vis(page, 'Holder One').first();
  await expect(party).toContainText('3 riders · 2 waiting · 1 no-show');
  await expect(party).toContainText('Check in (2)');
  await expect(party).toContainText('Show riders');
  await expect(vis(page, 'Rider p3')).toHaveCount(0);                     // the member is inside
  await party.getByRole('button', { name: /Show riders/ }).click();
  await expect(vis(page, 'Rider p3')).toHaveCount(1);
  await expect(page.locator('.party-toggle:visible', { hasText: 'Hide riders' })).toHaveCount(1);
  await page.locator('.party-toggle:visible', { hasText: 'Hide riders' }).click();
  await expect(vis(page, 'Rider p3')).toHaveCount(0);
});

test('a party stays open across repaints, and _partyOpenAll opens every one', async ({ page }) => {
  await boot(page);
  await page.evaluate(`_togglePartyOpen(_partyKey(getQueue().find(e=>e.id==='p1')))`);
  await page.evaluate(`renderStaffQueue()`);
  await expect(vis(page, 'Rider p3')).toHaveCount(1);
  await page.evaluate(`_togglePartyOpen(_partyKey(getQueue().find(e=>e.id==='p1')))`);
  await expect(vis(page, 'Rider p3')).toHaveCount(0);
  await page.evaluate(`_partyOpenAll()`);
  await expect(vis(page, 'Rider p3')).toHaveCount(1);
});
