import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, loginCustomer, unlockStaff, waitForSb, captureBookingRows } from './helpers/supabase';

// Saudi National Day 96 Ride — a community ride that books itself: open to every rider, no
// approval, real queue numbers, places from the rack, charged at circuit prices. It runs
// once, so its landing card IS the choice and the rider lands on the booking details. It
// also wears the official identity, so the flow and the booking card carry the deep green.

const SND = '2099-09-23-nd';   // the -nd suffix is what lets it share its date with a circuit night
const JCC = '2099-09-23';      // …and this is the circuit session on that very date

const snd = {
  id: SND, day: 'Wednesday', session_date: '2099-09-23', capacity: 30, status: 'open',
  created_at: 3, location: 'JCC', event_kind: 'community', ride_kind: 'snd',
  title: 'Saudi National Day 96 Ride', needs_approval: false, hide_queue: false,
  open_to_all: true, paid_ride: true, spots: null, party_max: 3,
  bike_slots: '{"_time":"21:00 - 23:00","_total":30}',
};
const jcc = {
  id: JCC, day: 'Wednesday', session_date: '2099-09-23', capacity: 12, status: 'open',
  created_at: 1, location: 'JCC', bike_slots: '{"_time":"21:00 - 23:00","_total":12}',
};
const saturday = {
  id: '2099-01-10', day: 'Saturday', session_date: '2099-01-10', capacity: 10, status: 'open',
  created_at: 2, location: 'Corniche', event_kind: 'community', ride_kind: 'saturday',
  title: 'Saturday Social Ride', needs_approval: true, hide_queue: true, spots: 10,
  bike_slots: '{"_time":"05:30 - 06:00","_total":10}',
};
const fixtures = {
  sessions: [jcc, saturday, snd],
  bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }],
  queue_entries: [],
};

async function landing(page: Page, over: Record<string, unknown> = {}) {
  await stubSupabase(page, { ...fixtures, ...over });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate('goLanding()');
}

test('the picker offers it, and its card carries the official lockup and the ride date', async ({ page }) => {
  await landing(page);
  const card = page.locator('#land-events .landing-event-card.ev-snd');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Saudi National Day 96 Ride');
  await expect(card.locator('img')).toHaveAttribute('src', 'snd-logo.png');
  // the date line is read off the session, not out of a translated string
  await expect(card.locator('.lec-when')).toContainText('23 Sept 2099');
  await expect(card.locator('.lec-when')).toContainText('9 PM');
  // it leads the picker: the headline event is the first card
  await expect(page.locator('#land-events .landing-event-card').first()).toHaveClass(/ev-snd/);
});

test('the card is the choice: it opens the booking details, not a session list', async ({ page }) => {
  await landing(page);
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.view==='customer'`);
  expect(await page.evaluate('S.selEvent')).toBe('snd');
  // every rider gets in — the members dialog renders into #confirm-modal, and stays hidden
  await expect(page.locator('#confirm-modal')).toBeHidden();
  // the one session is already chosen, and the picker never appears
  expect(await page.evaluate('S.selSession')).toBe(SND);
  expect(await page.evaluate('S.regStep')).toBe(2);
  await expect(page.locator('#session-picker-wrap')).toHaveCount(0);
  await expect(page.locator('.sess-card')).toHaveCount(0);
  // the rider is on the details step, and the stepper counts two, not three
  await expect(page.locator('#tab-register')).toContainText('Rider details');
  await expect(page.locator('.reg-stepper')).toHaveAttribute('aria-label', '1 / 2');
  // …and the step list itself has genuinely lost step 1 for this rider
  expect(await page.evaluate(`_regSteps(allSessions().find(s=>s.id==='${SND}'))`)).toEqual([2, 2.5, 3]);
  // …and there is no Back button inside the wizard, because there is no earlier step
  await expect(page.locator('.mm-reg-foot .btn-secondary')).toHaveCount(0);
});

test('Back from the details step leaves for the picker, it does not stall', async ({ page }) => {
  await landing(page);
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.view==='customer'`);
  await page.locator('#cust-back-btn').click();
  await page.waitForFunction(`S.view==='landing'`);
  await expect(page.locator('#land-events .landing-event-card')).toHaveCount(3);
});

