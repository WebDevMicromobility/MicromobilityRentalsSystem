import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb, unlockStaff } from './helpers/supabase';

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
  // there is no gate to open: the umbrella never covers this ride, even on this row, which
  // carries the old 'community' stamp
  expect(await page.evaluate(`_isCommunity(allSessions().find(s=>s.id==='snd1'))`)).toBe(false);
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

// ── It is a circuit night, not a community event ─────────────────────────────
// It never needed the umbrella: no members tag, no staff approval, circuit prices, an
// ordinary bike fleet. The flag only decided where staff found it, and it quietly carried
// the ride's identity, because _rideKind answered "jcc" for anything outside the umbrella.

test('it is stamped as a circuit night and still keeps its own identity', async ({ page }) => {
  const plain = { ...snd, event_kind: null };
  await stubSupabase(page, { sessions: [jcc, plain, sat], bikes: [], queue_entries: [] });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider', session_token: 'tok' });
  await page.goto('/');
  await waitForSb(page);
  const s = `allSessions().find(x=>x.id==='snd1')`;

  expect(await page.evaluate(`_isCommunity(${s})`)).toBe(false);   // out of the umbrella
  expect(await page.evaluate(`_rideKind(${s})`)).toBe('snd96');    // ...but still itself
  expect(await page.evaluate(`_evMatch(${s},'snd96')`)).toBe(true); // its own card
  expect(await page.evaluate(`_maxRiders(${s})`)).toBe(3);          // its own rider cap
  expect(await page.evaluate(`_gathersTime(${s})`)).toBe(true);     // and its gathering time
  expect(await page.evaluate(`sessionCollectTime(${s})`)).toBe('20:00');
  // It is not filed with the employer rides, and has no employee registration desk.
  expect(await page.evaluate(`_evMatch(${s},'community')`)).toBe(false);
  expect(await page.evaluate(`allSessions().filter(x=>_isCommunity(x)).map(x=>x.id)`)).not.toContain('snd1');
  // ...and having left the umbrella it must not fall into the circuit list either, or it
  // would be offered twice: once under its own card and once among the circuit nights.
  expect(await page.evaluate(`_evMatch(${s},'jcc')`)).toBe(false);
  expect(await page.evaluate(`allSessions().filter(x=>_evMatch(x,'jcc')).map(x=>x.id)`)).toEqual(['s1']);
});

test('the rider cap rolls with the account, exactly as the circuit does', async ({ page }) => {
  // Three riders per ACCOUNT per session, not per booking. A second booking for the same
  // night draws on the same three, so the cap has to count what the account already holds -
  // a flat three would let a rider book three and then three more.
  const plain = { ...snd, event_kind: null };
  const held = (id: string, sid: string) => ({ id, name: 'Spec Rider', customer_id: 'c1', session_id: sid,
    session_day: 'Wednesday', session_date: '2099-09-23', queue_num: 1, status: 'waiting', paid: false, price: 60 });
  await stubSupabase(page, { sessions: [jcc, plain, sat], bikes: [],
    queue_entries: [held('h1', 'snd1'), held('h2', 'snd1')] });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider', session_token: 'tok' });
  await page.goto('/');
  await waitForSb(page);
  // two of the three already booked leaves one
  expect(await page.evaluate(`_maxRiders(allSessions().find(x=>x.id==='snd1'))`)).toBe(1);
  // and a night the account holds nothing on still offers all three
  expect(await page.evaluate(`_maxRiders(allSessions().find(x=>x.id==='s1'))`)).toBe(3);
});

test('a session stamped the old way still behaves the same', async ({ page }) => {
  // Rows created before this change carry event_kind 'community'. The ride kind is read off
  // the row first, so they keep their card, their cap and their gathering time.
  await stubSupabase(page, { sessions: [jcc, snd, sat], bikes: [], queue_entries: [] });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider', session_token: 'tok' });
  await page.goto('/');
  await waitForSb(page);
  const s = `allSessions().find(x=>x.id==='snd1')`;
  expect(await page.evaluate(`_rideKind(${s})`)).toBe('snd96');
  expect(await page.evaluate(`_gathersTime(${s})`)).toBe(true);
  expect(await page.evaluate(`_maxRiders(${s})`)).toBe(3);
});

