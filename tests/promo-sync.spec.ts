import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Promo-code changes reflect immediately on live bookings carrying the code:
// a type-restricted code reprices matching rows to the discounted price and returns
// non-matching rows to the full type price. Paid rows are never touched.
test('promo sync reprices unpaid live bookings from the code’s current state', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const promo_codes = [{ id: 'p1', code: 'CARBON75', kind: 'flat', value: 75, applies_to: 'Road Carbon', active: true, created_at: '2099-01-01' }];
  const qe = (id: string, qn: number, name: string, ty: string, price: number, paid = false): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name,
    phone: '', customer_id: null, type_preference: ty, status: 'waiting', paid, price,
    promo_code: 'CARBON75', registered_at: '2099-01-01T10:00:00Z',
  });
  const queue_entries = [
    qe('e1', 1, 'Wrongly Freed', 'Road', 0), // got the discount when the code was unrestricted -> back to full Road price
    qe('e2', 2, 'Carbon Rider', 'Road Carbon', 250), // matching type at sticker price -> discounted
    qe('e3', 3, 'Paid Rider', 'Road', 0, true), // paid: never touched
  ];
  await stubSupabase(page, { sessions, promo_codes, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const patches: Record<string, Record<string, unknown>> = {};
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) {
      const id = (r.url().match(/id=eq\.([^&]+)/) || [])[1];
      if (id) patches[id] = r.postDataJSON();
    }
  });
  const count = await page.evaluate(() => {
    // @ts-expect-error app globals
    return _syncPromoBookings('CARBON75');
  });
  expect(count).toBe(2);
  await expect.poll(() => Object.keys(patches).sort()).toEqual(['e1', 'e2']);
  expect(patches.e1.price).toBeGreaterThan(0); // restored to the full Road price
  expect(patches.e2).toEqual({ price: 175 }); // 250 - 75 for the matching Road Carbon row
  expect(patches.e3).toBeUndefined(); // paid row untouched
});
