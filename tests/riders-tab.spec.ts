import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The Riders tab lists self-registrations from the /register form (rider_registrations).
// Each row was matched server-side by name: to an open booking, to a customer account
// with no booking, or to nothing. Staff read the table directly; the tab joins the
// booking match against the queue to show the booking number and jump to it.

const D = '2099-02-08';
const sessions = [{
  id: 's0', day: 'Sunday', session_date: D, capacity: 9, status: 'open',
  created_at: 1, bike_slots: JSON.stringify({ _time: '21:00 - 23:00', _total: 9 }),
  location: 'JCC', addons: null,
}];
const queue_entries = [{
  id: 'e1', session_id: 's0', session_day: 'Sunday', session_date: D, queue_num: 7,
  name: 'Amal Booked', phone: '0500000001', customer_id: 'c1', type_preference: 'Hybrid',
  status: 'waiting', paid: false, price: 60, registered_at: '2099-01-01T10:00:00Z',
}];
const rider_registrations = [
  {
    id: 1, badge: 'A-12', name: 'Amal Booked', height: 170, type_preference: 'Hybrid',
    matched_entry_id: 'e1', matched_customer_id: 'c1', match_kind: 'booking', submissions: 1,
    source: 'petromin', created_at: '2099-02-08T09:00:00Z', updated_at: '2099-02-08T09:00:00Z',
  },
  {
    id: 2, badge: 'B-34', name: 'Bader Account', height: 180, type_preference: 'Road',
    matched_entry_id: null, matched_customer_id: 'c2', match_kind: 'customer', submissions: 2,
    source: 'petromin', created_at: '2099-02-08T09:05:00Z', updated_at: '2099-02-08T09:10:00Z',
  },
  {
    id: 3, badge: 'C-56', name: 'Cara Nobody', height: 160, type_preference: 'Mountain',
    matched_entry_id: null, matched_customer_id: null, match_kind: 'none', submissions: 1,
    source: null, created_at: '2099-02-08T09:20:00Z', updated_at: '2099-02-08T09:20:00Z',
  },
];

/** Collects uncaught errors for the life of the page. */
function watch(page: import('@playwright/test').Page) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`${e.name}: ${e.message}`));
  return errs;
}

async function openRiders(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, queue_entries, rider_registrations });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('riders')`);
  await expect(page.locator('#tab-riders tbody tr')).toHaveCount(3);
}

const rows = (page: import('@playwright/test').Page) => page.locator('#tab-riders tbody tr');
const pill = (page: import('@playwright/test').Page, label: string) =>
  page.locator('#tab-riders .filter-pill', { hasText: label });

test('the Riders tab lists every registration with its match', async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);

  await expect(page.locator('#tab-riders')).toHaveClass(/active/);
  await expect(rows(page).nth(0)).toContainText('A-12');
  await expect(rows(page).nth(0)).toContainText('#7');
  await expect(rows(page).nth(1)).toContainText('B-34');
  await expect(rows(page).nth(1)).toContainText('Account, no booking');
  await expect(rows(page).nth(1)).toContainText('Submitted 2 times');
  await expect(rows(page).nth(2)).toContainText('C-56');
  await expect(rows(page).nth(2)).toContainText('No match');

  // Pill counts reflect the whole list, not the current filter.
  await expect(pill(page, 'All')).toContainText('3');
  await expect(pill(page, 'Has booking')).toContainText('1');
  await expect(pill(page, 'Account only')).toContainText('1');
  await expect(pill(page, 'No match')).toContainText('1');
  expect(errs).toEqual([]);
});

test('the filter pills narrow the list to one match kind', async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);

  await pill(page, 'Has booking').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('A-12');
  await expect(pill(page, 'Has booking')).toHaveClass(/active/);

  await pill(page, 'Account only').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('B-34');

  await pill(page, 'No match').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('C-56');

  await pill(page, 'All').click();
  await expect(rows(page)).toHaveCount(3);
  expect(errs).toEqual([]);
});

test("the booking row's button opens the Bookings tab on that rider", async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);

  await rows(page).nth(0).locator('button', { hasText: '#7' }).click();
  await expect(page.locator('#tab-queue')).toHaveClass(/active/);
  await expect(page.locator('#tab-riders')).not.toHaveClass(/active/);
  expect(await page.evaluate(`S.staffTab`)).toBe('queue');
  expect(await page.evaluate(`S.sfSearch`)).toBe('Amal Booked');
  await expect(page.locator('#tab-queue')).toContainText('Amal Booked');
  expect(errs).toEqual([]);
});
