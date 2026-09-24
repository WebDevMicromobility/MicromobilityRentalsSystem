import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A realtime event carries the changed row. On a staff device it is merged in place and the
// roster repainted, with no fetch: before, every event on any device re-fetched the whole
// two-month queue on every other device. A device's own write re-syncs only the rows it
// touched.
const sessions = [{ id: '2099-02-10', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
const row = (id: string, qn: number, name: string, status = 'waiting') => ({
  id, session_id: '2099-02-10', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name, phone: '', customer_id: null,
  group_id: null, status, paid: false, price: 30, walk_in: true, registered_at: '2099-01-01T10:00:00Z', type_preference: 'Road', size: 'M',
});

test('a realtime update is merged in place and painted without a fetch', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [row('e1', 1, 'First'), row('e2', 2, 'Second')] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('getQueue().length===2');
  await page.evaluate("S.staffTab='queue'; S.sfSession='2099-02-10'; renderStaffQueue()");
  const gets: string[] = [];
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().includes('/rest/v1/')) gets.push(r.url()); });
  await page.evaluate(() => {
    // @ts-expect-error app globals
    window.__noWiden = false; _onRt({ table: 'queue_entries', eventType: 'UPDATE', new: { ...JSON.parse(JSON.stringify({})), id: 'e2', session_id: '2099-02-10', session_day: 'Friday', session_date: '2099-02-10', queue_num: 2, name: 'Second Renamed', status: 'active', paid: true, price: 30, type_preference: 'Road', size: 'M', registered_at: '2099-01-01T10:00:00Z' }, old: { id: 'e2' } });
  });
  await expect(page.locator('#tab-queue')).toContainText('Second Renamed');
  expect(await page.evaluate("getQueue().find(e=>e.id==='e2').status")).toBe('active');
  await page.waitForTimeout(600);
  expect(gets).toHaveLength(0);
});

test('a realtime delete removes the row; an insert adds it', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [row('e1', 1, 'First')] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('getQueue().length===1');
  await page.evaluate("window.__noWiden=false; _onRt({table:'queue_entries',eventType:'DELETE',old:{id:'e1'}})");
  expect(await page.evaluate('getQueue().length')).toBe(0);
  await page.evaluate("_onRt({table:'queue_entries',eventType:'INSERT',new:{id:'e9',session_id:'2099-02-10',session_day:'Friday',session_date:'2099-02-10',queue_num:9,name:'Ninth',status:'waiting',paid:false,price:30,type_preference:'Road',size:'M',registered_at:'2099-01-01T10:00:00Z'}})");
  expect(await page.evaluate("getQueue().map(e=>e.id)")).toEqual(['e9']);
});

test('the check-in re-syncs only its own row, not the window', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [row('e1', 1, 'First'), row('e2', 2, 'Second')], 'rpc:staff_checkin': { ok: true, noop: false } });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('getQueue().length===2');
  await page.evaluate("S.staffTab='queue'; renderStaffQueue(); showCheckinModal('e1')");
  const gets: string[] = [];
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().includes('/rest/v1/queue_entries')) gets.push(decodeURIComponent(r.url())); });
  await page.locator('#checkin-modal #ci-confirm').click();
  await expect(page.locator('#checkin-modal')).toBeHidden();
  await expect.poll(() => gets.length).toBeGreaterThan(0);
  expect(gets.some((u) => u.includes('id=in.(e1)'))).toBe(true);
  expect(gets.some((u) => u.includes('session_date=gte.'))).toBe(false);
});
