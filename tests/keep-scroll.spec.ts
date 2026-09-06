import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The staff roster holds the staffer's place across an in-place rebuild (_keepScroll). It used
// to give up after four animation frames, which is a guess about how long a rebuild takes made
// on a fast machine — on a booth phone with a 200-row roster the rows land later than that and
// the staffer is dropped at the top mid-shift, with nothing on screen explaining why.

const today = new Date().toISOString().slice(0, 10);
const sessions = [{ id: today, day: 'Sunday', session_date: today, capacity: 200, status: 'open', created_at: 1 }];
const bikes = [
  { id: 'b1', name: 'B1', size: 'M', type: 'Road', status: 'available', rental_price: 75, photo: null },
  { id: 'b2', name: 'B2', size: 'L', type: 'Road', status: 'available', rental_price: 75, photo: null },
];
const inventory = [{ id: 'i1', name: 'Vitamin Water', category: 'Drinks', qty: 5, price: 10, low_threshold: 1, photo: null }];
const customers = [{ id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', created_at: '2026-01-01' }];

async function boot(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, bikes, inventory, customers, queue_entries: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
}

/** Stands in for a rebuild: the page goes short for `gapMs`, then the rows land.
 *  Returns where the staffer was, which is not exactly what we asked for — the sticky
 *  topbar and scroll anchoring move it a pixel or three. */
async function rebuildTaking(page: import('@playwright/test').Page, gapMs: number) {
  await page.evaluate(`
    const sp=document.createElement('div');sp.id='zz-spacer';sp.style.height='8000px';
    document.body.appendChild(sp);`);
  await page.evaluate(`window.scrollTo(0,5000)`);
  await page.waitForTimeout(120);
  const was = await page.evaluate(`Math.round(window.scrollY)`) as number;
  await page.evaluate(`(()=>{
    _keepScroll();                                             // as renderStaffQueue calls it
    document.getElementById('zz-spacer').style.height='0px';   // …then the rebuild empties it
    setTimeout(()=>{document.getElementById('zz-spacer').style.height='8000px';},${gapMs});
  })()`);
  await page.waitForTimeout(gapMs + 500);
  return was;
}

test.describe('the roster holds its place across a rebuild', () => {
  test('rows that land well after four frames still find the staffer where they were', async ({ page }) => {
    await boot(page);
    const was = await rebuildTaking(page, 300); // ~18 frames: the old four-frame budget was long gone
    expect(await page.evaluate(`Math.round(window.scrollY)`)).toBeCloseTo(was, -1);
  });

  test('a rebuild that pauses mid-flight is still waited out', async ({ page }) => {
    await boot(page);
    // A shrink, a long pause on a fetch, then the rows. "Stop once the height settles" would
    // have ended the restore during the pause — the same bug wearing a smarter hat.
    const was = await rebuildTaking(page, 550);
    expect(await page.evaluate(`Math.round(window.scrollY)`)).toBeCloseTo(was, -1);
  });

  test('a genuinely shorter list is not fought', async ({ page }) => {
    await boot(page);
    await page.evaluate(`
      const sp=document.createElement('div');sp.id='zz-spacer';sp.style.height='8000px';
      document.body.appendChild(sp);`);
    await page.evaluate(`window.scrollTo(0,5000)`);
    await page.waitForTimeout(120);
    // The rows are gone for good (a filter, a closed-out night): land at the new bottom and stop.
    await page.evaluate(`_keepScroll();document.getElementById('zz-spacer').style.height='1200px';`);
    await page.waitForTimeout(1100);
    const { y, max } = await page.evaluate(`({y:Math.round(window.scrollY),max:Math.max(0,document.documentElement.scrollHeight-window.innerHeight)})`) as { y: number; max: number };
    expect(y).toBeLessThan(5000);
    expect(Math.abs(y - max)).toBeLessThanOrEqual(2); // as far down as the shorter page allows
  });

  test('a hand on the screen wins', async ({ page }) => {
    await boot(page);
    await page.evaluate(`
      const sp=document.createElement('div');sp.id='zz-spacer';sp.style.height='8000px';
      document.body.appendChild(sp);`);
    await page.evaluate(`window.scrollTo(0,5000)`);
    await page.waitForTimeout(120);
    // Restoring for up to 700ms must never yank a staffer who has started scrolling.
    await page.evaluate(`(()=>{
      _keepScroll();
      document.getElementById('zz-spacer').style.height='0px';
      window.dispatchEvent(new WheelEvent('wheel',{deltaY:-200}));
      setTimeout(()=>{document.getElementById('zz-spacer').style.height='8000px';window.scrollTo(0,200);},250);
    })()`);
    await page.waitForTimeout(700);
    expect(await page.evaluate(`Math.round(window.scrollY)`)).toBe(200); // left where they put it
  });
});

// A check-in flips one bike to 'in-use'; a sale decrements an inventory row. Both used to be
// routed as "reload EVERYTHING" — the whole fleet and all of inventory, base64 photos included,
// on every device at the booth, ~350ms after the tap. A second and much heavier rebuild of a
// change the device had already drawn, and the one most likely to outlast the scroll restore.
test.describe('a routine row change does not drag the whole dataset down', () => {
  const bikeEvt = (over: Record<string, unknown> = {}) => JSON.stringify({
    table: 'bikes', eventType: 'UPDATE',
    new: { id: 'b1', name: 'B1', size: 'M', type: 'Road', status: 'in-use', rental_price: 75, photo: null },
    ...over,
  });
  const invEvt = (over: Record<string, unknown> = {}) => JSON.stringify({
    table: 'inventory', eventType: 'UPDATE',
    new: { id: 'i1', name: 'Vitamin Water', category: 'Drinks', qty: 3, price: 10, low_threshold: 1, photo: null },
    ...over,
  });

  const wantFullAfter = (page: import('@playwright/test').Page, payload: string) =>
    page.evaluate(`(()=>{_rtWantFull=false;_onRt(${payload});return _rtWantFull;})()`);

  test('a bike status flip is applied from the event, no full reload asked for', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, bikeEvt())).toBe(false);
    expect(await page.evaluate(`S.bikes.find(b=>b.id==='b1').status`)).toBe('in-use');
  });

  test('a stock decrement is applied from the event, no full reload asked for', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, invEvt())).toBe(false);
    expect(await page.evaluate(`S.inventory.find(i=>i.id==='i1').qty`)).toBe(3);
  });

  test('the merged row carries every field the event brought', async ({ page }) => {
    await boot(page);
    // Not just status: skipping the full reload must not leave a rename stale on other devices.
    await wantFullAfter(page, bikeEvt({ new: { id: 'b1', name: 'Renamed', size: 'M', type: 'Road', status: 'in-use', rental_price: 90, photo: null } }));
    const b = await page.evaluate(`S.bikes.find(b=>b.id==='b1')`) as { name: string; rental_price: number };
    expect(b.name).toBe('Renamed');
    expect(b.rental_price).toBe(90);
  });

  test('a new or deleted row still asks for the full reload', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, bikeEvt({ eventType: 'INSERT' }))).toBe(true);
    expect(await wantFullAfter(page, bikeEvt({ eventType: 'DELETE' }))).toBe(true);
    expect(await wantFullAfter(page, invEvt({ eventType: 'INSERT' }))).toBe(true);
  });

  test('a row this device has never seen asks for the full reload', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, bikeEvt({ new: { id: 'b99', name: 'New', status: 'available' } }))).toBe(true);
    expect(await wantFullAfter(page, invEvt({ new: { id: 'i99', name: 'New', qty: 1 } }))).toBe(true);
  });

  test('a flagged or clipped payload asks for the full reload', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, bikeEvt({ errors: 'payload too large' }))).toBe(true);
    expect(await wantFullAfter(page, bikeEvt({ new: { id: 'b1', status: 'in-use' } }))).toBe(true); // no name
    expect(await wantFullAfter(page, invEvt({ new: {} }))).toBe(true);
  });

  test('the tables the light path already carries never asked for one', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, JSON.stringify({ table: 'queue_entries', eventType: 'UPDATE', new: { id: 'q1' } }))).toBe(false);
    expect(await wantFullAfter(page, JSON.stringify({ table: 'cashier_sales', eventType: 'INSERT', new: { id: 1 } }))).toBe(false);
  });
});

