import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, loginCustomer, waitForSb } from './helpers/supabase';

// The loaders' own races: what a load in flight may and may not overwrite, which load a late
// caller is handed, and how the paged fetches stay whole.

const S1 = '2099-12-01';
const sessions = [{ id: S1, session_date: S1, day: 'Tuesday', status: 'open', capacity: 10, created_at: 1 }];
const customers = [{ id: 'c1', name: 'Old Name', phone: '0500000001', created_at: '2026-01-01T00:00:00Z' }];

async function bootStaff(page: import('@playwright/test').Page, extra: Record<string, unknown> = {}) {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [], customers, tags: [{ id: 't1', name: 'Member' }], customer_tags: [], ...extra });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
}

test('a staff-ref change that lands during a load is not undone by it', async ({ page }) => {
  await bootStaff(page);
  const out = await page.evaluate(`(async()=>{
    const p=loadData();                     // the customer list is fresh, so this load does not refetch it
    _rtRefMerge('customers',{op:'INSERT',row:{id:'cNew',name:'New Signup'}});
    _rtRefMerge('customers',{op:'UPDATE',row:{id:'c1',name:'Edited'}});
    await p;
    return S.customers.map(c=>c.id+':'+c.name).sort();
  })()`);
  expect(out).toEqual(['c1:Edited', 'cNew:New Signup']);
});

test('changes that arrive while the lists are refetched are laid over the fresh copy, and a write keeps them dirty', async ({ page }) => {
  await bootStaff(page);
  const out = await page.evaluate(`(async()=>{
    refDirty();                             // the next load refetches the lists
    const p=loadData();
    _rtRefMerge('customers',{op:'INSERT',row:{id:'cNew',name:'New Signup'}});
    _rtRefMerge('customer_tags',{op:'INSERT',row:{customer_id:'c1',tag_id:'t1'}});
    refDirty();                             // something written while the pages were on the wire
    await p;
    return {ids:S.customers.map(c=>c.id).sort(),tags:S.customerTags.map(x=>x.customer_id+'/'+x.tag_id),dirty:_refDirty};
  })()`);
  expect(out).toEqual({ ids: ['c1', 'cNew'], tags: ['c1/t1'], dirty: true });
});

test('a caller who asks after the follow-up load has left gets a load of its own', async ({ page }) => {
  await bootStaff(page);
  const out = await page.evaluate(`(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const real=_loadDataInner;let n=0;const log=[];
    window._loadDataInner=async()=>{const id=++n;log.push('start'+id);await sleep(300);log.push('end'+id);return id;};
    try{
      const a=loadData();await sleep(20);
      const b=loadData();                  // mid-flight: shares the one follow-up
      const b2=loadData();
      await sleep(400);                    // load 1 is done, the follow-up (load 2) is on the wire
      const c=loadData();                  // wrote after load 2 left
      return {got:await Promise.all([a,b,b2,c]),log};
    }finally{window._loadDataInner=real;}
  })()`) as { got: number[]; log: string[] };
  expect(out.got).toEqual([1, 2, 2, 3]);
  expect(out.log).toEqual(['start1', 'end1', 'start2', 'end2', 'start3', 'end3']);
});

