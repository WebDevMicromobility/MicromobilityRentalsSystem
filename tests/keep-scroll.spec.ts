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

async function boot(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, bikes, queue_entries: [] });
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

// A check-in flips one bike to 'in-use'. That used to be routed as "bikes changed → reload
// EVERYTHING", which refetches the whole fleet and every base64 photo, on every device at the
// booth, ~350ms after Confirm — a second and much heavier rebuild of a change this device had
// already drawn, and the one most likely to outlast the scroll restore above.
test.describe('a bike status flip does not drag the whole fleet down', () => {
  const evt = (over: Record<string, unknown> = {}) => JSON.stringify({
    table: 'bikes', eventType: 'UPDATE',
    new: { id: 'b1', name: 'B1', size: 'M', type: 'Road', status: 'in-use', rental_price: 75, photo: null },
    ...over,
  });

  const wantFullAfter = (page: import('@playwright/test').Page, payload: string) =>
    page.evaluate(`(()=>{_rtWantFull=false;_onRt(${payload});return _rtWantFull;})()`);

  test('a status flip is applied from the event, no full reload asked for', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, evt())).toBe(false);
    expect(await page.evaluate(`S.bikes.find(b=>b.id==='b1').status`)).toBe('in-use');
  });

  test('the merged row carries every field the event brought', async ({ page }) => {
    await boot(page);
    // Not just status: skipping the full reload must not leave a rename stale on other devices.
    await wantFullAfter(page, evt({ new: { id: 'b1', name: 'Renamed', size: 'M', type: 'Road', status: 'in-use', rental_price: 90, photo: null } }));
    const b = await page.evaluate(`S.bikes.find(b=>b.id==='b1')`) as { name: string; rental_price: number };
    expect(b.name).toBe('Renamed');
    expect(b.rental_price).toBe(90);
  });

  test('a new or deleted bike still asks for the full reload', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, evt({ eventType: 'INSERT' }))).toBe(true);
    expect(await wantFullAfter(page, evt({ eventType: 'DELETE' }))).toBe(true);
  });

  test('a bike this device has never seen asks for the full reload', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, evt({ new: { id: 'b99', name: 'New', status: 'available' } }))).toBe(true);
  });

  test('a flagged or truncated payload asks for the full reload', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, evt({ errors: 'payload too large' }))).toBe(true);
    expect(await wantFullAfter(page, evt({ new: { id: 'b1', status: 'in-use' } }))).toBe(true); // no name: truncated
  });

  test('inventory and customers are untouched — they only ship in the full load', async ({ page }) => {
    await boot(page);
    expect(await wantFullAfter(page, JSON.stringify({ table: 'inventory', eventType: 'UPDATE', new: { id: 'i1', qty: 3 } }))).toBe(true);
    expect(await wantFullAfter(page, JSON.stringify({ table: 'customers', eventType: 'UPDATE', new: { id: 'c1' } }))).toBe(true);
    expect(await wantFullAfter(page, JSON.stringify({ table: 'queue_entries', eventType: 'UPDATE', new: { id: 'q1' } }))).toBe(false);
  });
});
