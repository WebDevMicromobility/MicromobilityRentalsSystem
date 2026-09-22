import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Remove and Restore, and what they did to places and bikes:
//   - Removing a row that held no place (cancelled, no-show) promoted the next waitlisted rider
//     anyway: the night over capacity and a "you're in" to someone who was not.
//   - Removing any row set every bike it pointed at to 'available'. A done row keeps its bike
//     link after the return, so the bike - by then out under the next rider, or in for repair -
//     went back into the pool.
//   - Restore guessed what a removed row had been, and brought a removed cancellation or no-show
//     back as a live 'waiting' booking. The status is now kept in removed_from.

const FUT = '2099-11-11';
const PAST = '2020-01-05';
const sessions = [
  { id: FUT, session_date: FUT, day: 'Wednesday', status: 'open', capacity: 2, created_at: 1 },
  { id: PAST, session_date: PAST, day: 'Sunday', status: 'closed', capacity: 2, created_at: 2 },
];
const e = (id: string, n: number, status: string, extra: Record<string, unknown> = {}) => ({
  id, session_id: FUT, session_day: 'Wednesday', session_date: FUT, queue_num: n, name: 'Rider ' + id,
  phone: '05590000' + n, type_preference: 'Road', status, paid: false, price: 75, size: 'M',
  registered_at: '2099-01-01T10:00:00Z', ...extra,
});
const bike = (id: string, status: string) => ({ id, name: 'Road ' + id, bike_number: Number(id.replace(/\D/g, '')) || 1, type: 'Road', size: 'M', status, colors: ['#000000'], color_names: [''] });

async function boot(page: Page, queue_entries: Record<string, unknown>[], bikes: Record<string, unknown>[] = []) {
  await stubSupabase(page, { sessions, queue_entries, bikes });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
}

/** Every write of one method sent to a table, as raw url + body. */
function watch(page: Page, table: string, method = 'PATCH') {
  const out: { url: string; body: string }[] = [];
  page.on('request', (r) => {
    if (r.method() === method && r.url().includes(`/rest/v1/${table}`)) out.push({ url: r.url(), body: r.postData() || '' });
  });
  return out;
}

test('removing a cancelled booking promotes nobody - it held no place', async ({ page }) => {
  await boot(page, [e('a', 1, 'waiting'), e('c', 2, 'cancelled'), e('w', 3, 'waitlist', { waitlist_num: 1 })]);
  const patches = watch(page, 'queue_entries');
  await page.evaluate(`doRemove('c')`);
  await expect.poll(() => patches.some((p) => /"status":"removed"/.test(p.body))).toBe(true);
  // what it was is kept, for Restore
  await expect.poll(() => patches.some((p) => /"removed_from":"cancelled"/.test(p.body) && p.url.includes('id=eq.c'))).toBe(true);
  await page.waitForTimeout(400);
  expect(patches.some((p) => /"status":"waiting"/.test(p.body))).toBe(false);
});

test('removing a no-show promotes nobody either', async ({ page }) => {
  await boot(page, [e('a', 1, 'waiting'), e('n', 2, 'noshow'), e('w', 3, 'waitlist', { waitlist_num: 1 })]);
  const patches = watch(page, 'queue_entries');
  await page.evaluate(`doRemove('n')`);
  await expect.poll(() => patches.some((p) => /"status":"removed"/.test(p.body))).toBe(true);
  await page.waitForTimeout(400);
  expect(patches.some((p) => /"status":"waiting"/.test(p.body))).toBe(false);
});

test('removing a done ride leaves its old bike alone - it is out under the next rider now', async ({ page }) => {
  await boot(page, [
    e('d', 1, 'done', { assigned_bike_id: 'bk1', paid: true }),
    e('x', 2, 'active', { assigned_bike_id: 'bk1' }),
  ], [bike('bk1', 'in-use')]);
  const bikePatches = watch(page, 'bikes');
  const patches = watch(page, 'queue_entries');
  await page.evaluate(`doRemove('d')`);
  await expect.poll(() => patches.some((p) => /"status":"removed"/.test(p.body))).toBe(true);
  await page.waitForTimeout(400);
  expect(bikePatches).toHaveLength(0);
});