test('queue pages are sorted to a total order and a row seen on two pages is kept once', async ({ page }) => {
  const rows = Array.from({ length: 1200 }, (_, i) => ({
    id: 'q' + String(i).padStart(4, '0'), session_id: 's-old', session_day: 'Monday', session_date: '2020-01-06',
    queue_num: 1, name: 'R' + i, status: 'cancelled', type_preference: 'Any', paid: false, price: 30, registered_at: '2020-01-01T00:00:00Z',
  }));
  const urls: string[] = [];
  await stubSupabase(page, { sessions, bikes: [], customers: [] });
  await page.route(/\/rest\/v1\/queue_entries/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();
    const u = new URL(req.url());
    urls.push(u.search);
    const off = Number(u.searchParams.get('offset') || 0);
    // The second page starts one row early, as a row inserted into the first page would make it.
    const page2 = rows.slice(999, 1200);
    const body = off === 0 ? rows.slice(0, 1000) : page2;
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  expect(await page.evaluate(`S.queue.length`)).toBe(1200);
  expect(await page.evaluate(`new Set(S.queue.map(e=>e.id)).size`)).toBe(1200);
  const listed = urls.map((u) => decodeURIComponent(u)).find((u) => u.includes('order=session_id'));
  expect(listed).toContain('order=session_id.asc,queue_num.asc,id.asc');
});

test('sales page by the last id, so a sale rung up mid-sequence cannot shift the pages', async ({ page }) => {
  const sales = Array.from({ length: 1005 }, (_, i) => ({ id: 'a' + String(i).padStart(4, '0'), item: 'Water', qty: 1, price: 5, pay: 'paid', created_at: '2099-01-01T10:00:00Z' }));
  const urls: string[] = [];
  await stubSupabase(page, { sessions, bikes: [], customers: [] });
  await page.route(/\/rest\/v1\/cashier_sales/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();
    const u = new URL(req.url());
    urls.push(decodeURIComponent(u.search));
    const after = (u.searchParams.get('id') || '').replace(/^gt\./, '');
    const body = after ? sales.filter((s) => s.id > after).slice(0, 1000) : sales.slice(0, 1000);
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await expect.poll(() => page.evaluate(`(S.cashSales||[]).length`)).toBe(1005);
  const second = urls.find((u) => u.includes('id=gt.'));
  expect(second).toBeTruthy();
  expect(second).toContain('id=gt.a0999');
  expect(second).not.toContain('offset=');
});

const secureOn = (page: import('@playwright/test').Page) =>
  page.addInitScript(() => localStorage.setItem('cq_secure_auth', '1'));
const openSession = { id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, bike_slots: null };
const mine = { id: 'q-mine', name: 'Secure Rider', email: 'secure@example.com', phone: '0500000009', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 3, status: 'waiting', size: 'M', type_preference: 'Any', paid: false, price: 30, assigned_bike_id: null, walk_in: false, customer_id: 'c9', registered_at: '2026-01-01T10:00:00Z' };
const errJson = (status: number, code: string, message: string) => ({ status, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ code, message, details: null, hint: null }) });

test('a failed my_bookings keeps the customer\'s own bookings instead of reporting an empty success', async ({ page }) => {
  await stubSupabase(page, { sessions: [openSession], queue_public: [], 'rpc:my_bookings': [mine] });
  await secureOn(page);
  await loginCustomer(page, { id: 'c9', name: 'Secure Rider', email: 'secure@example.com', session_token: 'tok123' });
  await page.goto('/');
  await waitForSb(page);
  await expect.poll(() => page.evaluate(`S.queue.some(e=>e.id==='q-mine')`)).toBe(true);
  await page.route(/\/rest\/v1\/rpc\/my_bookings/, (r) => r.fulfill(errJson(503, 'XX000', 'upstream timed out')));
  await page.evaluate(`loadData().then(()=>loadDataLight())`);
  expect(await page.evaluate(`S.queue.some(e=>e.id==='q-mine')`)).toBe(true);
});

test('a failed list_sessions keeps the member\'s private ride instead of falling back to the public list', async ({ page }) => {
  const comm = { id: 'comm1', day: 'Saturday', session_date: '2099-01-10', capacity: 12, status: 'open', created_at: 1, event_kind: 'community', required_tag_id: 't1' };
  await stubSupabase(page, { sessions: [openSession], 'rpc:list_sessions': [openSession, comm] });
  await loginCustomer(page);
  await page.goto('/');
  await waitForSb(page);
  await expect.poll(() => page.evaluate(`S.sessions.some(s=>s.id==='comm1')`)).toBe(true);
  let direct = 0;
  page.on('request', (r) => { if (r.method() === 'GET' && /\/rest\/v1\/sessions/.test(r.url())) direct++; });
  await page.route(/\/rest\/v1\/rpc\/list_sessions/, (r) => r.fulfill(errJson(503, 'XX000', 'upstream timed out')));
  await page.evaluate(`loadData()`);
  expect(await page.evaluate(`S.sessions.some(s=>s.id==='comm1')`)).toBe(true);
  expect(direct).toBe(0);
});

test('a database without list_sessions still falls back to the plain select', async ({ page }) => {
  await stubSupabase(page, { sessions: [openSession], 'rpc:list_sessions': { __rpcError: { status: 404, code: 'PGRST202', message: 'Could not find the function public.list_sessions' } } });
  await page.goto('/');
  await waitForSb(page);
  await expect.poll(() => page.evaluate(`S.sessions.map(s=>s.id)`)).toEqual(['s1']);
});
