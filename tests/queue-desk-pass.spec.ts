import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Two small desk fixes. The queue used to open on "All Sessions" — the same tap every shift,
// and the one view with a 150-row cap. And on approval rides the # column showed only a
// reservation time forever, even after publish made the numbers public.

const KSA_TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const OLD = '2099-01-01';
const sessions = [
  { id: OLD, session_date: OLD, day: 'Sunday', status: 'open', capacity: 10, created_at: 1 },
  { id: KSA_TODAY, session_date: KSA_TODAY, day: 'Today', status: 'open', capacity: 10, created_at: 2 },
];
const sat = (published: boolean) => ({
  id: 'sat-1', session_date: KSA_TODAY, day: 'Saturday', status: 'open', capacity: 20, created_at: 3,
  event_kind: 'community', ride_kind: 'saturday', needs_approval: true, hide_queue: !published,
  paid_ride: false, spots: 20 });
const rider = (id: string, sid: string, st: string, x: Record<string, unknown> = {}) => ({
  id, session_id: sid, session_day: 'Saturday', session_date: KSA_TODAY, queue_num: 7,
  name: 'R ' + id, phone: '0550000001', type_preference: 'Road', size: 'M', status: st,
  paid: false, price: 0, registered_at: '2099-01-01T10:00:00Z', approval: 'approved', ...x });

test('the queue opens on tonight, not on All Sessions', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
  await page.evaluate(`setStaffTab('queue')`);
  await page.waitForTimeout(250);
  expect(await page.evaluate('S.sfSession')).toBe(KSA_TODAY);
});

test('with no session today it stays on All, and a made choice is never overridden', async ({ page }) => {
  await stubSupabase(page, { sessions: [sessions[0]], queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
  await page.evaluate(`setStaffTab('queue')`);
  await page.waitForTimeout(250);
  expect(await page.evaluate('S.sfSession')).toBe('all');
  await page.evaluate(`S.sfSession='${OLD}';renderStaffQueue();renderStaffQueue()`);
  expect(await page.evaluate('S.sfSession')).toBe(OLD);
});

test('before publish: reservation time, and a W-number for the waitlisted', async ({ page }) => {
  await stubSupabase(page, { sessions: [sat(false)], bikes: [],
    queue_entries: [rider('a', 'sat-1', 'waiting'), rider('w', 'sat-1', 'waitlist', { waitlist_num: 2, approval: 'pending' })] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';S.sfSession='sat-1';renderStaffQueue()`);
  await page.waitForTimeout(250);
  const txt = await page.evaluate(`document.querySelector('#tab-queue tbody').innerText`) as string;
  expect(txt).not.toContain('#7');            // numbers stay hidden pre-publish
  expect(txt).toContain('W2');                // but the line position shows
});

test('after publish the numbers are public, so the roster shows them too', async ({ page }) => {
  await stubSupabase(page, { sessions: [sat(true)], bikes: [],
    queue_entries: [rider('a', 'sat-1', 'waiting')] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';S.sfSession='sat-1';renderStaffQueue()`);
  await page.waitForTimeout(250);
  await expect(page.locator('#tab-queue tbody')).toContainText('#7');
});
