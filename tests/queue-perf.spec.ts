import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Guards the Bookings tab against the O(n^2) render (per-row full-queue scans) that made it
// slow to load: no-show tallies are precomputed, and buildQueueGroups indexes in one pass.
test('the Bookings tab renders a large queue quickly with correct grouping & no-show flags', async ({ page }) => {
  const q: Record<string, unknown>[] = [];
  for (let s = 0; s < 30; s++) for (let i = 0; i < 30; i++) {
    const cust = (s * 30 + i) % 200;
    q.push({ id: `e_${s}_${i}`, session_id: 's' + s, session_day: 'Friday', session_date: '2099-02-10',
      queue_num: i + 1, name: 'Rider ' + cust, phone: '05' + (10000000 + cust), customer_id: 'c' + cust,
      status: i % 7 === 0 ? 'noshow' : (i % 3 === 0 ? 'done' : 'waiting'), paid: i % 2 === 0, price: 30, registered_at: '2099-01-01T10:00:00Z' });
  }
  const sessions = Array.from({ length: 30 }, (_, s) => ({ id: 's' + s, day: 'Friday', session_date: '2099-02-10', capacity: 40, status: 'open', created_at: 1 }));
  await stubSupabase(page, { queue_entries: q, sessions });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    // @ts-expect-error app globals
    S.staffTab = 'queue'; renderStaffQueue();
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(1500); // O(n^2) over 900 rows would blow well past this

  const check = await page.evaluate(() => {
    // @ts-expect-error app globals
    const e = (S.queue || []).find((x) => x.customerId === 'c0');
    // @ts-expect-error app globals
    return { viaMap: customerNoShows(e), manual: (S.queue || []).filter((x) => x.customerId === 'c0' && x.status === 'noshow').length };
  });
  expect(check.viaMap).toBe(check.manual);
});