// Customers are the one table that must NOT be merged from its payload: that row is the WHOLE
// row, password_hash and base64 photo included, and loadData deliberately reads a narrow column
// list without either. They are reference data with their own loader, so a customers change
// re-reads just customers and tags instead of pulling the fleet and inventory down with them.
test.describe('a customer edit re-reads customers, not everything', () => {
  test('it refetches customers and never asks for the full reload', async ({ page }) => {
    await boot(page);
    const paths: string[] = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/rest/v1/')) paths.push(u.pathname + u.search); });
    const wantFull = await page.evaluate(`(()=>{_rtWantFull=false;_onRt({table:'customers',eventType:'UPDATE',new:{id:'c1',name:'Edited'}});return _rtWantFull;})()`);
    await page.waitForTimeout(600);
    expect(wantFull).toBe(false);
    expect(paths.some((p) => p.startsWith('/rest/v1/customers'))).toBe(true);
    expect(paths.some((p) => p.startsWith('/rest/v1/bikes') && p.includes('select=*'))).toBe(false);
    expect(paths.some((p) => p.startsWith('/rest/v1/inventory'))).toBe(false);
  });

  test('the narrow column list is what gets read — no password_hash, no photo', async ({ page }) => {
    await boot(page);
    const reads: string[] = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/rest/v1/customers') reads.push(u.searchParams.get('select') || ''); });
    await page.evaluate(`_onRt({table:'customers',eventType:'UPDATE',new:{id:'c1',name:'Edited'}})`);
    await page.waitForTimeout(600);
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((s) => !s.includes('password_hash') && !s.includes('photo') && s !== '*')).toBe(true);
  });
});