test('a second wave brings the day list back, and the day list stays walkable back', async ({ page }) => {
  const second = { ...snd, id: '2099-09-24-nd', session_date: '2099-09-24', day: 'Thursday' };
  await landing(page, { sessions: [jcc, saturday, snd, second] });
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.view==='customer'`);
  // two honest answers, so the rider chooses
  expect(await page.evaluate('S.selSession')).toBe(null);
  expect(await page.evaluate('S.regStep')).toBe(1);
  await expect(page.locator('.sess-card.ev-snd')).toHaveCount(2);
  // picking a day advances, and the step they came from is still there to go back to
  await page.locator('.sess-card.ev-snd').first().click();
  await page.locator('.mm-reg-foot .btn-primary').click();
  await page.waitForFunction(`S.regStep===2`);
  await expect(page.locator('.mm-reg-foot .btn-secondary')).toHaveCount(1);
  await page.locator('.mm-reg-foot .btn-secondary').click();
  await page.waitForFunction(`S.regStep===1`);
  await expect(page.locator('.sess-card.ev-snd')).toHaveCount(2);
});

test('none scheduled yet says so rather than opening an empty form', async ({ page }) => {
  await landing(page, { sessions: [jcc, saturday] });
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.view==='customer'`);
  expect(await page.evaluate('S.selSession')).toBe(null);
  expect(await page.evaluate('S.regStep')).toBe(1);
  await expect(page.locator('#session-picker-wrap')).toContainText(/no sessions|nothing/i);
  await expect(page.locator('.sess-card')).toHaveCount(0);
  await expect(page.locator('.mm-reg-foot')).toHaveCount(0);   // no Continue onto an empty form
});

test('the umbrella card does not swallow it, and the circuit card does not show it', async ({ page }) => {
  await landing(page);
  const split = await page.evaluate<{ snd: string[]; community: string[]; jcc: string[] }>(`(() => {
    const all = allSessions();
    const pick = ev => all.filter(s => _evMatch(s, ev)).map(s => s.id);
    return { snd: pick('snd'), community: pick('community'), jcc: pick('jcc') };
  })()`);
  expect(split).toEqual({ snd: [SND], community: ['2099-01-10'], jcc: [JCC] });
});

test('it books directly, charges circuit prices, and seats a rider plus two', async ({ page }) => {
  await landing(page);
  const shape = await page.evaluate<Record<string, unknown>>(`(() => {
    const s = allSessions().find(x => x.id === '${SND}');
    return {
      kind: _rideKind(s), cls: _evClass(s), name: _evName(s), ev: _evOf(s),
      approval: _isApprovalRide(s), openToAll: _openToAll(s), group: _isGroupRide(s),
      free: _isFreeRide(s), bike: _needsBike(s), max: _maxRiders(s), wallet: _walletOk(s, []),
      oneOff: _oneOffRide(s),
    };
  })()`);
  expect(shape).toEqual({
    kind: 'snd', cls: 'ev-snd', name: 'Saudi National Day 96 Ride', ev: 'snd',
    approval: false, openToAll: true, group: true, free: false, bike: true, max: 3, wallet: true,
    oneOff: true,
  });
  // a session from before the party_max column falls back to the pair the trigger enforces
  expect(await page.evaluate(`_groupMax({event_kind:'community',ride_kind:'snd'})`)).toBe(2);
  // …and a typo can never offer a coach
  expect(await page.evaluate(`_groupMax({event_kind:'community',ride_kind:'snd',party_max:300})`)).toBe(2);
});

