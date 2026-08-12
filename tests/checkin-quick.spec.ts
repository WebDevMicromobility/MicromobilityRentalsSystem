import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Check In opens the quick modal: staff confirm payment (paid or not) and the bike TYPE —
// no specific bike. The classic picker stays one tap away via "Assign specific bike…".
test('quick check-in confirms payment + bike type without picking a bike', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const queue_entries = [{ id: 'e1', session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: 7, name: 'Quick Rider', phone: '0500000001', customer_id: null, type_preference: 'Any', status: 'waiting', paid: false, price: 30, registered_at: '2099-01-01T10:00:00Z' }];
  await stubSupabase(page, { sessions, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    showCheckinModal('e1');
  });

  const modal = page.locator('#checkin-modal');
  await expect(modal.getByText('#7 Quick Rider')).toBeVisible();
  await expect(modal.getByRole('button', { name: /Assign a Bike|Assign/i })).toBeVisible(); // classic picker still reachable

  const patches: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries') && r.url().includes('id=eq.e1')) patches.push(r.postDataJSON());
  });
  await modal.getByRole('button', { name: /Paid/ }).click();
  await modal.getByRole('button', { name: 'Road', exact: true }).click();
  await modal.getByRole('button', { name: /Confirm/ }).click();
  await expect(modal).toBeHidden();

  await expect.poll(() => patches.length).toBeGreaterThanOrEqual(1);
  expect(patches[0].status).toBe('active'); // checked in
  expect(patches[0].paid).toBe(true); // payment answered in the same modal
  expect(patches[0].type_preference).toBe('Road'); // type chosen, no assigned_bike_id involved
  expect(patches[0].assigned_bike_id).toBeUndefined();
});
