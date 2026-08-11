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
  await stubSupabase(page, { desk_waitlist, bikes, sessions });
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
  await expect(rowFor('Already Served')).toHaveCount(0); // resolved rows stay out of the list
  await expect(panel.getByText('1 available now').filter({ visible: true })).toHaveCount(2); // the free Road bike satisfies both the Road and the Any request
  await expect(panel.locator('#wl-sess')).toHaveValue('s0'); // choose-session select in the filter bar

  // Add a walk-up through the modal (writes are echoed as success by the stub).
  await panel.getByRole('button', { name: /Add to waitlist/ }).click();
  const modal = page.locator('#wl-add-modal');
  await modal.locator('#wl-name').fill('New Walkup');
  await modal.locator('#wl-phone').fill('0544444444');
  await modal.getByRole('button', { name: 'Hybrid' }).click();
  await modal.getByRole('button', { name: /Add to waitlist/ }).click();
  await expect(modal).toBeHidden();
  await expect(rowFor('New Walkup')).toHaveCount(1);

  // "Bike given" books the rider into the selected session: capture the queue_entries insert.
  const posts: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) {
      const sent = r.postDataJSON();
      posts.push(Array.isArray(sent) ? sent[0] : sent);
    }
  });
  await rowFor('Waiting One').getByRole('button', { name: /Bike given/ }).click();
  await expect(page.getByText('Bike given to Waiting One')).toBeVisible(); // toast
  expect(posts).toHaveLength(1);
  expect(posts[0].name).toBe('Waiting One');
  expect(posts[0].session_id).toBe('s0');
  expect(posts[0].status).toBe('waiting');

  // Remove takes a rider off the list without booking anything.
  await rowFor('Waiting Two').getByRole('button', { name: /Remove/ }).click();
  await expect(rowFor('Waiting Two')).toHaveCount(0);
  expect(posts).toHaveLength(1); // still just the one booking
});
