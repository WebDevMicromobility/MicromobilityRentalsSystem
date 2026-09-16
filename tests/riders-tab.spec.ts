import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The Riders tab lists self-registrations from the form at micromobility.sa/petromin
// (rider_registrations). Each row was matched server-side by phone or name: to an open
// booking, to a customer account with no booking, or to nothing; the tab does not show that
// match any more, the form registration is a booking in its own right. The desk checks a rider
// in and takes the bike back from this tab; the price a return fixes is for the billing
// report only and never appears in the list.

const D = '2099-02-08';
const SESS = '2099-02-08-pw';
const sessions = [{
  id: SESS, day: 'Wednesday', session_date: D, capacity: 35, status: 'open',
  created_at: 1, bike_slots: JSON.stringify({ _time: '19:00 - 21:00', _total: 35 }),
  location: 'JCC', addons: null, event_kind: 'community', ride_kind: 'petromin', paid_ride: true,
  needs_approval: false, hide_queue: false, title: "Petromin's Wednesdays",
}];
const queue_entries = [{
  id: 'e1', session_id: SESS, session_day: 'Wednesday', session_date: D, queue_num: 7,
  name: 'Amal Booked', phone: '+966500000001', customer_id: 'c1', type_preference: 'Hybrid',
  status: 'waiting', paid: false, price: 60, registered_at: '2099-01-01T10:00:00Z',
}];
const base = { source: 'petromin', session_id: SESS, created_at: '2099-02-08T09:00:00Z', updated_at: '2099-02-08T09:00:00Z', price: null, checked_in_by: null, checked_out_by: null };
const rider_registrations = [
  {
    ...base, id: 1, booking_no: 'P-001', badge: 'A-12', company: 'Petromin', name: 'Amal Booked', phone: '+966500000001',
    height: 170, type_preference: 'Hybrid', matched_entry_id: 'e1', matched_customer_id: 'c1', match_kind: 'booking',
    submissions: 1, checked_in_at: null, checked_out_at: null,
  },
  {
    ...base, id: 2, booking_no: 'P-002', badge: 'B-34', company: 'Petrolube', name: 'Bader Account', phone: '+966500000002',
    height: 180, type_preference: 'Road', matched_entry_id: null, matched_customer_id: 'c2', match_kind: 'customer',
    submissions: 2, checked_in_at: '2099-02-08T16:05:00Z', checked_out_at: null, checked_in_by: 'Desk One',
  },
  {
    ...base, id: 3, booking_no: 'P-003', badge: 'C-56', company: 'Petromin', name: 'Cara Nobody', phone: '+966500000003',
    height: 160, type_preference: 'Mountain', matched_entry_id: null, matched_customer_id: null, match_kind: 'none',
    submissions: 1, checked_in_at: '2099-02-08T16:00:00Z', checked_out_at: '2099-02-08T17:35:00Z', checked_in_by: 'Desk One', checked_out_by: 'Desk Two', price: 57.5,
  },
];

type P = import('@playwright/test').Page;

/** Collects uncaught errors for the life of the page. */
function watch(page: P) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`${e.name}: ${e.message}`));
  return errs;
}

