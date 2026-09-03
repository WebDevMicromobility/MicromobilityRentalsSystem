import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, unlockStaff, waitForSb, captureBookingRows } from './helpers/supabase';

// The Petromin Wednesday Ride: a SECOND community ride. It shares exactly one thing with the
// Saturday Social Ride — only riders holding the community tag may book it — and is an
// ordinary circuit session in every other respect: real prices, real queue numbers, a seat
// count that overflows to the waitlist, and groups. Everything the app used to key off the
// word "community" (free, solo, staff-approved, hidden numbers) is now keyed off the two
// things that actually vary: paid_ride and needs_approval.

const jcc = { id: 's1', day: 'Sunday', session_date: '2099-01-11', capacity: 12, status: 'open', created_at: 1, location: 'JCC' };
const sat = {
  id: '2099-01-10', day: 'Saturday', session_date: '2099-01-10', capacity: 20, status: 'open', created_at: 1,
  event_kind: 'community', ride_kind: 'saturday', paid_ride: false,
  needs_approval: true, hide_queue: true, spots: 20, title: 'Saturday Social Ride',
};
const petromin = {
  id: '2099-01-13-pw', day: 'Wednesday', session_date: '2099-01-13', capacity: 10, status: 'open', created_at: 1,
  event_kind: 'community', ride_kind: 'petromin', paid_ride: true,
  needs_approval: false, hide_queue: false, spots: null, title: 'Petromin Wednesday Ride',
};
const bikes = [{ id: 'b1', name: 'B1', size: 'M', type: 'Road', status: 'available', rental_price: 75 }];
const fixtures = { sessions: [jcc, sat, petromin], bikes, queue_entries: [] };
const member = { ...fixtures, 'rpc:community_member': true };

