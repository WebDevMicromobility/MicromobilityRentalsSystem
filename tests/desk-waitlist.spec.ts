import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Staff Waitlist tab (desk_waitlist table): walk-ups waiting for a bike. Waiting rows
// render oldest-first with an availability hint; resolved rows disappear; the form adds.
test('waitlist tab lists waiting walk-ups, adds new ones, and resolves them', async ({ page }) => {
  const desk_waitlist = [
    { id: 'w1', name: 'Waiting One', phone: '0511111111', bike_type: 'Road', status: 'waiting', author: null, created_at: '2099-01-01T10:00:00Z', resolved_at: null },
    { id: 'w2', name: 'Waiting Two', phone: '0522222222', bike_type: 'Any', status: 'waiting', author: null, created_at: '2099-01-01T10:05:00Z', resolved_at: null },
    { id: 'w3', name: 'Already Served', phone: '0533333333', bike_type: 'Any', status: 'done', author: null, created_at: '2099-01-01T09:00:00Z', resolved_at: '2099-01-01T09:30:00Z' },
  ];
  const bikes = [{ id: 'b1', name: 'R-01', type: 'Road', status: 'available', colors: [] }];
  await stubSupabase(page, { desk_waitlist, bikes });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    setStaffTab('waitlist');
  });

  const panel = page.locator('#tab-waitlist');
  await expect(panel.getByText('Waiting One')).toBeVisible();
  await expect(panel.getByText('Waiting Two')).toBeVisible();
  await expect(panel.getByText('Already Served')).toHaveCount(0); // resolved rows stay out of the list
  await expect(panel.getByText('1 available now')).toHaveCount(2); // the free Road bike satisfies both the Road and the Any request

  // Add a walk-up through the form (writes are echoed as success by the stub).
  await panel.locator('#wl-name').fill('New Walkup');
  await panel.locator('#wl-phone').fill('0544444444');
  await panel.locator('#wl-type').selectOption('Hybrid');
  await panel.getByRole('button', { name: /Add to waitlist/ }).click();
  await expect(panel.getByText('New Walkup')).toBeVisible();

  // Hand a bike to a rider: their row resolves out of the waiting list.
  await panel.locator('.q-card', { hasText: 'Waiting One' }).getByRole('button', { name: /Bike given/ }).click();
  await expect(panel.getByText('Waiting One')).toHaveCount(0);
  await expect(panel.getByText('Waiting Two')).toBeVisible();
});
