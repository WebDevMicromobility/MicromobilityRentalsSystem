import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

const fixtures = {
  sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
  bikes: [{ id: 'b1', name: 'Bike 1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }],
  queue_entries: [
    { id: 'qh', name: 'House Guest', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09',
      queue_num: 1, status: 'waiting', paid: true, price: 0, registered_at: '2099-01-09T10:00:00Z' }, // on the house
    { id: 'qp', name: 'Normal Rider', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09',
      queue_num: 2, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:01:00Z' },
  ],
  inventory: [{ id: 'i1', name: 'Gel', category: 'EnergyGels', qty: 5, price: 8, low_threshold: 1 }],
};

test('checking in an on-the-house booking keeps it on the house (no reprice in the PATCH)', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const patches: Record<string, unknown>[] = [];
  await page.route(/\/rest\/v1\/queue_entries/, async (route) => {
    if (route.request().method() === 'PATCH') patches.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify([{ id: 'x' }]) });
  });
  await page.evaluate(`openModal('qh'); S.modalBikes=['b1'];`);
  await page.evaluate('confirmAssign()');
  await expect.poll(() => patches.some((p) => p.status === 'active')).toBe(true);
  const checkin = patches.find((p) => p.status === 'active')!;
  expect(checkin.assigned_bike_id).toBe('b1');
  expect('price' in checkin).toBe(false); // was price:57.5 — flipped the house ride to a paid one
});

test('a normal booking still gets repriced from the assigned bike at check-in', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const patches: Record<string, unknown>[] = [];
  await page.route(/\/rest\/v1\/queue_entries/, async (route) => {
    if (route.request().method() === 'PATCH') patches.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify([{ id: 'x' }]) });
  });
  await page.evaluate(`openModal('qp'); S.modalBikes=['b1'];`);
  await page.evaluate('confirmAssign()');
  await expect.poll(() => patches.some((p) => p.status === 'active')).toBe(true);
  expect(patches.find((p) => p.status === 'active')!.price).toBe(57.5);
});

test('MM Team sale lines carry no customer name (paid lines keep it)', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const inserts: Record<string, unknown>[] = [];
  await page.route(/\/rest\/v1\/cashier_sales/, async (route) => {
    if (route.request().method() === 'POST') {
      const b = route.request().postDataJSON();
      (Array.isArray(b) ? b : [b]).forEach((r: Record<string, unknown>) => inserts.push(r));
    }
    await route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '[]' });
  });
  await page.evaluate(`
    S._ctSession='s1'; S._ctCust='Walk-up Wally';
    S._ctCart=[
      {item_id:'i1',name:'Gel',cat:'EnergyGels',qty:1,price:8,pay:'team',team:'Salem'},
      {item_id:'i1',name:'Gel',cat:'EnergyGels',qty:1,price:8,pay:'paid',team:''},
    ];
    _ctRecord();
  `);
  await expect.poll(() => inserts.length).toBeGreaterThanOrEqual(2);
  const team = inserts.find((r) => r.pay === 'team')!;
  const paid = inserts.find((r) => r.pay === 'paid')!;
  expect(team.customer_name).toBeNull();          // team consumption isn't a customer sale
  expect(team.team_name).toBe('Salem');
  expect(paid.customer_name).toBe('Walk-up Wally'); // normal lines keep the customer
});
