import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The check-in modal's money line for a party (or a scanned group). Stepping through riders
// must not move the amounts: the total used to price the OPEN rider as Confirm would charge
// them and everyone else at their booked fare, so a rider whose fare changes at check-in - a
// house-covered rider, most visibly - made the party total jump as staff clicked along the
// steps, with nothing changed. Every rider is now priced the one way.
const sessions = [
  { id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 20, status: 'open', created_at: 1 },
  { id: 'sp', day: 'Tuesday', session_date: '2099-02-11', capacity: 20, status: 'open', created_at: 2, event_kind: 'community', ride_kind: 'petromin', paid_ride: true },
];
const e = (id: string, x: Record<string, unknown> = {}) => ({
  id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: 1,
  name: 'R ' + id, phone: '', customer_id: null, group_id: 'g1', status: 'waiting', paid: false,
  type_preference: 'Any', price: 57.5, size: 'M', registered_at: '2099-01-01T10:00:00Z', ...x,
});

async function boot(page: Page, rows: Record<string, unknown>[], customers: Record<string, unknown>[] = []) {
  await stubSupabase(page, { queue_entries: rows, sessions, customers });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('getQueue().length>0');
}
const open = (page: Page, id: string) => page.evaluate((i) => {
  // @ts-expect-error app global
  showCheckinModal(i);
}, id);
const money = async (page: Page) => ((await page.locator('#ci-money').textContent()) || '').replace(/\s+/g, ' ').trim();

test('a house-covered rider does not move the party total as staff step through the riders', async ({ page }) => {
  // The covered rider rides free, so the party owes the other rider's fare - from either step.
  await boot(page, [
    e('p1', { queue_num: 1, customer_id: 'c1', name: 'House Rider' }),
    e('p2', { queue_num: 2 }),
  ], [{ id: 'c1', name: 'House Rider', default_pay: 'house', email: 'h@x.com', phone: '' }]);

  await open(page, 'p1');
  expect(await money(page)).toContain('SAR 0');
  expect(await money(page)).toContain('party SAR 57.50');
  await open(page, 'p2');
  expect(await money(page)).toContain('party SAR 57.50'); // was SAR 115: the covered rider counted twice over
  expect(await money(page)).toContain('SAR 57.50 due');
});

test('an ordinary party reads the same from every step', async ({ page }) => {
  await boot(page, [
    e('p1', { queue_num: 1, type_preference: 'Road', price: 75 }),
    e('p2', { queue_num: 2 }),
    e('p3', { queue_num: 3, paid: true }),
  ]);
  const seen: string[] = [];
  for (const id of ['p1', 'p2', 'p3']) { await open(page, id); seen.push(await money(page)); }
  expect(seen.map((s) => s.slice(s.indexOf('party')))).toEqual([
    'party SAR 190SAR 132.50 due', 'party SAR 190SAR 132.50 due', 'party SAR 190SAR 132.50 due',
  ]);
});

test('marking one rider paid is the only thing that moves the total', async ({ page }) => {
  await boot(page, [e('p1', { queue_num: 1 }), e('p2', { queue_num: 2 })]);
  await open(page, 'p1');
  expect(await money(page)).toContain('SAR 115 due');
  await page.locator('#checkin-modal').getByRole('button', { name: /Paid · Card/ }).click();
  expect(await money(page)).toContain('SAR 57.50 due');
  await open(page, 'p2'); // the choice is still only a draft, but the line keeps telling the truth about it
  expect(await money(page)).toContain('SAR 57.50 due');
});

test('a Petromin rider retyped at check-in is charged their ride’s fare, not the circuit’s', async ({ page }) => {
  const rows = [
    e('q1', { queue_num: 1, session_id: 'sp', session_date: '2099-02-11', session_day: 'Tuesday', price: 50 }),
    e('q2', { queue_num: 2, session_id: 'sp', session_date: '2099-02-11', session_day: 'Tuesday', price: 50 }),
  ];
  await boot(page, rows);
  const patched: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries') && r.url().includes('id=eq.q1')) {
      try { patched.push(r.postDataJSON()); } catch { /* not JSON */ }
    }
  });
  await open(page, 'q1');
  const modal = page.locator('#checkin-modal');
  await modal.getByRole('button', { name: 'Mountain', exact: true }).click(); // Petromin sells every type at 50
  expect(await money(page)).toContain('SAR 50');
  expect(await money(page)).toContain('party SAR 100');
  await modal.getByRole('button', { name: /Confirm/i }).click();
  // The write agrees with the line: the booked 50 stands, so there is no price to rewrite.
  // It used to overwrite it with the circuit's 57.50 the moment the type was touched.
  await expect.poll(() => patched.some((p) => p.status === 'active')).toBe(true);
  expect(patched.filter((p) => 'price' in p).map((p) => p.price)).toEqual([]);
});
