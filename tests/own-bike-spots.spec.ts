import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// Saturday Social Ride spots meter the Micromobility rental bikes only: riders who
// bring their own bike ('Own' type preference) never consume a spot, so staff can
// seat any number of bike owners on top of a "full" renter allocation.

const sat = {
  id: 'comm1', day: 'Saturday', session_date: '2099-01-10', capacity: 12, status: 'open', created_at: 1, location: 'JCC',
  event_kind: 'community', needs_approval: true, hide_queue: true, spots: 2, title: 'Saturday Social Ride',
};
const entry = (id: string, type: string) => ({
  id, name: `R ${id}`, customer_id: `cust-${id}`, session_id: 'comm1', session_day: 'Saturday',
  session_date: '2099-01-10', queue_num: 1, status: 'waiting', paid: false, price: 0,
  registered_at: '2099-01-01T10:00:00Z', type_preference: type, approval: 'approved',
});
const fixtures = {
  sessions: [sat],
  bikes: [],
  // 2 own-bike riders + 1 renter against a 2-spot cap: only the renter holds a spot.
  queue_entries: [entry('q1', 'Own'), entry('q2', 'Own'), entry('q3', 'Any')],
};

test('own-bike riders do not consume community spots', async ({ page }) => {
  await stubSupabase(page, { ...fixtures, 'rpc:community_member': true });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);

  // spots=2, 3 riders booked, but 2 bring their own bike: 1 spot still free
  expect(await page.evaluate(`spotsLeft('comm1')`)).toBe(1);
  // the own-bike helper drives the staff filter and every spot count
  expect(await page.evaluate(`getQueue().filter(e=>_isOwnBike(e)).length`)).toBe(2);
});
