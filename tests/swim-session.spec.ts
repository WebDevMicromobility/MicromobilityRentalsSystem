import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, unlockStaff, waitForSb } from './helpers/supabase';

// A swim session is a community session that involves no bicycle. It answers four of the
// five questions the code asks about a session exactly as the Saturday ride does — members
// only, staff approve, one spot each, the queue stays hidden — and a sixth one for the first
// time: there is no bike to size, choose, or hand over.
//
// The booking still has to satisfy two NOT NULL columns, so it carries type_preference
// 'None' (a deliberate sentinel: 'Any' would mean "any bike will do") and an empty size.

const SWIM = 'swim-1';
const RIDE = 'ride-1';
const sessions = [
  {
    id: SWIM, day: 'Thursday', session_date: '2099-03-05', capacity: 20, status: 'open', created_at: 2,
    event_kind: 'community', ride_kind: 'swim', needs_approval: true, hide_queue: true, paid_ride: false,
    spots: 20, title: 'Thursday Swim Session', meet_url: 'https://maps.example.test/pool',
    bike_slots: '{"_time":"18:00 - 19:30","_total":20}',
  },
  {
    id: RIDE, day: 'Saturday', session_date: '2099-03-07', capacity: 20, status: 'open', created_at: 1,
    event_kind: 'community', ride_kind: 'saturday', needs_approval: true, hide_queue: true, paid_ride: false,
    spots: 20, bike_slots: '{"_time":"05:30 - 06:00","_total":20}',
  },
];

async function asMember(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [], 'rpc:community_member': true });
  await loginCustomer(page, { id: 'c1', name: 'Spec Swimmer' });
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`S.dataLoaded===true`);
  await page.evaluate(`S.selEvent='community';goCustomer('register');S.regStep=1;renderRegister()`);
}

test('a swim session is bike-free; a ride is not', async ({ page }) => {
  await asMember(page);
  expect(await page.evaluate(`_needsBike(allSessions().find(s=>s.id==='${SWIM}'))`)).toBe(false);
  expect(await page.evaluate(`_needsBike(allSessions().find(s=>s.id==='${RIDE}'))`)).toBe(true);
  expect(await page.evaluate(`_rideKind(allSessions().find(s=>s.id==='${SWIM}'))`)).toBe('swim');
});

test('it keeps the Saturday shape: members only, approved, solo, free, hidden queue', async ({ page }) => {
  await asMember(page);
  const s = await page.evaluate(`(()=>{const x=allSessions().find(s=>s.id==='${SWIM}');
    return {community:_isCommunity(x),approval:_isApprovalRide(x),free:_isFreeRide(x),group:_isGroupRide(x)};})()`);
  expect(s).toEqual({ community: true, approval: true, free: true, group: false });
});

test('choosing it skips the riders step — there is nothing to ask', async ({ page }) => {
  await asMember(page);
  await page.evaluate(`S.selSession='${SWIM}';regNextFromSession()`);
  expect(await page.evaluate('S.regStep')).toBe(2.5);          // straight to the waiver
  await expect(page.locator('#tab-register')).not.toContainText('Bike Type');
  await expect(page.locator('#tab-register')).not.toContainText('Height');
});

test('a ride still goes through the riders step', async ({ page }) => {
  await asMember(page);
  await page.evaluate(`S.selSession='${RIDE}';regNextFromSession()`);
  expect(await page.evaluate('S.regStep')).toBe(2);
});

test('the swimmer agrees to a swim waiver, not a cycling one', async ({ page }) => {
  await asMember(page);
  await page.evaluate(`S.selSession='${SWIM}';regNextFromSession()`);
  const panel = page.locator('#tab-register');
  await expect(panel).toContainText('swimming carries risk');
  await expect(panel).not.toContainText('wear a helmet');
  await expect(panel).not.toContainText('rented bike');
  // the wrapper has to name the activity too, or the record says a swimmer accepted a
  // "Ride waiver" on behalf of every "rider" — consent to the wrong thing
  await expect(panel).toContainText('Swim waiver');
  await expect(panel).not.toContainText('Ride waiver');
  await expect(panel).toContainText('on behalf of everyone on this booking');
  await expect(panel).not.toContainText('every rider on this booking');
});

test('back from the waiver returns to the session list, not an empty step', async ({ page }) => {
  await asMember(page);
  await page.evaluate(`S.selSession='${SWIM}';regNextFromSession()`);
  await page.locator('#tab-register .mm-reg-foot .btn-secondary').click();
  expect(await page.evaluate('S.regStep')).toBe(1);
});

test('the booking carries the sentinel type and the swim waiver version', async ({ page }) => {
  await asMember(page);
  const rpc: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rpc/customer_create_booking')) rpc.push(r.postData() || '');
  });
  await page.evaluate(`S.selSession='${SWIM}';regNextFromSession();toggleWaiver(true);regWaiverContinue();submitReg()`);
  await expect.poll(() => rpc.length, { timeout: 6000 }).toBeGreaterThan(0);
  const e = JSON.parse(rpc[0]).p_entries[0];
  expect(e.type_preference).toBe('None');   // not 'Any' — that would mean "any bike will do"
  expect(e.size).toBe('');
  expect(e.waiver_version).toBe('swim-2026-08-v1');
  expect(e.price).toBe(0);                  // free, like the Saturday ride
});

test('the stepper names the middle step for what it actually is', async ({ page }) => {
  await asMember(page);
  await page.evaluate(`S.selSession='${SWIM}';regNextFromSession()`);
  await expect(page.locator('#tab-register .reg-stepper')).toContainText('Swim waiver');
  await expect(page.locator('#tab-register .reg-stepper')).not.toContainText('Riders');
});

test('staff checking a swimmer in are offered no bike', async ({ page }) => {
  await stubSupabase(page, {
    sessions, bikes: [{ id: 'b1', name: 'R-01', type: 'Road', size: 'M', status: 'available', colors: [] }],
    queue_entries: [{
      id: 'q1', session_id: SWIM, session_day: 'Thursday', session_date: '2099-03-05', queue_num: 1,
      name: 'Spec Swimmer', type_preference: 'None', size: '', status: 'waiting', paid: false, price: 0,
      registered_at: '2099-01-01T10:00:00Z', approval: 'approved',
    }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  await page.evaluate(`showCheckinModal('q1')`);
  const html = await page.evaluate(`document.getElementById('checkin-modal').innerHTML`) as string;
  expect(html).not.toContain('openModal(');       // no route into the bike picker
  expect(html).toContain('confirmCheckinModal');  // but they can still be marked as here
});

test('the swim session carries its own identity colour, not the circuit blue', async ({ page }) => {
  await asMember(page);
  const cls = await page.evaluate(`_evClass(allSessions().find(s=>s.id==='${SWIM}'))`);
  expect(cls).toBe('ev-swim');
});