async function bootMember(page: import('@playwright/test').Page, extra: Record<string, unknown> = {}) {
  await stubSupabase(page, { ...member, ...extra });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.selEvent='community';setCustTab('register')`);
}

/** Click a ride's card and wait for the (async, gate-checked) selection to land. */
async function pickRide(page: import('@playwright/test').Page, cls: string, id: string) {
  await page.locator(`.sess-card.${cls}`).click();
  await page.waitForFunction(`S.selSession===${JSON.stringify(id)}`);
}

test.describe('who may book it', () => {
  test('a non-member is stopped at the same members-only dialog', async ({ page }) => {
    await stubSupabase(page, fixtures); // no community_member fixture = not a member
    await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`S.selEvent='community';setCustTab('register')`);

    await page.locator('.sess-card.ev-petromin').click();
    await expect(page.locator('#confirm-modal')).toContainText('Community members only');
    expect(await page.evaluate('S.selSession')).toBeNull();
  });

  test('a member gets straight in', async ({ page }) => {
    await bootMember(page);
    await pickRide(page, 'ev-petromin', '2099-01-13-pw');
    await expect(page.locator('#confirm-modal')).toBeHidden();
  });
});

test.describe('it behaves like a circuit session, not like the Saturday ride', () => {
  test('the rides card lists every non-JCC ride, each in its own colour', async ({ page }) => {
    await bootMember(page);
    await expect(page.locator('.sess-card')).toHaveCount(2);       // both community rides, no JCC
    await expect(page.locator('.sess-card.ev-saturday')).toHaveCount(1);
    await expect(page.locator('.sess-card.ev-petromin')).toHaveCount(1);
    await expect(page.locator('.sess-card.ev-petromin')).toContainText('Petromin Wednesday Ride');
    await expect(page.locator('.sess-card.ev-petromin')).not.toContainText(/gathering/i); // circuit-style time
    await expect(page.locator('.sess-card.ev-saturday')).toContainText(/gathering/i);     // the social ride keeps it
  });

  test('riders see a fare, not "Free" — and may book a group', async ({ page }) => {
    await bootMember(page);
    await pickRide(page, 'ev-petromin', '2099-01-13-pw');
    await page.evaluate(`S.regStep=2;renderRegister();setBikeType(0,'Road')`); // riders step: stepper + fare
    await expect(page.locator('.qty-stepper')).toBeVisible();
    await expect(page.locator('#price-preview-wrap')).toContainText('SAR 75');
    await expect(page.locator('#price-preview-wrap')).not.toContainText('Complimentary');
  });

  test('the Saturday ride shows no stepper and no fare', async ({ page }) => {
    await bootMember(page);
    await pickRide(page, 'ev-saturday', '2099-01-10');
    await page.evaluate(`S.regStep=2;renderRegister();setBikeType(0,'Road')`);
    await expect(page.locator('.qty-stepper')).toHaveCount(0);
    await expect(page.locator('#price-preview-wrap')).toContainText('Complimentary');
  });

  test('the Saturday ride still books one rider at a time', async ({ page }) => {
    await bootMember(page);
    await pickRide(page, 'ev-saturday', '2099-01-10');
    expect(await page.evaluate('S.regQty')).toBe(1);
    await page.evaluate('changeRegQty(1)');
    expect(await page.evaluate('S.regQty')).toBe(1); // pinned, whatever the stepper is told
  });

  test('a group of two books at the real price, with no approval attached', async ({ page }) => {
    await bootMember(page);
    const rows = await captureBookingRows(page);
    await page.evaluate(
      `S.selSession='2099-01-13-pw'; S.regQty=2; S.regBikeHeights=[175,168]; S.regBikeTypes=['Road','Road'];
       S.regRiderNames=['Spec Rider','Friend']; S.promoApplied=null; submitReg();`,
    );
    await expect.poll(() => rows.length).toBe(2);
    expect(rows[0].price).toBe(75);
    expect(rows[1].price).toBe(75);
    expect(rows[0].approval ?? null).toBeNull(); // not a reservation awaiting staff
  });

  test('a Saturday booking is still complimentary and pending', async ({ page }) => {
    await bootMember(page);
    const rows = await captureBookingRows(page);
    await page.evaluate(
      `S.selSession='2099-01-10'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Road'];
       S.regRiderNames=['Spec Rider']; S.promoApplied=null; submitReg();`,
    );
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].price).toBe(0);
    expect(rows[0].approval).toBe('pending');
  });

  test('a rider on their own bike pays nothing, on either ride', async ({ page }) => {
    await bootMember(page);
    const rows = await captureBookingRows(page);
    await page.evaluate(
      `S.selSession='2099-01-13-pw'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Own'];
       S.regRiderNames=['Spec Rider']; S.promoApplied=null; submitReg();`,
    );
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].type_preference).toBe('Own');
    expect(rows[0].price).toBe(0);
  });

  test('the bike-type menu: Own on both rides, Road Carbon on neither', async ({ page }) => {
    await bootMember(page);
    await pickRide(page, 'ev-petromin', '2099-01-13-pw');
    await page.evaluate(`S.regStep=2;renderRegister()`);
    const types = await page.evaluate(`Array.from(document.querySelectorAll('[data-type-slot="0"]')).map(b=>b.dataset.type)`);
    expect(types).toContain('Own');            // owners are welcome
    expect(types).not.toContain('Road Carbon'); // carbon bikes do not go out on a community ride
    expect(await page.evaluate(`bikeTypeOpts(false,false)`)).toContain('Road Carbon'); // ...but they do at the circuit
    expect(await page.evaluate(`bikeTypeOpts(false,false)`)).not.toContain('Own');
  });

  test('a stale client asking for carbon on the paid ride is coerced, not charged for it', async ({ page }) => {
    await bootMember(page);
    const rows = await captureBookingRows(page);
    await page.evaluate(
      `S.selSession='2099-01-13-pw'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Road Carbon'];
       S.regRiderNames=['Spec Rider']; S.promoApplied=null; submitReg();`,
    );
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].type_preference).not.toBe('Road Carbon'); // the DB trigger backstops this too
  });

  test('a rider on their own bike is seated even when every seat is taken', async ({ page }) => {
    // Seats allocate Micromobility bikes. Someone who brought their own needs none, so a
    // full ride still takes them — and they never push a bike-renting rider out either.
    const taken = Array.from({ length: 10 }, (_, i) => ({
      id: 'f' + i, session_id: '2099-01-13-pw', session_day: 'Wednesday', session_date: '2099-01-13',
      queue_num: i + 1, name: 'Rider ' + i, size: 'M', type_preference: 'Road', status: 'waiting',
      paid: false, price: 75, registered_at: '2099-01-01T10:00:00Z',
    }));
    await bootMember(page, { queue_entries: taken });
    const rows = await captureBookingRows(page);
    await page.evaluate(
      `S.selSession='2099-01-13-pw'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Own'];
       S.regRiderNames=['Spec Rider']; S.promoApplied=null; submitReg();`,
    );
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].status).toBe('waiting');   // not bumped to the waitlist
    expect(rows[0].price).toBe(0);
  });

  // The member and one guest. Staff are exempt, so the desk can still seat a larger party.
  test('a party is capped at the member plus one — the stepper will not go past it', async ({ page }) => {
    await bootMember(page);
    await pickRide(page, 'ev-petromin', '2099-01-13-pw');
    await page.evaluate(`S.regStep=2;renderRegister()`);
    for (let i = 0; i < 8; i++) await page.evaluate('changeRegQty(1)');
    expect(await page.evaluate('S.regQty')).toBe(2);
    await expect(page.locator('.reg-row').first()).toContainText(/up to 2 riders/i);
  });

  test('a third rider is refused at submit, not quietly trimmed', async ({ page }) => {
    await bootMember(page);
    const rows = await captureBookingRows(page);
    await page.evaluate(
      `S.selSession='2099-01-13-pw'; S.regQty=5; S.regBikeHeights=[175,175,175,175,175];
       S.regBikeTypes=['Road','Road','Road','Road','Road'];
       S.regRiderNames=['A','B','C','D','E']; S.promoApplied=null; submitReg();`,
    );
    await expect(page.locator('.toast')).toContainText(/up to 2 riders/i);
    expect(rows).toHaveLength(0);           // nothing was posted
    expect(await page.evaluate('S.regQty')).toBe(2);
  });

  test('the JCC stepper still goes to ten', async ({ page }) => {
    await bootMember(page);
    await page.evaluate(`S.selEvent='jcc';setCustTab('register')`);
    await page.locator('.sess-card.ev-jcc').click();
    await page.waitForFunction(`S.selSession==='s1'`);
    for (let i = 0; i < 12; i++) await page.evaluate('changeRegQty(1)');
    expect(await page.evaluate('S.regQty')).toBe(10);
  });

  test('a full seat count sends the next rider to the waitlist', async ({ page }) => {
    // 10 seats, 10 riders already on it: the client must not seat an 11th.
    const taken = Array.from({ length: 10 }, (_, i) => ({
      id: 'e' + i, session_id: '2099-01-13-pw', session_day: 'Wednesday', session_date: '2099-01-13',
      queue_num: i + 1, name: 'Rider ' + i, size: 'M', type_preference: 'Road', status: 'waiting',
      paid: false, price: 75, registered_at: '2099-01-01T10:00:00Z',
    }));
    await bootMember(page, { queue_entries: taken });
    const rows = await captureBookingRows(page);
    await page.evaluate(
      `S.selSession='2099-01-13-pw'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Road'];
       S.regRiderNames=['Spec Rider']; S.promoApplied=null; submitReg();`,
    );
    await expect.poll(() => rows.length).toBe(1);
    expect(rows[0].status).toBe('waitlist');
  });
});

test.describe('staff side', () => {
  test('a Petromin booking keeps its number and its money column', async ({ page }) => {
    const booking = {
      id: 'p1', session_id: '2099-01-13-pw', session_day: 'Wednesday', session_date: '2099-01-13',
      queue_num: 4, name: 'Spec Rider', size: 'M', type_preference: 'Road', status: 'waiting',
      paid: false, price: 75, registered_at: '2099-01-01T10:00:00Z',
    };
    await stubSupabase(page, { ...fixtures, queue_entries: [booking] });
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`setStaffTab('queue');S.sfSession='2099-01-13-pw';renderStaffQueue()`);
    const html = await page.evaluate(`document.getElementById('tab-queue').innerHTML`) as string;
    expect(html).toContain('#4');                       // the number is real, not hidden
    expect(html).toContain('showEditPriceModal');       // and so is the fare
    expect(html).not.toContain('apprPendingChip');      // nothing to approve
  });

  test('creating one stamps the ride kind, the price rule and a date-proof id', async ({ page }) => {
    await stubSupabase(page, fixtures);
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    const writes: Record<string, unknown>[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'POST' && r.method() !== 'PATCH') return;
      if (!r.url().includes('/rest/v1/sessions')) return;
      const b = r.postDataJSON();
      (Array.isArray(b) ? b : [b]).forEach((x: Record<string, unknown>) => writes.push({ ...x, _url: r.url() }));
    });
    // Built from bikes, exactly like a circuit session: capacity is the composition's sum.
    await page.evaluate(`setStaffTab('sessions');S.showAddSession=true;S.newSessEvent='petromin';S.newSessTitle='Petromin Wednesday Ride';S.newSessMode='total';S.newSessTotal='10';renderSessions()`);
    await page.evaluate(`document.getElementById('ns-total').value='10';document.getElementById('ns-date').value='2099-01-13';addSession()`);

    await expect.poll(() => writes.length).toBeGreaterThan(1);
    const created = writes.find((w) => w.id);
    expect(created?.id).toBe('2099-01-13-pw'); // a circuit session may share the date
    expect(created?.capacity).toBe(10);        // from the bikes put out, not a typed seat count
    expect(JSON.parse(String(created?.bike_slots))._total).toBe(10);
    // the gate lands in two writes: the long-standing columns, then the newer pair
    const gate = Object.assign({}, ...writes.filter((w) => !w.id));
    expect(gate.ride_kind).toBe('petromin');
    expect(gate.paid_ride).toBe(true);
    expect(gate.needs_approval).toBe(false);  // no approval flow
    expect(gate.spots ?? null).toBeNull();    // no spot cap: capacity carries it
    expect(gate.hide_queue).toBe(false);      // numbers are visible
    expect(gate.event_kind).toBe('community'); // ...but the members gate still applies
    expect(gate.title).toBe('Petromin Wednesday Ride');
  });

  test('its form asks for bikes, not for a meeting point or a breakfast stop', async ({ page }) => {
    await stubSupabase(page, fixtures);
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`setStaffTab('sessions');S.showAddSession=true;S.newSessEvent='petromin';renderSessions()`);
    await expect(page.locator('#ns-map')).toHaveCount(0);        // it meets at the circuit
    await expect(page.getByText(/gathering time/i)).toHaveCount(0); // a start-end window, as at the circuit
    await expect(page.getByText(/^time$/i).first()).toBeVisible();
    await expect(page.locator('#ns-spots')).toHaveCount(0);      // capacity comes from the bikes
    await expect(page.locator('#ns-title')).toBeVisible();       // but it is still named
    await expect(page.getByText(/bike fleet composition/i)).toBeVisible(); // the circuit's builder

    // the Saturday ride keeps both, since that is where they belong
    await page.evaluate(`S.newSessEvent='community';renderSessions()`);
    await expect(page.locator('#ns-map')).toBeVisible();
    await expect(page.locator('#ns-spots')).toBeVisible();
  });

  test('creating a Saturday ride is unchanged', async ({ page }) => {
    await stubSupabase(page, fixtures);
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    const writes: Record<string, unknown>[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'POST' && r.method() !== 'PATCH') return;
      if (!r.url().includes('/rest/v1/sessions')) return;
      const b = r.postDataJSON();
      (Array.isArray(b) ? b : [b]).forEach((x: Record<string, unknown>) => writes.push(x));
    });
    await page.evaluate(`setStaffTab('sessions');S.showAddSession=true;S.newSessEvent='community';S.newSessSpots='20';renderSessions()`);
    await page.evaluate(`document.getElementById('ns-date').value='2099-01-17';addSession()`);

    await expect.poll(() => writes.length).toBeGreaterThan(1);
    expect(writes.find((w) => w.id)?.id).toBe('2099-01-17'); // no suffix
    const gate = Object.assign({}, ...writes.filter((w) => !w.id));
    expect(gate.ride_kind).toBe('saturday');
    expect(gate.paid_ride).toBe(false);
    expect(gate.needs_approval).toBe(true);
    expect(gate.title).toBe('Saturday Social Ride');
  });
});

test.describe('a database that has not run the migration yet', () => {
  /** Refuses exactly the writes that touch the new columns, the way PostgREST would. */
  async function noNewColumns(page: import('@playwright/test').Page) {
    await page.route(/\/rest\/v1\/sessions/, async (route) => {
      const body = route.request().postData() || '';
      if (route.request().method() === 'PATCH' && body.includes('ride_kind')) {
        return route.fulfill({
          status: 400,
          headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
          body: JSON.stringify({ code: 'PGRST204', message: "Could not find the 'ride_kind' column of 'sessions'" }),
        });
      }
      return route.fallback();
    });
  }

  async function create(page: import('@playwright/test').Page, ev: string, date: string) {
    await stubSupabase(page, fixtures);
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
    await noNewColumns(page);
    const writes: Record<string, unknown>[] = [];
    page.on('request', (r) => {
      if (!r.url().includes('/rest/v1/sessions')) return;
      writes.push({ method: r.method(), body: r.postData() || '' });
    });
    await page.evaluate(`setStaffTab('sessions');S.showAddSession=true;S.newSessEvent='${ev}';S.newSessMode='total';S.newSessTotal='10';S.newSessSpots='20';renderSessions()`);
    await page.evaluate(`const _t=document.getElementById('ns-total');if(_t)_t.value='10';document.getElementById('ns-date').value='${date}';addSession()`);
    return writes;
  }

  test('a Saturday ride is still created — the older columns describe it completely', async ({ page }) => {
    const writes = await create(page, 'community', '2099-02-07');
    await expect.poll(() => writes.some((w) => w.method === 'POST')).toBe(true);
    // the session is NOT rolled back: no DELETE goes out
    await page.waitForTimeout(400);
    expect(writes.some((w) => w.method === 'DELETE')).toBe(false);
    await expect(page.locator('.toast')).not.toContainText(/ride_kind/i);
  });

  test('a Petromin ride refuses to be created half-made', async ({ page }) => {
    const writes = await create(page, 'petromin', '2099-02-11');
    // without paid_ride the ride would come back complimentary, so it is rolled back and said
    await expect.poll(() => writes.some((w) => w.method === 'DELETE')).toBe(true);
    await expect(page.locator('.toast')).toBeVisible();
  });
});

test('the landing card is an umbrella: the shared name, no per-ride blurb', async ({ page }) => {
  await stubSupabase(page, member);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate('goLanding()');
  const card = page.locator('#land-events .landing-event-card.ev-community');
  // renamed 2026-08-26: the umbrella now covers activities that are not rides at all
  await expect(card).toContainText('Micromobility Experiences');
  await expect(card.locator('.lec-meta')).toHaveCount(0); // the description is gone; the logo stays
  await expect(card.locator('img')).not.toHaveCount(0);
});
