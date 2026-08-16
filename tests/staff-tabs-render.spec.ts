import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, loginCustomer, waitForSb } from './helpers/supabase';

// A blanket "does it render at all" sweep. The sessions two-pane detail shipped with
// `waitlistCap(sel)` where the surrounding scope binds `_selSess`, so opening any session
// threw a ReferenceError and the user saw "Something went wrong - it was logged." Nothing
// in the suite opened that pane, so nothing caught it. These specs walk each staff screen
// and its main drill-down, and fail on any uncaught page error.

const D = '2099-02-08';
const sessions = [{
  id: 's0', day: 'Sunday', session_date: D, capacity: 9, status: 'open',
  created_at: 1, bike_slots: JSON.stringify({ _time: '21:00 - 23:00', _total: 9, _wl: { m: 'pct', v: 20 } }),
  location: 'JCC', addons: null,
}];
const queue_entries = [{
  id: 'e1', session_id: 's0', session_day: 'Sunday', session_date: D, queue_num: 1,
  name: 'Spec Rider', phone: '0500000001', customer_id: 'c1', type_preference: 'Hybrid',
  status: 'waiting', paid: false, price: 60, registered_at: '2099-01-01T10:00:00Z',
}];
const bikes = [{ id: 'b1', name: 'Road 1', type: 'Road', size: 'M', status: 'available', colors: ['#000'] }];
const inventory = [{ id: 'i1', name: 'Energy Gel', category: 'Supplements', qty: 10, price: 12, addon: true }];
const promo_codes = [{ id: 'p1', code: 'SUMMER10', kind: 'percent', value: 10, active: true }];

/** Collects uncaught errors for the life of the page. */
function watch(page: import('@playwright/test').Page) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`${e.name}: ${e.message}`));
  return errs;
}

test.describe('every staff screen renders without throwing', () => {
  for (const tab of ['queue', 'sessions', 'bikes', 'inventory', 'cashier', 'history', 'customers', 'analytics']) {
    test(`the ${tab} tab`, async ({ page }) => {
      const errs = watch(page);
      await stubSupabase(page, { sessions, queue_entries, bikes, inventory, promo_codes });
      await unlockStaff(page);
      await page.goto('/');
      await waitForSb(page);
      await page.evaluate(`setStaffTab('${tab}')`);
      await page.waitForTimeout(250);
      expect(errs).toEqual([]);
    });
  }
});

test.describe('session drill-downs', () => {
  test('opening a session shows its detail pane, waitlist stat included', async ({ page }) => {
    const errs = watch(page);
    await stubSupabase(page, { sessions, queue_entries, bikes, promo_codes });
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`setStaffTab('sessions')`);
    await page.evaluate(`selectSessionDetail('s0')`);
    await page.waitForTimeout(250);

    expect(errs).toEqual([]);
    // The bug was inside the waitlist-cap stat, so assert it actually rendered rather than
    // just that nothing threw — an early `return ''` would look identical otherwise.
    await expect(page.locator('.sess-detail-pane')).toContainText('Spec Rider');
    await expect(page.locator('.sess-detail-stats')).toContainText('0/2'); // 20% of 9, rounded up
  });

  test('a session with no waitlist cap simply omits that stat', async ({ page }) => {
    const errs = watch(page);
    const plain = [{ ...sessions[0], bike_slots: JSON.stringify({ _time: '21:00 - 23:00', _total: 9 }) }];
    await stubSupabase(page, { sessions: plain, queue_entries, bikes });
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`setStaffTab('sessions'); selectSessionDetail('s0')`);
    await page.waitForTimeout(250);
    expect(errs).toEqual([]);
    await expect(page.locator('.sess-detail-pane')).toBeVisible();
  });

  test('the session editor opens from the detail pane', async ({ page }) => {
    const errs = watch(page);
    await stubSupabase(page, { sessions, queue_entries, bikes });
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`setStaffTab('sessions'); selectSessionDetail('s0'); startEditSession('s0')`);
    await page.waitForTimeout(250);
    expect(errs).toEqual([]);
  });
});

// Session shapes differ enough that one fixture proves little: a percentage cap and a count
// cap take different branches, community rides skip pricing entirely, and the counts mode
// stores a per-size object where the others store a number. Render each, staff and customer.
const variants: Array<[string, Record<string, unknown>]> = [
  ['plain', {}],
  ['waitlist as a percentage', { bike_slots: JSON.stringify({ _time: '21:00 - 23:00', _total: 9, _wl: { m: 'pct', v: 20 } }) }],
  ['waitlist as a count', { bike_slots: JSON.stringify({ _time: '21:00 - 23:00', _total: 9, _wl: { m: 'count', v: 5 } }) }],
  ['community, unpublished', { event_kind: 'community', title: 'Saturday Social Ride', spots: 30, hide_queue: true }],
  ['community, published', { event_kind: 'community', title: 'Saturday Social Ride', spots: 30, hide_queue: false }],
  ['closed, with add-ons', { status: 'closed', addons: JSON.stringify(['i1']) }],
  ['full, per-size counts', { status: 'full', bike_slots: JSON.stringify({ _time: '21:00 - 23:00', Road: { XS: 1, S: 2, M: 3, L: 1 } }) }],
];

test.describe('session shapes all render', () => {
  for (const [name, over] of variants) {
    test(`staff detail and editor: ${name}`, async ({ page }) => {
      const errs = watch(page);
      await stubSupabase(page, { sessions: [{ ...sessions[0], ...over }], queue_entries, bikes, inventory, promo_codes });
      await unlockStaff(page);
      await page.goto('/');
      await waitForSb(page);
      await page.evaluate(`setStaffTab('sessions'); selectSessionDetail('s0'); startEditSession('s0');`);
      await page.waitForTimeout(200);
      expect(errs, name).toEqual([]);
    });

    test(`customer screens: ${name}`, async ({ page }) => {
      const errs = watch(page);
      await stubSupabase(page, { sessions: [{ ...sessions[0], ...over }], queue_entries, bikes, inventory, promo_codes });
      await loginCustomer(page, { id: 'c1' });
      await page.goto('/');
      await waitForSb(page);
      for (const tab of ['register', 'myrides', 'account']) {
        await page.evaluate(`setCustTab('${tab}')`);
        await page.waitForTimeout(120);
      }
      expect(errs, name).toEqual([]);
    });
  }
});