test('the circuit, the Saturday ride and Petromin are untouched', async ({ page }) => {
  const pet = { id: 'p1', day: 'Wednesday', session_date: '2099-09-30', capacity: 35, status: 'open',
    created_at: 1, event_kind: 'community', ride_kind: 'petromin', paid_ride: true, needs_approval: false,
    bike_slots: JSON.stringify({ _time: '19:00 - 21:00', _total: 35 }) };
  await stubSupabase(page, { sessions: [jcc, sat, pet], bikes: [], queue_entries: [] });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider', session_token: 'tok' });
  await page.goto('/');
  await waitForSb(page);
  const kind = (id: string) => page.evaluate(`_rideKind(allSessions().find(x=>x.id==='${id}'))`);
  expect(await kind('s1')).toBe('jcc');
  expect(await kind('comm1')).toBe('saturday');
  expect(await kind('p1')).toBe('petromin');
  // Petromin still runs start-to-end with a bike collection time 45 minutes before the off.
  expect(await page.evaluate(`_gathersTime(allSessions().find(x=>x.id==='p1'))`)).toBe(false);
  expect(await page.evaluate(`sessionCollectTime(allSessions().find(x=>x.id==='p1'))`)).toBe('18:15');
});

// ── One date, two rides ──────────────────────────────────────────────────────
// A session's id is its date, so a date holds one session unless the ride carries a mark.
// The National Day ride borrowed the Petromin mark, being paid like one — so the two could
// never share a date. 23 September 2026 already held a Petromin ride, and the National Day
// ride staff tried to put on it was skipped as a date that already exists.
const pw = {
  id: '2099-01-14-pw', day: 'Wednesday', session_date: '2099-01-14', capacity: 35, status: 'closed',
  created_at: 1, event_kind: 'community', ride_kind: 'petromin', paid_ride: true, needs_approval: false,
  bike_slots: JSON.stringify({ _time: '19:00 - 21:00', _total: 35 }),
};

function sessionWrites(page: Page) {
  const writes: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'POST' && r.method() !== 'PATCH') return;
    if (!r.url().includes('/rest/v1/sessions')) return;
    const b = r.postDataJSON();
    (Array.isArray(b) ? b : [b]).forEach((x: Record<string, unknown>) => writes.push({ ...x }));
  });
  return writes;
}

test('it can be put on a date a Petromin ride already holds', async ({ page }) => {
  await stubSupabase(page, { sessions: [pw], queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const writes = sessionWrites(page);
  await page.evaluate(`setStaffTab('sessions');S.showAddSession=true;S.newSessEvent='snd96';S.newSessMode='total';S.newSessTotal='40';renderSessions()`);
  await page.evaluate(`document.getElementById('ns-date').value='2099-01-14';addSession()`);
  await expect.poll(() => writes.length).toBeGreaterThan(1);

  const created = writes.find((w) => w.id);
  expect(created?.id).toBe('2099-01-14-nd');   // its own mark, not the Petromin one
  expect(created?.capacity).toBe(40);
  const gate = Object.assign({}, ...writes.filter((w) => !w.id));
  expect(gate.event_kind).toBe(null);          // a circuit night, not an employer ride
  expect(gate.ride_kind).toBe('snd96');
  expect(gate.paid_ride).toBe(true);
  expect(gate.needs_approval).toBe(false);
});

test('moving its date keeps its mark, so the move cannot land on another ride', async ({ page }) => {
  const nd = { ...snd, id: '2099-01-14-nd', session_date: '2099-01-14', event_kind: null };
  await stubSupabase(page, { sessions: [pw, nd], queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`allSessions().length>1`);
  const writes = sessionWrites(page);
  await page.evaluate(`S.editSessionId='2099-01-14-nd';S.editSessDate='2099-01-21';S.editSessStatus='open';S.editSessMode='total';S.editSessTotal=40;saveSessionEdit()`);
  await expect.poll(() => writes.some((w) => w.id)).toBe(true);
  expect(writes.find((w) => w.id)?.id).toBe('2099-01-21-nd');
});
