import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Every cancelled booking read "Cancelled by Customer", because the label hung off the status
// word alone — including the ones staff cancelled and the 37 they rejected. The row now
// records who (staff client-side, customer stamped inside the RPC where arriving at all is
// the proof), and anything from before the column reads a plain "Cancelled": unknown is the
// truth about those, and guessing was the bug.

const S1 = '2099-01-01';
const sessions = [{ id: S1, session_date: S1, day: 'Sunday', status: 'open', capacity: 10, created_at: 1 }];
const e = (id: string, x: Record<string, unknown> = {}) => ({
  id, session_id: S1, session_day: 'Sunday', session_date: S1, queue_num: 1, name: 'R ' + id,
  phone: '0550000001', type_preference: 'Road', size: 'M', status: 'cancelled', paid: false,
  price: 75, registered_at: '2099-01-01T10:00:00Z', ...x });

test('the badge says who — and says nothing when nobody knows', async ({ page }) => {
  await stubSupabase(page, { sessions, bikes: [], queue_entries: [
    e('st', { cancelled_by: 'staff' }),
    e('cu', { queue_num: 2, cancelled_by: 'customer' }),
    e('old', { queue_num: 3 }),                       // predates the column
  ] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  const b = await page.evaluate(`JSON.stringify({
    st: statusBadgeFor(getQueue().find(x=>x.id==='st')),
    cu: statusBadgeFor(getQueue().find(x=>x.id==='cu')),
    old: statusBadgeFor(getQueue().find(x=>x.id==='old')),
  })`) as string;
  const o = JSON.parse(b);
  expect(o.st).toContain('Cancelled by Staff');
  expect(o.cu).toContain('Cancelled by Customer');
  expect(o.old).toContain('>Cancelled<');           // plain, no attribution invented
});

test('a staff cancellation stamps itself on the row', async ({ page }) => {
  await stubSupabase(page, { sessions, bikes: [], queue_entries: [
    e('w', { status: 'waitlist', waitlist_num: 1 }) ] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  const patches: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) patches.push(r.postData() || '');
  });
  await page.evaluate(`staffCancelEntry('w')`);
  await expect.poll(() => patches.some((b) => /"cancelled_by":"staff"/.test(b)), { timeout: 5000 }).toBe(true);
});

test('a staff rejection is a staff cancellation too', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ ...sessions[0], event_kind: 'community', ride_kind: 'saturday', needs_approval: true, hide_queue: true, paid_ride: false, spots: 10 }],
    bikes: [], queue_entries: [e('p', { status: 'waiting', price: 0, approval: 'pending' })] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  const patches: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) patches.push(r.postData() || '');
  });
  await page.evaluate(`rejectEntry('p')`);
  await page.waitForTimeout(400);
  const rej = patches.find((b) => /"approval":"rejected"/.test(b));
  if (rej) expect(rej).toContain('"cancelled_by":"staff"');
});
