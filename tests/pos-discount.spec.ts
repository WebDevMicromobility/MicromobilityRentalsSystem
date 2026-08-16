import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// POS discount accounting. A discount is entered against the WHOLE cart, but the receipt
// records each line as paid-now or pending, so the discount has to be split across those
// buckets. Booking all of it against the paid lines used to drive a receipt's paid total
// NEGATIVE (cart 100 = 40 paid + 60 pending, 50% off recorded paid as -10), which
// understated the drawer and fed a negative base to the card/cash split.

const sessions = [{
  id: 's0', day: 'Sunday', session_date: '2099-02-08', capacity: 4,
  status: 'open', created_at: 1, bike_slots: null, location: 'JCC', addons: null,
}];

/** Runs a cart through the real _ctRecord() and returns the totals it would persist.
 *  String form: these are app globals the type-checker cannot see. */
async function record(page: import('@playwright/test').Page, cart: unknown[], disc: number, pct: boolean) {
  return page.evaluate(`(() => {
    S._ctSession = 's0';
    S._ctCart = JSON.parse(${JSON.stringify(JSON.stringify(cart))});
    S._ctDisc = '${disc}'; S._ctDiscPct = ${pct}; S._ctCard = ''; S._ctCardPct = false;
    const captured = [];
    const orig = window._salesUpsert;
    window._salesUpsert = (r) => { captured.push(r); };
    try { _ctRecord(); } finally { window._salesUpsert = orig; }
    const sum = (pay) => Math.round(captured
      .filter((r) => r.pay === pay && r.category !== '__cardmeta__')
      .reduce((s, r) => s + r.qty * r.price, 0) * 100) / 100;
    return { paid: sum('paid'), pending: sum('pending'), rows: captured.length };
  })()`) as Promise<{ paid: number; pending: number; rows: number }>;
}

test.describe('POS discount accounting', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page, { sessions });
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
  });

  test('a discount bigger than the paid-now lines never records a negative paid total', async ({ page }) => {
    const r = await record(page, [
      { item_id: 'i1', name: 'Paid item', cat: 'x', qty: 1, price: 40, pay: 'paid' },
      { item_id: 'i2', name: 'Pending item', cat: 'x', qty: 1, price: 60, pay: 'pending' },
    ], 50, true); // 50% of 100 = 50, but only 40 was paid now
    expect(r.paid).toBe(0); // was -10 before the split
    expect(r.pending).toBe(50); // the remaining 10 comes off what is still owed
    expect(r.paid + r.pending).toBe(50); // cart 100 less a 50 discount
  });

  test('a discount inside the paid total comes off the paid side only', async ({ page }) => {
    const r = await record(page, [
      { item_id: 'i1', name: 'A', cat: 'x', qty: 1, price: 100, pay: 'paid' },
    ], 20, false);
    expect(r.paid).toBe(80);
    expect(r.pending).toBe(0);
  });

  test('a discount larger than the whole cart is capped at the cart total', async ({ page }) => {
    const r = await record(page, [
      { item_id: 'i1', name: 'A', cat: 'x', qty: 1, price: 30, pay: 'paid' },
    ], 500, false);
    expect(r.paid).toBe(0);
    expect(r.pending).toBe(0); // never a credit
  });

  test('what the cart preview shows matches what the receipt records', async ({ page }) => {
    const cart = [
      { item_id: 'i1', name: 'Paid item', cat: 'x', qty: 1, price: 40, pay: 'paid' },
      { item_id: 'i2', name: 'Pending item', cat: 'x', qty: 1, price: 60, pay: 'pending' },
    ];
    // string form: these are app globals the type-checker cannot see
    const preview = await page.evaluate(`(() => {
      S._ctCart = JSON.parse(${JSON.stringify(JSON.stringify(cart))});
      S._ctDisc = '50'; S._ctDiscPct = true;
      const split = _ctDiscountSplit(S._ctCart, _ctDiscountSAR(100));
      return Math.round((40 - split.onPaid) * 100) / 100;
    })()`) as number;
    const r = await record(page, cart, 50, true);
    expect(preview).toBe(r.paid);
  });
});
