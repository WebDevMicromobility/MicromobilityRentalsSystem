import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// The Saudi National Day 96 ride: a public, paid community ride with its own card on the
// event picker and its own skin on the Reserve flow. What is checked here is what would
// quietly break it — the card appearing at all, the ride filtering to its own sessions,
// the members gate staying off, the party cap, and the skin coming off again on the way out.

const snd = {
  id: 'snd1', day: 'Wednesday', session_date: '2099-09-23', capacity: 24, status: 'open',
  created_at: 1, location: 'JCC', event_kind: 'community', ride_kind: 'snd96',
  needs_approval: false, hide_queue: false, paid_ride: true, open_to_all: true,
  spots: null, title: 'Saudi National Day 96 Ride',
  bike_slots: JSON.stringify({ _time: '20:00 - 22:00', Road: 12, Hybrid: 12 }),
};
const jcc = { id: 's1', day: 'Sunday', session_date: '2099-09-27', capacity: 12, status: 'open', created_at: 1, location: 'JCC' };
const sat = {
  id: 'comm1', day: 'Saturday', session_date: '2099-09-26', capacity: 20, status: 'open', created_at: 1,
  location: 'JCC', event_kind: 'community', needs_approval: true, hide_queue: true, spots: 20, title: 'Saturday Social Ride',
};
const fixtures = { sessions: [jcc, snd, sat], bikes: [], queue_entries: [] };

async function boot(page: Page) {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
}

test('the event picker carries the National Day card, with the official lockup', async ({ page }) => {
  await boot(page);
  const card = page.locator('.landing-event-card.ev-snd96');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Saudi National Day 96 Ride');
  await expect(card.locator('img')).toHaveAttribute('src', 'assets/snd96-logo.svg');
});

test('the ride is open to everyone: no members gate between the card and the sessions', async ({ page }) => {
  await boot(page);
  await page.locator('.landing-event-card.ev-snd96').click();
  // the gate that answers a community click never opens for this ride
  await expect(page.locator('#comm-members-modal, .comm-members-box')).toHaveCount(0);
  await expect(page.locator('.sess-card')).toHaveCount(1);
  await expect(page.locator('.sess-card')).toContainText('Saudi National Day 96 Ride');
  expect(await page.evaluate(`_openToAll(allSessions().find(s=>s.id==='snd1'))`)).toBe(true);
});

test('each card lists only its own ride', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`allSessions().filter(s=>_evMatch(s,'snd96')).map(s=>s.id)`)).toEqual(['snd1']);
  // the umbrella card keeps the Saturday ride and does NOT swallow the National Day one
  expect(await page.evaluate(`allSessions().filter(s=>_evMatch(s,'community')).map(s=>s.id)`)).toEqual(['comm1']);
  expect(await page.evaluate(`allSessions().filter(s=>_evMatch(s,'jcc')).map(s=>s.id)`)).toEqual(['s1']);
});

test('the flow wears the skin while it is on the ride, and takes it off on the way out', async ({ page }) => {
  await boot(page);
  await page.locator('.landing-event-card.ev-snd96').click();
  expect(await page.evaluate(`document.body.classList.contains('snd96')`)).toBe(true);
  await expect(page.locator('.snd-flow-head')).toBeVisible();
  // a different ride is a different flow: the skin must not follow it
  await page.evaluate(`selectEvent('jcc')`);
  await expect(page.locator('.snd-flow-head')).toHaveCount(0);
  expect(await page.evaluate(`document.body.classList.contains('snd96')`)).toBe(false);
});

test('one account seats a party of three, and the ticket carries the ride', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(`_maxRiders(allSessions().find(s=>s.id==='snd1'))`)).toBe(3);
  await page.locator('.landing-event-card.ev-snd96').click();
  await page.locator('.sess-card').first().click();
  await page.evaluate(`
    S.lastTickets=[{id:'bk1',queueNum:12,status:'waiting',sessionId:'snd1',sessionDay:'Wednesday',
      sessionDate:'23 Sep 2099',name:'Spec Rider',typePreference:'Road',price:60,paid:false}];
    renderRegister();`);
  await expect(page.locator('.ticket-card.ev-snd96')).toBeVisible();
});

