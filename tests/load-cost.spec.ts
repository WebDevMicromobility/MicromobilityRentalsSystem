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
// They are coalesced -- but NOT by handing a late caller the load already in flight. That
// fetch left before whatever they just wrote, so answering with it renders their own change
// away until the next poll. Everyone who arrives mid-flight shares ONE follow-up instead:
// bounded at two round trips for a burst of any size, and never stale.
test('a burst of loads is bounded, not one fetch each', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  await page.route('**/rest/v1/queue_entries*', async (route) => {
    await new Promise((r) => setTimeout(r, 250));      // real latency, or no burst can form
    await route.continue();
  });
  const hits = counter(page);
  await page.evaluate(`Promise.all([loadData(),loadData(),loadData(),loadData(),loadData()])`);
  await page.waitForTimeout(900);
  expect(hits['queue_entries'] || 0).toBeGreaterThan(0);
  expect(hits['queue_entries'] || 0).toBeLessThanOrEqual(2);   // five callers, at most two fetches
});

test('a load issued mid-flight is answered by a FRESH fetch, not the one already running', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  await page.route('**/rest/v1/queue_entries*', async (route) => {
    await new Promise((r) => setTimeout(r, 300));
    await route.continue();
  });
  const hits = counter(page);
  // stands in for: a staff write lands while the 30s poll's load is already in the air
  await page.evaluate(
    `(async()=>{const a=loadData();await new Promise(r=>setTimeout(r,60));const b=loadData();await Promise.all([a,b]);})()`);
  await page.waitForTimeout(900);
  expect(hits['queue_entries'] || 0).toBeGreaterThanOrEqual(2);
});

test('the light load coalesces the same way', async ({ page }) => {
  await bootStaff(page);
  await page.waitForTimeout(400);
  await page.route('**/rest/v1/queue_entries*', async (route) => {
    await new Promise((r) => setTimeout(r, 300));
    await route.continue();
  });
  const hits = counter(page);
  await page.evaluate(
    `(async()=>{const a=loadDataLight();await new Promise(r=>setTimeout(r,60));const b=loadDataLight();await Promise.all([a,b]);})()`);
  await page.waitForTimeout(900);
  expect(hits['queue_entries'] || 0).toBeGreaterThanOrEqual(2);
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
