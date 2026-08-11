import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Desk waitlist: a third view inside the Bookings tab (beside Queue and Sessions).
// Waiting rows render oldest-first with an availability hint; the form adds; "Bike given"
// books the rider into the session picked in the wl-sess select as a REAL queue entry.
test('waitlist view lists walk-ups, adds new ones, and books resolved riders into the queue', async ({ page }) => {
  const desk_waitlist = [
    { id: 'w1', name: 'Waiting One', phone: '0511111111', bike_type: 'Road', status: 'waiting', author: null, created_at: '2099-01-01T10:00:00Z', resolved_at: null },
    { id: 'w2', name: 'Waiting Two', phone: '0522222222', bike_type: 'Any', status: 'waiting', author: null, created_at: '2099-01-01T10:05:00Z', resolved_at: null },
    { id: 'w3', name: 'Already Served', phone: '0533333333', bike_type: 'Any', status: 'done', author: null, created_at: '2099-01-01T09:00:00Z', resolved_at: '2099-01-01T09:30:00Z' },
  ];
  const bikes = [{ id: 'b1', name: 'R-01', type: 'Road', status: 'available', colors: [] }];
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  await stubSupabase(page, { desk_waitlist, bikes, sessions });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    setStaffTab('waitlist'); // deep-link form: maps to the Bookings tab with the waitlist view active
  });

  const panel = page.locator('#tab-queue');
  await expect(panel.getByText('Waiting One')).toBeVisible();
  await expect(panel.getByText('Waiting Two')).toBeVisible();
  await expect(panel.getByText('Already Served')).toHaveCount(0); // resolved rows stay out of the list
  await expect(panel.getByText('1 available now')).toHaveCount(2); // the free Road bike satisfies both the Road and the Any request
  await expect(panel.locator('#wl-sess')).toHaveValue('s0'); // choose-session select, defaulted to the open session

  // Add a walk-up through the form (writes are echoed as success by the stub).
  await panel.locator('#wl-name').fill('New Walkup');
  await panel.locator('#wl-phone').fill('0544444444');
  await panel.locator('#wl-type').selectOption('Hybrid');
  await panel.getByRole('button', { name: /Add to waitlist/ }).click();
  await expect(panel.getByText('New Walkup')).toBeVisible();

  // "Bike given" books the rider into the selected session: capture the queue_entries insert.
  const posts: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) {
      const sent = r.postDataJSON();
      posts.push(Array.isArray(sent) ? sent[0] : sent);
    }
  });
  await panel.locator('.q-card', { hasText: 'Waiting One' }).getByRole('button', { name: /Bike given/ }).click();
  await expect(page.getByText('Bike given to Waiting One')).toBeVisible(); // toast
  expect(posts).toHaveLength(1);
  expect(posts[0].name).toBe('Waiting One');
  expect(posts[0].session_id).toBe('s0');
  expect(posts[0].status).toBe('waiting');

  // Remove takes a rider off the list without booking anything.
  await panel.locator('.q-card', { hasText: 'Waiting Two' }).getByRole('button', { name: /Remove/ }).click();
  await expect(panel.locator('.q-card', { hasText: 'Waiting Two' })).toHaveCount(0);
  expect(posts).toHaveLength(1); // still just the one booking
});