// ── Its times gather, they do not run to an end ──────────────────────────────
// The National Day ride gathers and then sets off, so its two times are "gathering" and
// "start": there is no end time to ask for and no bike collection time either. That used to
// be inferred from needing staff approval, which this ride does not, so the two ideas had to
// come apart: the ride KIND decides now.

test('its stored times read as gathering then start, and Petromin still reads start then end', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider', session_token: 'tok' });
  await page.goto('/');
  await waitForSb(page);

  expect(await page.evaluate(`_gathersTime(allSessions().find(s=>s.id==='snd1'))`)).toBe(true);
  // 20:00 - 22:00 on a gathering ride means gather at 8 and set off at 10 — no end time.
  expect(await page.evaluate(`sessionCollectTime(allSessions().find(s=>s.id==='snd1'))`)).toBe('20:00');
  expect(await page.evaluate(`sessionTime(allSessions().find(s=>s.id==='snd1'))`)).toMatch(/8 PM.*10 PM/);

  // The Saturday ride gathers too, and always did.
  expect(await page.evaluate(`_gathersTime(allSessions().find(s=>s.id==='comm1'))`)).toBe(true);

  // Petromin does NOT: it hands bikes out, so its window is start-to-end and its collection
  // time is 45 minutes before the off. This is the regression the trait change could cause.
  const petro = `{id:'p1',day:'Wednesday',session_date:'2099-09-30',status:'open',capacity:35,
    event_kind:'community',ride_kind:'petromin',paid_ride:true,needs_approval:false,
    bike_slots:JSON.stringify({_time:'19:00 - 21:00',_total:35})}`;
  expect(await page.evaluate(`_gathersTime(${petro})`)).toBe(false);
  expect(await page.evaluate(`sessionCollectTime(${petro})`)).toBe('18:15');
  expect(await page.evaluate(`_gathersTime(allSessions().find(s=>s.id==='s1'))`)).toBe(false);
});

test('the ticket names the gathering, not a bike collection', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider', session_token: 'tok' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.lastTickets=[{id:'t1',queueNum:4,name:'Spec Rider',sessionId:'snd1',
    sessionDay:'Wednesday',sessionDate:'2099-09-23',status:'waiting'}];S.regStep=4;setCustTab('register')`);
  const card = page.locator('.ticket-card').first();
  await expect(card).toContainText('8 PM');
  await expect(card).toContainText(/Gathering time/i);
  await expect(card).not.toContainText(/collection/i);
});

test('the session form asks for a gathering and a start, with no end and no collection time', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await page.addInitScript(() => localStorage.setItem('cq_staff', '1'));
  await page.goto('/');
  await waitForSb(page);
  // Two named times: yes. Petromin keeps its window plus a bike collection time.
  expect(await page.evaluate(`(()=>{S.newSessEvent='snd96';return _nsTwoTimes();})()`)).toBe(true);
  expect(await page.evaluate(`(()=>{S.newSessEvent='petromin';return _nsTwoTimes();})()`)).toBe(false);
  expect(await page.evaluate(`_twoTimesSess(allSessions().find(s=>s.id==='snd1'))`)).toBe(true);
  expect(await page.evaluate(`_gathers(allSessions().find(s=>s.id==='snd1'))`)).toBe(true);

  // ...but it is NOT a spots ride. It rents bikes from the fleet and it is paid, so it keeps
  // the fleet picker and the add-ons and does not get a meeting point. Counting spots and
  // naming two times are different questions, and conflating them cost this ride its fleet.
  expect(await page.evaluate(`(()=>{S.newSessEvent='snd96';return _nsSeats();})()`)).toBe(false);
  expect(await page.evaluate(`_needsBike(allSessions().find(s=>s.id==='snd1'))`)).toBe(true);
  // The pool session is the other way round: spots, no bikes, and start-to-end times.
  expect(await page.evaluate(`(()=>{S.newSessEvent='swim';return [_nsSeats(),_nsTwoTimes()];})()`)).toEqual([true, true]);
  expect(await page.evaluate(`_kindHas('swim','gathering')`)).toBe(false);
});
