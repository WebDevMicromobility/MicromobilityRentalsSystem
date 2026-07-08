import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// The booking insert must carry promo_code (and the discounted price) atomically, so the
// server price trigger can tell a legit promo discount from price manipulation.
test('a promo booking sends promo_code + discounted price in the insert row', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Road', status: 'available', rental_price: 75 }],
    promo_codes: [{ code: 'SAVE10', kind: 'percent', value: 10, active: true }],
    queue_entries: [],
  });
  await loginCustomer(page, { id: 'c1' });
  await page.goto('/');
  await waitForSb(page);

  const inserts: Record<string, unknown>[] = [];
  await page.route(/\/rest\/v1\/queue_entries/, async (route) => {
    if (route.request().method() === 'POST') {
      const b = route.request().postDataJSON();
      (Array.isArray(b) ? b : [b]).forEach((r: Record<string, unknown>) => inserts.push(r));
    }
    await route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '[]' });
  });

  await page.evaluate(`
    S.selSession='s1'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Road']; S.regRiderNames=['Spec Rider'];
    S.promoApplied={ code:'SAVE10', kind:'percent', value:10 };
    submitReg();
  `);
  await expect.poll(() => inserts.length).toBeGreaterThanOrEqual(1);
  const row = inserts[0];
  expect(row.promo_code).toBe('SAVE10');   // code present AT insert (was set in a later update)
  expect(row.price).toBe(67.5);            // Road 75 - 10% discount, in the same row
});

test('a non-promo booking sends a null promo_code (trigger will snap price to canonical)', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Road', status: 'available', rental_price: 75 }],
    queue_entries: [],
  });
  await loginCustomer(page, { id: 'c1' });
  await page.goto('/');
  await waitForSb(page);
  const inserts: Record<string, unknown>[] = [];
  await page.route(/\/rest\/v1\/queue_entries/, async (route) => {
    if (route.request().method() === 'POST') { const b = route.request().postDataJSON(); (Array.isArray(b) ? b : [b]).forEach((r: Record<string, unknown>) => inserts.push(r)); }
    await route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '[]' });
  });
  await page.evaluate(`S.selSession='s1'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Road']; S.regRiderNames=['Spec Rider']; S.promoApplied=null; submitReg();`);
  await expect.poll(() => inserts.length).toBeGreaterThanOrEqual(1);
  expect(inserts[0].promo_code ?? null).toBeNull();
});
