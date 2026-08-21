import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// On the Saturday Social Ride staff pick who comes, so "approved" IS the attendance decision.
// The number worth watching is therefore how many DIFFERENT people that reached — a rider
// approved on six Saturdays is one customer, not six. These pin the counting rules that make
// it a reach number: dedupe by person, ignore places that were given back, and never count a
// JCC booking (which has no approval step) towards it.

const sat = (date: string, id: string) => ({
  id, session_date: date, day: 'Saturday', status: 'closed', capacity: 40, created_at: 1,
  event_kind: 'community', ride_kind: 'saturday', paid_ride: false,
  needs_approval: true, hide_queue: false, spots: 40, title: 'Saturday Social Ride',
  bike_slots: '{"_time":"05:45 - 06:15"}',
});
const jcc = {
  id: '2099-05-03', session_date: '2099-05-03', day: 'Sunday', status: 'closed', capacity: 12,
  created_at: 1, bike_slots: '{"_time":"21:00 - 23:00","_total":12}',
};
const row = (id: string, sess: string, extra: Record<string, unknown>) => ({
  id, session_id: sess, session_day: 'Saturday', session_date: sess, queue_num: 1,
  name: 'Rider', size: 'M', type_preference: 'Road', status: 'done', paid: false, price: 0,
  registered_at: '2099-01-01T10:00:00Z', ...extra,
});

async function analytics(page: import('@playwright/test').Page, fixtures: Record<string, unknown>) {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.analyticsRange='all';S.anSession='all';setStaffTab('analytics')`);
  return page.locator('.analytics-highlight-card.ev-saturday');
}

test('counts a rider once however many Saturdays they were approved for', async ({ page }) => {
  const card = await analytics(page, {
    sessions: [sat('2099-05-01', '2099-05-01'), sat('2099-05-08', '2099-05-08')],
    bikes: [], queue_entries: [
      row('a1', '2099-05-01', { customer_id: 'c1', approval: 'approved', name: 'Repeat Rider' }),
      row('a2', '2099-05-08', { customer_id: 'c1', approval: 'approved', name: 'Repeat Rider' }),
      row('a3', '2099-05-08', { customer_id: 'c2', approval: 'approved', name: 'Other Rider' }),
    ],
  });
  await expect(card).toBeVisible();
  await expect(card.locator('.hl-value').first()).toContainText('2');  // two people
  await expect(card.locator('.hl-value').nth(1)).toContainText('3');   // three approvals
  await expect(card.locator('.hl-value').nth(2)).toContainText('1.5'); // rides per rider
});

test('pending, rejected and cancelled riders are not approved riders', async ({ page }) => {
  const card = await analytics(page, {
    sessions: [sat('2099-05-01', '2099-05-01')],
    bikes: [], queue_entries: [
      row('a1', '2099-05-01', { customer_id: 'c1', approval: 'approved' }),
      row('a2', '2099-05-01', { customer_id: 'c2', approval: 'pending' }),
      row('a3', '2099-05-01', { customer_id: 'c3', approval: 'rejected' }),
      // approved, then the place was given back: not a rider who came
      row('a4', '2099-05-01', { customer_id: 'c4', approval: 'approved', status: 'cancelled' }),
    ],
  });
  await expect(card.locator('.hl-value').first()).toContainText('1');
});

test('a walk-in with no account still counts as a person, and not as several', async ({ page }) => {
  // Staff add riders by hand and those rows carry no customer_id. Counting each row as a new
  // person is exactly how a reach number quietly inflates.
  const card = await analytics(page, {
    sessions: [sat('2099-05-01', '2099-05-01'), sat('2099-05-08', '2099-05-08')],
    bikes: [], queue_entries: [
      row('a1', '2099-05-01', { approval: 'approved', name: 'Hand Added', phone: '0551112222' }),
      row('a2', '2099-05-08', { approval: 'approved', name: 'hand added', phone: '0551112222' }),
    ],
  });
  await expect(card.locator('.hl-value').first()).toContainText('1');
});

test('JCC bookings never reach the card, and without a social ride it does not appear', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [jcc], bikes: [],
    queue_entries: [{ ...row('j1', jcc.id, { customer_id: 'c9', approval: 'approved' }), session_day: 'Sunday' }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.analyticsRange='all';S.anSession='all';setStaffTab('analytics')`);
  await expect(page.locator('.analytics-highlight-card.ev-saturday')).toHaveCount(0);
});

test('the range filter applies to it like everything else on the tab', async ({ page }) => {
  const fixtures = {
    sessions: [sat('2099-05-01', '2099-05-01'), sat('2098-05-01', '2098-05-01')],
    bikes: [], queue_entries: [
      row('a1', '2099-05-01', { customer_id: 'c1', approval: 'approved' }),
      row('a2', '2098-05-01', { customer_id: 'c2', approval: 'approved' }),
    ],
  };
  const card = await analytics(page, fixtures);
  await expect(card.locator('.hl-value').first()).toContainText('2'); // all time
  await page.evaluate(`S.analyticsRange='daterange';S.analyticsDateFrom='2099-01-01';S.analyticsDateTo='2099-12-31';renderAnalytics()`);
  await expect(card.locator('.hl-value').first()).toContainText('1'); // that year only
});
