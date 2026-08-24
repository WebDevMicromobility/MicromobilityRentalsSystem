import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, unlockStaff, waitForSb } from './helpers/supabase';

// A booking made while offline is queued and flushed on reconnect. It used to flush by
// inserting straight into queue_entries, which works only while the anon "public insert
// booking" policy exists — the last PII hole, whose closing migration is already written.
// The day that policy is dropped, every offline booking would be refused on flush and retried
// forever: the rider turns up expecting a bike, the roster has never heard of them, and
// nothing on any screen says so. The flush now goes through the same RPC the online path uses.

const sessions = [{
  id: '2099-10-04', day: 'Sunday', session_date: '2099-10-04', capacity: 9, status: 'open',
  created_at: 1, bike_slots: '{"_time":"21:00 - 23:00","_total":9}',
}];
const queued = {
  id: 'off1', session_id: '2099-10-04', session_day: 'Sunday', session_date: '2099-10-04',
  queue_num: 4, name: 'Offline Rider', size: 'M', type_preference: 'Road', status: 'waiting',
  paid: false, price: 75, customer_id: 'c1', registered_at: '2099-01-01T10:00:00Z',
};

/** How the flush tried to land the booking. */
function watchTransport(page: import('@playwright/test').Page) {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'POST') return;
    if (r.url().includes('/rpc/customer_create_booking')) seen.push('rpc');
    else if (r.url().includes('/rest/v1/queue_entries')) seen.push('insert');
  });
  return seen;
}

async function bootWithQueued(page: import('@playwright/test').Page, extra: Record<string, unknown> = {}) {
  await stubSupabase(page, { sessions, bikes: [], queue_entries: [], ...extra });
  await loginCustomer(page, { id: 'c1', name: 'Offline Rider' });
  await page.addInitScript((row) => {
    localStorage.setItem('cq_book_outbox', JSON.stringify([row]));
  }, queued);
  await page.goto('/');
  await waitForSb(page);
}

test('a queued booking flushes through the RPC, not a direct insert', async ({ page }) => {
  const seen = watchTransport(page);   // the boot flushes it, so watch from before the boot
  await bootWithQueued(page);
  await expect.poll(() => seen).toContain('rpc');
  expect(seen).not.toContain('insert');          // the door that RLS is about to close
  await expect.poll(() => page.evaluate(`JSON.parse(localStorage.getItem('cq_book_outbox')||'[]').length`)).toBe(0);
});

test('a row that already landed stops jamming the queue behind it', async ({ page }) => {
  // The classic lost-response case: the insert succeeded, the answer never arrived, so it is
  // still queued. The RPC answers with a duplicate-key violation, which means "already there".
  await bootWithQueued(page, { 'rpc:customer_create_booking': { __rpcError: { status: 409, code: '23505', message: 'duplicate key value violates unique constraint' } } });
  await page.evaluate(`_bookOutboxFlush()`);
  await expect.poll(() => page.evaluate(`JSON.parse(localStorage.getItem('cq_book_outbox')||'[]').length`)).toBe(0);
});

test('a refusal keeps the booking queued rather than dropping it', async ({ page }) => {
  await bootWithQueued(page, { 'rpc:customer_create_booking': { __rpcError: { status: 403, code: '42501', message: 'permission denied' } } });
  await page.evaluate(`_bookOutboxFlush()`);
  await page.waitForTimeout(400);
  expect(await page.evaluate(`JSON.parse(localStorage.getItem('cq_book_outbox')||'[]').length`)).toBe(1);
});

test('an older database without the function still flushes the old way', async ({ page }) => {
  const seen = watchTransport(page);
  await bootWithQueued(page, { 'rpc:customer_create_booking': { __rpcError: { status: 404, code: 'PGRST202', message: 'Could not find the function' } } });
  await expect.poll(() => seen).toContain('insert');
});

test('a walk-up handed a bike is not marked served when the write is refused', async ({ page }) => {
  // Marking it done locally regardless meant the rider came back on the next refresh and the
  // booth handed them a second bike, with a second booking to match.
  await stubSupabase(page, {
    sessions, bikes: [], queue_entries: [],
    desk_waitlist: [{
      id: 'w1', name: 'Walk Up', phone: '0500000000', bike_type: 'Road', status: 'waiting',
      kind: 'managed', sort_order: 1, booking_id: null, created_at: '2099-01-01T11:00:00Z',
    }],
  }, { table: 'desk_waitlist', methods: ['PATCH'] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`giveDeskBike('w1')`);
  await expect(page.locator('#err-bar-el')).toBeVisible();
  expect(await page.evaluate(`(S.deskWaitlist||[]).find(w=>w.id==='w1').status`)).toBe('waiting');
});
