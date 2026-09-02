import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Every staff write ends in loadData(), and loadData used to refetch EVERYTHING — including
// customers and customer_tags, ~4,300 rows on the live database, as four fetches that awaited
// one another. Eight round trips at a measured ~250ms, added to closing a session: an action
// that cannot have changed any of them.
//
// Reference data now loads once and reloads only when something touches it. What must hold:
// it still loads, a repeat load does not refetch it, and a write to it makes the next load do so.

const S1 = '2099-12-01';
const sessions = [{ id: S1, session_date: S1, day: 'Tuesday', status: 'open', capacity: 10, created_at: 1 }];
const REF = ['customers', 'tags', 'customer_tags', 'breakfast_spots'];

/** GET counts per table, from the moment it is installed. */
function counter(page: import('@playwright/test').Page) {
  const hits: Record<string, number> = {};
  page.on('request', (r) => {
    const m = r.url().match(/\/rest\/v1\/([a-z_]+)/);
    if (m && r.method() === 'GET') hits[m[1]] = (hits[m[1]] || 0) + 1;
  });
  return hits;
}

async function bootStaff(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [], customers: [], tags: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
}

test('boot still loads the reference data', async ({ page }) => {
  const hits = counter(page);
  await bootStaff(page);
  await page.waitForTimeout(500);
  for (const t of REF) expect(hits[t] || 0, `${t} on boot`).toBeGreaterThan(0);
});

test('a second load does not refetch it', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  const hits = counter(page);            // installed AFTER boot, so it sees only the reload
  await page.evaluate(`loadData()`);
  await page.waitForTimeout(400);
  for (const t of REF) expect(hits[t] || 0, `${t} on reload`).toBe(0);
  expect(hits['queue_entries'] || 0, 'the live queue still reloads').toBeGreaterThan(0);
});

test('a write to a reference table makes the next load refetch it', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  const hits = counter(page);
  await page.evaluate(`sb.from('customers').update({height:180}).eq('id','c1')`);
  await page.evaluate(`loadData()`);
  await page.waitForTimeout(500);
  expect(hits['customers'] || 0).toBeGreaterThan(0);
});

test('the stale copy is picked up without a write, so another till is not invisible forever', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  const hits = counter(page);
  await page.evaluate(`_refAt = Date.now() - (6*60*1000)`);   // older than the TTL
  await page.evaluate(`loadData()`);
  await page.waitForTimeout(500);
  expect(hits['customers'] || 0).toBeGreaterThan(0);
});

// A burst of actions used to stack one full reload each, all refetching the same rows.
test('concurrent loads are joined, not duplicated', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  const hits = counter(page);
  await page.evaluate(`Promise.all([loadData(),loadData(),loadData()])`);
  await page.waitForTimeout(500);
  expect(hits['queue_entries'] || 0).toBe(1);      // three callers, one fetch
});

test('a light load is joined the same way', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  const hits = counter(page);
  await page.evaluate(`Promise.all([loadDataLight(),loadDataLight(),loadDataLight()])`);
  await page.waitForTimeout(500);
  expect(hits['queue_entries'] || 0).toBe(1);
});

// The 30s poll used to rebuild the roster whether or not anything had moved, landing in the
// middle of whatever staff were doing.
test('a poll that changed nothing does not rebuild the screen', async ({ page }) => {
  await bootStaff(page);
  // the fetch is pinned so the poll cannot reload state out from under the assertions;
  // what is under test is the decision to re-render, not the fetch
  await page.evaluate(`S.view='staff';S.staffTab='queue';window.__noWiden=false;
    loadDataLight=async()=>{};
    window.__renders=0;const _r=renderStaffQueue;renderStaffQueue=function(){window.__renders++;return _r.apply(null,arguments);}`);
  await page.evaluate(`_autoRefresh(false)`);      // first pass records the fingerprint
  await page.evaluate(`_autoRefresh(false)`);
  await page.evaluate(`_autoRefresh(false)`);
  expect(await page.evaluate('window.__renders')).toBe(1);
  // but a real change still paints
  await page.evaluate(`S.queue=[...(S.queue||[]),{id:'x1',status:'waiting',queueNum:99,sessionId:'${S1}'}];_autoRefresh(false)`);
  expect(await page.evaluate('window.__renders')).toBe(2);
});
