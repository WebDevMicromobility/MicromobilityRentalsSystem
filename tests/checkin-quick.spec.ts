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

// The booking price follows the type chosen at check-in — except riders on the house
// (default payment covering the type, or manually comped), whose SAR 0 must survive.
test('check-in reprices to the chosen type unless the rider is on the house', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const customers = [{ id: 'ch', name: 'House Rider', phone: '0500000009', height: 175, default_pay: 'house:Road' }];
  const qb = (id: string, qn: number, name: string, extra: Record<string, unknown>): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name,
    phone: '05000000' + qn, customer_id: null, type_preference: 'Hybrid', status: 'waiting', paid: false,
    price: 57.5, registered_at: '2099-01-01T10:00:00Z', ...extra,
  });
  const queue_entries = [
    qb('p1', 11, 'Normal Rider', {}),
    qb('p2', 12, 'Comped Rider', { paid: true, price: 0 }), // manual on-the-house
    qb('p3', 13, 'House Rider', { customer_id: 'ch' }), // default_pay house:Road
  ];
  await stubSupabase(page, { sessions, customers, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const patches: Record<string, Record<string, unknown>> = {};
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) {
      const id = (r.url().match(/id=eq\.([^&]+)/) || [])[1];
      if (id && !patches[id]) patches[id] = r.postDataJSON();
    }
  });
  const checkin = async (id: string) => {
    await page.evaluate((eid) => {
      // @ts-expect-error app globals
      showCheckinModal(eid);
    }, id);
    const modal = page.locator('#checkin-modal');
    await modal.getByRole('button', { name: 'Road', exact: true }).click();
    await modal.getByRole('button', { name: /Confirm/ }).click();
    await expect(modal).toBeHidden();
    await page.waitForTimeout(900); // outlast the row-flash timer + trailing re-render before the next modal
  };
  const roadPrice = await page.evaluate('priceForType("Road")');

  await checkin('p1'); // normal rider: price follows the chosen type
  await expect.poll(() => patches.p1?.price).toBe(roadPrice);

  await checkin('p2'); // manually comped: SAR 0 untouched
  await expect.poll(() => !!patches.p2).toBe(true);
  expect(patches.p2.price).toBeUndefined();

  await checkin('p3'); // default-payment house for Road: becomes on the house
  await expect.poll(() => patches.p3?.price).toBe(0);
  expect(patches.p3.paid).toBe(true);
});
