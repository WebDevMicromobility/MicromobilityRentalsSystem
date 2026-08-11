import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Desk waitlist: a third view inside the Bookings tab that mirrors the queue page —
// section header, stat cards, filter bar (session + search), desktop table + mobile cards,
// and a Walk-in-style add modal. "Bike given" books the rider into the selected session
// as a REAL queue entry. Rows render twice (table + cards, one hidden by CSS), so
// assertions filter to the visible layer.
test('waitlist view mirrors the queue page, adds via modal, and books resolved riders into the queue', async ({ page }) => {
  const desk_waitlist = [
    { id: 'w1', name: 'Waiting One', phone: '0511111111', bike_type: 'Road', status: 'waiting', author: null, created_at: '2099-01-01T10:00:00Z', resolved_at: null },
    { id: 'w2', name: 'Waiting Two', phone: '0522222222', bike_type: 'Any', status: 'waiting', author: null, created_at: '2099-01-01T10:05:00Z', resolved_at: null },
    { id: 'w3', name: 'Already Served', phone: '0533333333', bike_type: 'Any', status: 'done', author: null, created_at: '2099-01-01T09:00:00Z', resolved_at: '2099-01-01T09:30:00Z' },
  ];
  const bikes = [{ id: 'b1', name: 'R-01', type: 'Road', status: 'available', colors: [] }];
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  // Queue bookings surface on the waitlist too — but ONLY while unpaid and not checked in.
  const qb = (id: string, qn: number, name: string, status: string, paid: boolean): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name,
    phone: '05555555' + qn, customer_id: null, type_preference: 'Road', status, paid, price: 30, registered_at: '2099-01-01T09:00:00Z',
  });
  const queue_entries = [qb('qb1', 51, 'Owes Money', 'waiting', false), qb('qb2', 52, 'Fully Settled', 'waiting', true), qb('qb3', 53, 'On A Bike', 'active', false),
    { ...qb('qb4', 91, 'On The List', 'waitlist', false), type_preference: 'Mountain', waitlist_num: 3 },
    { ...qb('qb5', 92, 'Second List', 'waitlist', false), type_preference: 'Mountain', waitlist_num: 4 }];
  await stubSupabase(page, { desk_waitlist, bikes, sessions, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    setStaffTab('waitlist'); // deep-link form: maps to the Bookings tab with the waitlist view active
  });

  const panel = page.locator('#tab-queue');
  const rowFor = (name: string) => panel.locator('tr, .q-card').filter({ hasText: name }).filter({ visible: true });
  await expect(rowFor('Waiting One')).toHaveCount(1);
  await expect(rowFor('Waiting Two')).toHaveCount(1);
  // Confirmed/checked-in queue bookings never show here — but WAITLIST-status bookings do,
  // with a Promote action (the #91 case).
  await expect(rowFor('Owes Money')).toHaveCount(0);
  await expect(rowFor('Fully Settled')).toHaveCount(0);
  await expect(rowFor('On A Bike')).toHaveCount(0);
  await expect(rowFor('On The List')).toHaveCount(1);
  await expect(rowFor('On The List').getByRole('button', { name: /Promote/ })).toHaveCount(1);
  await expect(rowFor('On The List').getByText('#91')).toBeVisible();
  await expect(rowFor('On The List').getByText(/W3/)).toBeVisible(); // staff-only waitlist serial next to the booking number

  // Reordering: move-down swaps the pair and renumbers the session's waitlist 1..n.
  const reorders: { url: string; body: Record<string, unknown> }[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) reorders.push({ url: r.url(), body: r.postDataJSON() });
  });
  await rowFor('On The List').getByRole('button', { name: 'Move down' }).click();
  await expect.poll(() => reorders.length).toBe(2);
  expect(reorders.find((p) => p.url.includes('id=eq.qb4'))?.body).toEqual({ waitlist_num: 2 });
  expect(reorders.find((p) => p.url.includes('id=eq.qb5'))?.body).toEqual({ waitlist_num: 1 });
  await expect(rowFor('Second List').getByText(/W1/)).toBeVisible(); // optimistic re-render shows the new order
  // Resolved walk-ups appear in the history section on the same page, not the waiting list.
  await expect(rowFor('Already Served')).toHaveCount(1);
  await expect(rowFor('Already Served').getByText(/Bike given/)).toBeVisible();
  await expect(rowFor('Already Served').getByRole('button', { name: /Remove/ })).toHaveCount(0); // history rows have no actions
  await expect(panel.getByText('1 available now').filter({ visible: true })).toHaveCount(2); // the free Road bike satisfies both the Road and the Any request
  await expect(panel.locator('#wl-sess')).toHaveValue('s0'); // choose-session select in the filter bar

  // Add a party of two through the modal (writes are echoed as success by the stub):
  // the second rider row is left unnamed and waits as "New Walkup 2".
  await panel.getByRole('button', { name: /Add to waitlist/ }).click();
  const modal = page.locator('#wl-add-modal');
  await modal.locator('#wl-name').fill('New Walkup');
  await modal.locator('#wl-phone').fill('0544444444');
  await modal.getByRole('button', { name: 'Hybrid' }).click();
  await modal.getByRole('button', { name: /\+ Add rider/ }).click();
  await modal.getByRole('button', { name: /Add to waitlist \(2\)/ }).click();
  await expect(modal).toBeHidden();
  await expect(rowFor('New Walkup 2')).toHaveCount(1);
  await expect(rowFor('New Walkup')).toHaveCount(2); // both rows carry the shared name prefix
  await expect(rowFor('New Walkup 2').locator('a[href^="https://wa.me/"]')).toHaveCount(1); // WhatsApp + call per rider
  await expect(rowFor('New Walkup 2').locator('a[href^="tel:"]')).toHaveCount(1);

  // Payment on the waitlist row: same pay-toggle + menu as a queue booking.
  await rowFor('Waiting One').getByRole('button', { name: /Pending/ }).click();
  await page.locator('.pay-menu-popup').getByRole('button', { name: /Paid · Cash/ }).click();
  await expect(rowFor('Waiting One').getByRole('button', { name: /Paid/ })).toBeVisible();

  // "Check In" books the rider into the selected session, payment state carried over:
  // capture the queue_entries insert.
  const posts: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) {
      const sent = r.postDataJSON();
      posts.push(Array.isArray(sent) ? sent[0] : sent);
    }
  });
  await rowFor('Waiting One').getByRole('button', { name: /Check In/i }).click();
  await expect(page.getByText('Bike given to Waiting One')).toBeVisible(); // toast
  expect(posts).toHaveLength(1);
  expect(posts[0].name).toBe('Waiting One');
  expect(posts[0].session_id).toBe('s0');
  expect(posts[0].status).toBe('waiting');
  expect(posts[0].paid).toBe(true); // the cash payment taken while waiting

  // Remove takes a rider off the waiting list (into history) without booking anything.
  await rowFor('Waiting Two').getByRole('button', { name: /Remove/ }).click();
  await expect(rowFor('Waiting Two').filter({ hasText: 'Removed' })).toHaveCount(1); // now a history row
  await expect(rowFor('Waiting Two').getByRole('button', { name: /Remove/ })).toHaveCount(0);
  expect(posts).toHaveLength(1); // still just the one booking
});