async function openRiders(page: P) {
  await stubSupabase(page, { sessions, queue_entries, rider_registrations });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('riders')`);
  await expect(page.locator('#tab-riders tbody tr')).toHaveCount(3);
}

const rows = (page: P) => page.locator('#tab-riders tbody tr');
const pill = (page: P, label: string) => page.locator('#tab-riders .filter-pill', { hasText: label });

test('the Riders tab lists every registration with its number, company, phone and session', async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);

  await expect(page.locator('#tab-riders')).toHaveClass(/active/);
  const r0 = rows(page).nth(0), r1 = rows(page).nth(1), r2 = rows(page).nth(2);
  await expect(r0).toContainText('P-001');
  await expect(r0).toContainText('A-12');
  await expect(r0).toContainText('Petromin');
  await expect(r0.locator('a[href^="https://wa.me/966500000001"]')).toHaveCount(1);
  await expect(r1).toContainText('B-34');
  await expect(r1).toContainText('Petrolube');
  await expect(r1).toContainText('Submitted 2 times');
  await expect(r2).toContainText('C-56');
  await expect(page.locator('#tab-riders select.filter-select')).toContainText('(3)');

  // Pill counts reflect the whole list, not the current filter.
  await expect(pill(page, 'All')).toContainText('3');
  await expect(pill(page, 'Not arrived')).toContainText('1');
  await expect(pill(page, 'On ride')).toContainText('1');
  await expect(pill(page, 'Returned')).toContainText('1');
  expect(errs).toEqual([]);
});

test('the filter pills narrow the list by desk state', async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);

  await pill(page, 'Not arrived').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('A-12');
  await pill(page, 'On ride').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('B-34');
  await pill(page, 'Returned').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('C-56');
  await pill(page, 'All').click();
  await expect(rows(page)).toHaveCount(3);
  expect(errs).toEqual([]);
});

test('check-in and check-out times show in their own columns, with who stamped them and the ride time', async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);
  const head = page.locator('#tab-riders thead');
  await expect(head).toContainText('Check-in time');
  await expect(head).toContainText('Check-out time');

  // Not arrived: no times, a Check in button.
  const r0 = rows(page).nth(0);
  await expect(r0.locator('td.rider-time').nth(0)).not.toContainText(':');
  await expect(r0.locator('td.rider-time').nth(1)).not.toContainText(':');
  await expect(r0.getByRole('button', { name: 'Check in' })).toBeVisible();

  // On ride: the check-in time and who did it; Return bike is offered, with an undo.
  const r1 = rows(page).nth(1);
  await expect(r1.locator('td.rider-time').nth(0)).toContainText('19:05'); // 16:05Z in Riyadh
  await expect(r1.locator('td.rider-time').nth(0)).toContainText('by Desk One');
  await expect(r1.locator('td.rider-time').nth(1)).not.toContainText(':');
  await expect(r1.getByRole('button', { name: 'Return bike' })).toBeVisible();
  await expect(r1.getByRole('button', { name: 'Check in' })).toHaveCount(0);
  await expect(r1.locator('a', { hasText: 'undo' })).toHaveCount(1);

  // Returned: both times, the ride time between them, and only an undo left.
  const r2 = rows(page).nth(2);
  await expect(r2.locator('td.rider-time').nth(0)).toContainText('19:00');
  await expect(r2.locator('td.rider-time').nth(1)).toContainText('20:35');
  await expect(r2.locator('td.rider-time').nth(1)).toContainText('Ride 1h 35m');
  await expect(r2.locator('td.rider-time').nth(1)).toContainText('by Desk Two');
  await expect(r2.getByRole('button', { name: /Check in|Return bike/ })).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('Check in writes checked_in_at for that row, and Return bike writes checked_out_at', async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);
  const writes: { url: string; body: Record<string, unknown> }[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && /rest\/v1\/rider_registrations/.test(r.url())) writes.push({ url: r.url(), body: r.postDataJSON() });
  });

  await rows(page).nth(0).getByRole('button', { name: 'Check in' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].url).toContain('id=eq.1');
  expect(typeof writes[0].body.checked_in_at).toBe('string');
  expect(writes[0].body.checked_in_by).toBe('Spec Staff');

  await rows(page).nth(1).getByRole('button', { name: 'Return bike' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].url).toContain('id=eq.2');
  expect(typeof writes[1].body.checked_out_at).toBe('string');
  expect(writes[1].body.checked_out_by).toBe('Spec Staff');
  expect(errs).toEqual([]);
});

test('the list never shows a price; the billing report CSV carries per-ride prices and a TOTAL line', async ({ page }) => {
  const errs = watch(page);
  await openRiders(page);
  const cells = await page.locator('#tab-riders td').allTextContents();
  for (const c of cells) {
    expect(c).not.toContain('SAR');
    expect(c).not.toContain('57.5');
    expect(c).not.toContain('75.00');
  }

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Report CSV' }).click();
  const file = await dl;
  const text = await (await import('node:fs/promises')).readFile(await file.path() as string, 'utf8');
  const lines = text.replace(/^\uFEFF/, '').trim().split('\n');
  expect(lines[0]).toContain('price_sar');
  expect(lines.some((l) => l.includes('P-003') && l.includes('57.50'))).toBe(true);
  expect(lines[lines.length - 1]).toContain('TOTAL');
  expect(lines[lines.length - 1]).toContain('57.50');
  expect(errs).toEqual([]);
});