test('removing a rider who is out on a bike frees that bike, but only while it is still in use', async ({ page }) => {
  await boot(page, [e('x', 1, 'active', { assigned_bike_id: 'bk1' })], [bike('bk1', 'in-use')]);
  const bikePatches = watch(page, 'bikes');
  await page.evaluate(`doRemove('x')`);
  await expect.poll(() => bikePatches.length).toBe(1);
  expect(JSON.parse(bikePatches[0].body)).toEqual({ status: 'available' });
  expect(bikePatches[0].url).toMatch(/status=eq\.in-use/);
});

test('Restore brings a removed cancellation back as a cancellation', async ({ page }) => {
  await boot(page, [e('a', 1, 'waiting'), e('r', 2, 'removed', { removed_from: 'cancelled', cancelled_by: 'customer' })]);
  const patches = watch(page, 'queue_entries');
  await page.evaluate(`doRestoreEntry('r')`);
  await expect.poll(() => patches.find((p) => p.url.includes('id=eq.r'))?.body).toMatch(/"status":"cancelled"/);
});

test('a row removed before removed_from existed: a past night with no ride on record comes back as a no-show', async ({ page }) => {
  await boot(page, [{ ...e('r', 2, 'removed'), session_id: PAST, session_date: PAST, session_day: 'Sunday' }]);
  const patches = watch(page, 'queue_entries');
  await page.evaluate(`doRestoreEntry('r')`);
  await expect.poll(() => patches.find((p) => p.url.includes('id=eq.r'))?.body).toMatch(/"status":"noshow"/);
});

test('restoring into a full night asks first, and No changes nothing', async ({ page }) => {
  await boot(page, [e('a', 1, 'waiting'), e('b', 2, 'waiting'), e('r', 3, 'removed', { removed_from: 'waiting' })]);
  const patches = watch(page, 'queue_entries');
  const done = page.evaluate(`doRestoreEntry('r').then(()=>'done')`);
  // #confirm-modal is a block around a position:fixed backdrop; its box is what shows
  await expect(page.locator('#confirm-modal .confirm-box')).toBeVisible();
  await expect(page.locator('#confirm-modal')).toContainText('Session is full');
  await page.evaluate(`closeConfirm()`);
  expect(await done).toBe('done');
  expect(patches.filter((p) => p.url.includes('id=eq.r'))).toHaveLength(0);
});

test('an undo of a Restore that the server refuses is not marked done', async ({ page }) => {
  await boot(page, [e('a', 1, 'waiting'), e('r', 3, 'removed', { removed_from: 'noshow' })]);
  await page.evaluate(`doRestoreEntry('r')`);
  await expect.poll(() => page.evaluate(`S.histLog.length`)).toBe(1);
  await page.route(/\/rest\/v1\/queue_entries/, (r) => r.request().method() === 'PATCH'
    ? r.fulfill({ status: 403, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ code: '42501', message: 'refused' }) })
    : r.fallback());
  await page.evaluate(`undoHistLog(S.histLog[0].id)`);
  expect(await page.evaluate(`S.histLog[0].undone`)).toBe(false);
});

test('undoing a removal whose place went to the waitlist asks before over-filling the night', async ({ page }) => {
  await boot(page, [e('a', 1, 'waiting'), e('b', 2, 'waiting'), e('w', 3, 'waitlist', { waitlist_num: 1 })]);
  await page.evaluate(`doRemove('a')`);
  await expect.poll(() => page.evaluate(`S.histLog.length`)).toBe(1);
  // The stub serves the same rows on every reload; set the night as it now stands on the server.
  await page.evaluate(`getQueue().find(x=>x.id==='a').status='removed';getQueue().find(x=>x.id==='w').status='waiting'`);
  const patches = watch(page, 'queue_entries');
  const undo = page.evaluate(`undoHistLog(S.histLog[0].id)`);
  await expect(page.locator('#confirm-modal .confirm-box')).toBeVisible();
  await page.evaluate(`closeConfirm()`);
  await undo;
  expect(patches.filter((p) => p.url.includes('id=eq.a'))).toHaveLength(0);
  expect(await page.evaluate(`S.histLog[0].undone`)).toBe(false); // still there to undo, nothing changed
});