test('a booking writes a real waiting row at the circuit fare', async ({ page }) => {
  await landing(page);
  const rows = await captureBookingRows(page);
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.regStep===2`);
  await page.evaluate(
    `S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Hybrid'];
     S.regRiderNames=['Spec Rider']; S.promoApplied=null; S.waiverOk=true; submitReg();`,
  );
  await expect.poll(() => rows.length).toBe(1);
  expect(rows[0].status).toBe('waiting');        // booked, not pending an approval that never comes
  expect(rows[0].session_id).toBe(SND);
  expect(rows[0].price).toBe(57.5);              // charged, not complimentary
});

test('the stepper will not offer a fourth rider', async ({ page }) => {
  await landing(page);
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.regStep===2`);
  for (let i = 0; i < 8; i++) await page.evaluate('changeRegQty(1)');
  expect(await page.evaluate('S.regQty')).toBe(3);
  await expect(page.locator('#tab-register')).toContainText(/up to 3 riders/i);
});

test('a full ride still says the reservation joins the waitlist', async ({ page }) => {
  await landing(page, { sessions: [jcc, saturday, { ...snd, status: 'full' }] });
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.regStep===2`);
  // the note used to live on the session step this ride skips; it has to travel with it
  await expect(page.locator('#tab-register .mm-note')).toContainText(/waitlist/i);
});

test('the flow wears the identity, and undresses when the rider leaves it', async ({ page }) => {
  await landing(page);
  await page.locator('#land-events .landing-event-card.ev-snd').click();
  await page.waitForFunction(`S.view==='customer'`);
  await expect(page.locator('body')).toHaveClass(/ev-flow-snd/);
  expect(await page.evaluate(`getComputedStyle(document.body).backgroundColor`)).toBe('rgb(0, 38, 40)');
  await page.locator('#cust-back-btn').click();
  await page.waitForFunction(`S.view==='landing'`);
  await expect(page.locator('body')).not.toHaveClass(/ev-flow-snd/);
  // …and picking the circuit instead leaves the paper skin alone
  await page.locator('#land-events .landing-event-card.ev-jcc').click();
  await page.waitForFunction(`S.view==='customer'`);
  await expect(page.locator('body')).not.toHaveClass(/ev-flow-snd/);
});

test('the booking card keeps the identity in My Rides, and its number stays readable', async ({ page }) => {
  await landing(page, {
    queue_entries: [{
      id: 'q1', queue_num: 7, name: 'Spec Rider', customer_id: 'c1', session_id: SND,
      session_day: 'Wednesday', session_date: '23 Sept 2099',
      status: 'waiting', type_preference: 'Hybrid', price: 57.5, created_at: 1,
    }],
  });
  await page.evaluate(`setCustTab('myrides')`);
  const card = page.locator('.ticket-card.ev-snd');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Wednesday');            // the date line renders, not 'undefined'
  await expect(card).not.toContainText('undefined');
  // themed on its own class: a green plate even though the page around it is paper
  const paint = await page.evaluate<{ card: string; page: string; pillBg: string; pillFg: string }>(`(() => {
    const c = document.querySelector('.ticket-card.ev-snd');
    const pill = [...c.querySelectorAll('span')].find(e => e.textContent.trim() === '#7');
    const ps = pill ? getComputedStyle(pill) : { backgroundColor: '', color: '' };
    return { card: getComputedStyle(c).borderTopColor, page: getComputedStyle(document.body).backgroundColor,
             pillBg: ps.backgroundColor, pillFg: ps.color };
  })()`);
  expect(paint.page).toBe('rgb(251, 249, 244)');
  expect(paint.card).toBe('rgba(0, 137, 74, 0.45)');
  // the rider's own number must not be white on white
  expect(paint.pillBg).not.toBe(paint.pillFg);
});

test('Edit on the booking re-enters the flow as this ride, not as the circuit', async ({ page }) => {
  await landing(page, {
    queue_entries: [{
      id: 'q1', queue_num: 7, name: 'Spec Rider', customer_id: 'c1', session_id: SND,
      session_day: 'Wednesday', session_date: '23 Sept 2099',
      status: 'waiting', type_preference: 'Hybrid', price: 57.5, created_at: 1,
    }],
  });
  await page.evaluate(`setCustTab('myrides')`);
  await page.locator('.ticket-card.ev-snd .btn-green', { hasText: /edit/i }).first().click();
  await page.waitForFunction(`S.custTab==='register'`);
  expect(await page.evaluate('S.selEvent')).toBe('snd');
  await expect(page.locator('body')).toHaveClass(/ev-flow-snd/);
});

test('a party too big for it is not offered it as a reschedule target', async ({ page }) => {
  const mine = [0, 1, 2].map((i) => ({
    id: 'q' + i, queue_num: 10 + i, name: 'Rider ' + i, customer_id: 'c1', session_id: JCC,
    session_day: 'Wednesday', session_date: '23 Sept 2099',
    status: 'waiting', type_preference: 'Hybrid', price: 57.5, created_at: 1,
  }));
  await landing(page, { sessions: [jcc, saturday, { ...snd, party_max: 2 }], queue_entries: mine });
  // three riders cannot move onto a ride that seats two per account: each rider moves in its
  // own call, so an offered-then-refused target splits the party across two events
  const offered = await page.evaluate<string[]>(`(() => {
    const moving = getQueue().filter(e => e.sessionId === '${JCC}');
    const fits = s => !_isGroupRide(s) || moving.length <= _maxRiders(s);
    return allSessions().filter(s => s.id !== '${JCC}' && s.status === 'open' && !_isApprovalRide(s) && fits(s)).map(s => s.id);
  })()`);
  expect(offered).not.toContain(SND);
});

test('staff can create one: it takes a date-proof id, the kind, the fare and the party size', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const writes: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'POST' && r.method() !== 'PATCH') return;
    if (!r.url().includes('/rest/v1/sessions')) return;
    const b = r.postDataJSON();
    (Array.isArray(b) ? b : [b]).forEach((x: Record<string, unknown>) => writes.push({ ...x }));
  });

  // the event row offers it, alongside the circuit and the other community rides
  await page.evaluate(`showView('staff');setStaffTab('sessions');S.showAddSession=true;renderSessions()`);
  const pick = page.locator('.toggle-btn.ev-pick.ev-snd');
  await expect(pick).toHaveCount(1);
  await expect(pick).toContainText('Saudi National Day 96 Ride');
  await pick.click();
  expect(await page.evaluate('S.newSessEvent')).toBe('snd');
  expect(await page.evaluate('_nsComm()')).toBe(true);
  expect(await page.evaluate('_nsSeats()')).toBe(false);   // places come from the rack, not a typed cap
  await expect(page.locator('#ns-title')).toHaveValue('Saudi National Day 96 Ride');

  await page.evaluate(`S.newSessMode='total';S.newSessTotal='30';renderSessions()`);
  await page.evaluate(`document.getElementById('ns-total').value='30';document.getElementById('ns-date').value='2099-09-23';addSession()`);
  await expect.poll(() => writes.length).toBeGreaterThan(1);

  const created = writes.find((w) => w.id);
  // the date it has to run on already carries a circuit session, so the id must not collide
  expect(created?.id).toBe('2099-09-23-nd');
  expect(created?.capacity).toBe(30);
  const gate = Object.assign({}, ...writes.filter((w) => !w.id));
  expect(gate.ride_kind).toBe('snd');
  expect(gate.event_kind).toBe('community');
  expect(gate.paid_ride).toBe(true);        // charged at circuit prices
  expect(gate.open_to_all).toBe(true);      // no members gate
  expect(gate.needs_approval).toBe(false);  // staff approve nobody
  expect(gate.hide_queue).toBe(false);      // numbers are real and visible
  expect(gate.spots).toBe(null);            // places are the bikes put out
  expect(gate.party_max).toBe(3);           // a rider and two guests
});

test('a clone keeps its kind rather than turning into a Saturday ride', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`showView('staff');setStaffTab('sessions');cloneSession('${SND}')`);
  expect(await page.evaluate('S.newSessEvent')).toBe('snd');
  expect(await page.evaluate('S.newSessTitle')).toBe('Saudi National Day 96 Ride');
});
