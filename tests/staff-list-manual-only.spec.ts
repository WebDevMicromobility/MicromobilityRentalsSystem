import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The staff list holds only what staff put there by hand. A rider the capacity rule
// waitlisted keeps their booking and W number on the Bookings view; they are not copied
// onto the staff list - unless staff park them, when the parked row shows once.

const S1 = '2099-08-08';
const sessions = [{ id: S1, session_date: S1, day: 'Saturday', status: 'open', capacity: 2, created_at: 1 }];
const bk = (id: string, qn: number, name: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, session_id: S1, session_day: 'Saturday', session_date: S1, queue_num: qn, name,
  phone: '05512000' + qn, type_preference: 'Road', status, paid: false, price: 75, size: 'M',
  registered_at: '2099-01-0' + qn + 'T10:00:00Z', ...extra,
});
const walkup = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, phone: '0511111111', bike_type: 'Road', status: 'waiting', author: null,
  created_at: '2099-01-01T10:00:00Z', resolved_at: null, ...extra,
});

async function open(page: import('@playwright/test').Page, fixtures: Record<string, unknown>) {
  await stubSupabase(page, { sessions, bikes: [], queue_entries: [], desk_waitlist: [], ...fixtures });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
  await page.evaluate(`setStaffTab('queue');S.queueView='managed';S._mwSess='all';renderStaffQueue()`);
}

test('an auto-waitlisted booking is not on the staff list; it stays a booking', async ({ page }) => {
  await open(page, { queue_entries: [bk('w1', 3, 'Auto Waitlisted', 'waitlist', { waitlist_num: 1 }), bk('a1', 1, 'Riding Now', 'active')] });
  await expect(page.locator('#mw-host')).not.toContainText('Auto Waitlisted');
  await expect(page.locator('#mw-host')).not.toContainText('Riding Now');
  await page.evaluate(`S.queueView='bookings';S.sfSession='${S1}';setSfStatus('waitlist')`);
  await expect(page.locator('#tab-queue')).toContainText('Auto Waitlisted');       // where it lives
});

test('rows staff added by hand are the list, walk-ups and parked bookings alike, each once', async ({ page }) => {
  await open(page, {
    queue_entries: [bk('w1', 3, 'Parked Rider', 'waitlist', { waitlist_num: 1 }), bk('w2', 4, 'Not Parked', 'waitlist', { waitlist_num: 2 })],
    desk_waitlist: [walkup('m1', 'Parked Rider', { kind: 'managed', sort_order: 1, booking_id: 'w1' }), walkup('m2', 'Walk Up', { kind: 'managed', sort_order: 2 })],
  });
  const text = await page.evaluate(`document.getElementById('mw-host').innerText`) as string;
  expect(text.split('Parked Rider').length - 1).toBe(1);
  expect(text).toContain('Walk Up');
  expect(text).not.toContain('Not Parked');
});
