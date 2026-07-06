import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, loginCustomer } from './helpers/supabase';

// SECURE_AUTH mode (SECURITY-RUNBOOK.md): the app talks to token-checked RPCs
// and the no-PII queue_public view instead of the locked tables. The flag is
// enabled per-browser via localStorage so these specs run against the same
// index.html that serves open mode.

const secureOn = (page: import('@playwright/test').Page) =>
  page.addInitScript(() => localStorage.setItem('cq_secure_auth', '1'));

const openSession = {
  id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12,
  status: 'open', created_at: 1, bike_slots: null, location: 'JCC', addons: null,
};

test('customer login goes through the customer_login RPC', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [openSession],
    customers: [], // direct-table login would find nobody — only the RPC path can succeed
    'rpc:customer_login': [{
      id: 'c9', name: 'Secure Rider', email: 'secure@example.com', phone: '0500000009',
      height: 175, type_preference: 'Any', created_at: '2026-01-01T00:00:00Z',
      birth_date: null, country: null, city: null, photo: null, session_token: 'tok123',
    }],
  });
  await secureOn(page);
  await page.goto('/');
  await page.locator('.landing-hero-card').click(); // not logged in → auth modal opens
  await page.fill('#a-identifier', 'secure@example.com');
  await page.fill('#a-pwd', 'Passw0rdX');
  await page.evaluate(`doLogin()`);

  await expect.poll(() => page.evaluate(`S.loggedIn && S.loggedIn.name`)).toBe('Secure Rider');
  expect(await page.evaluate(`S.loggedIn.session_token`)).toBe('tok123');
});

test('customer reads merge queue_public with my_bookings and skip the locked table', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [openSession],
    queue_entries: [], // locked in secure mode — anything here must NOT be used
    queue_public: [
      { id: 'q-other-1', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'waiting', size: 'M', type_preference: 'Any', paid: false, price: 30, assigned_bike_id: null, walk_in: false, ride_duration: null },
      { id: 'q-other-2', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 2, status: 'waiting', size: 'L', type_preference: 'Road', paid: true, price: 35, assigned_bike_id: null, walk_in: false, ride_duration: null },
    ],
    'rpc:my_bookings': [
      { id: 'q-mine', name: 'Secure Rider', email: 'secure@example.com', phone: '0500000009', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 3, status: 'waiting', size: 'M', type_preference: 'Any', paid: false, price: 30, assigned_bike_id: null, walk_in: false, customer_id: 'c9', registered_at: '2026-01-01T10:00:00Z' },
    ],
  });
  await secureOn(page);
  await loginCustomer(page, { id: 'c9', name: 'Secure Rider', email: 'secure@example.com', session_token: 'tok123' });
  await page.goto('/');

  // availability sees all three bookings (two public + own), PII-free for the others
  await expect.poll(() => page.evaluate(`S.queue.length`)).toBe(3);
  expect(await page.evaluate(`S.queue.filter(e => e.name).length`)).toBe(1); // only own row carries a name

  // My Rides renders the own booking from the RPC row (tab switch via app fn:
  // the top tab-nav is desktop-only, mobile uses the bottom nav). Re-render on
  // each poll so a one-off render before data settles doesn't flake under load.
  await expect(async () => {
    await page.evaluate(`setCustTab('myrides'); if (typeof renderMyRides === 'function') renderMyRides();`);
    await expect(page.locator('#tab-myrides')).toContainText('#3', { timeout: 1000 });
  }).toPass({ timeout: 8000 });
});

test('a stale staff unlock without an Auth session falls back to the PIN gate', async ({ page }) => {
  await stubSupabase(page, { sessions: [openSession] });
  await secureOn(page);
  await unlockStaff(page); // cq_staff=1 but no Supabase Auth session exists
  await page.goto('/');

  await expect(page.locator('.landing-hero-card')).toBeVisible(); // landed on the public page, not the staff panel
  expect(await page.evaluate(`localStorage.getItem('cq_staff')`)).toBeNull();
  expect(await page.evaluate(`S._staffAuthed === true`)).toBe(false);
});

test('customer writes route through the token RPCs when the table is locked', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [openSession],
    'rpc:customer_booking_update': true,
    'rpc:customer_shiftdown': true,
  });
  await secureOn(page);
  await loginCustomer(page, { id: 'c9', name: 'Secure Rider', session_token: 'tok123' });
  await page.goto('/');

  const rpcCalls: string[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/\/rest\/v1\/(rpc\/[a-z_]+|queue_entries)/);
    if (m && ['PATCH', 'POST'].includes(r.method())) rpcCalls.push(`${r.method()} ${m[1]}`);
  });

  // an own-row update (cancel) must go to the RPC, not a direct table PATCH
  const res = await page.evaluate(`_ownEntryUpdate('q-mine', { status: 'cancelled', assigned_bike_id: null })`);
  expect(res).toEqual({ error: null });
  await page.evaluate(`_shiftDownAfter('s1', 3)`);

  expect(rpcCalls.some((c) => c.includes('rpc/customer_booking_update'))).toBe(true);
  expect(rpcCalls.some((c) => c.includes('rpc/customer_shiftdown'))).toBe(true);
  expect(rpcCalls.some((c) => c.includes('queue_entries'))).toBe(false); // never touched the locked table directly
});

test('customer add-on stock change routes through the RPC, not a direct inventory write', async ({ page }) => {
  await stubSupabase(page, { sessions: [openSession], 'rpc:customer_addon_stock': true });
  await secureOn(page);
  await loginCustomer(page, { id: 'c9', name: 'Secure Rider', session_token: 'tok123' });
  await page.goto('/');
  const calls: string[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/\/rest\/v1\/(rpc\/customer_addon_stock|inventory)/);
    if (m && ['PATCH', 'POST'].includes(r.method())) calls.push(m[1]);
  });
  await page.waitForFunction('S.dataLoaded === true'); // let boot's loadData settle so it can't reset S.inventory mid-test
  // set + adjust + read in one shot so a background refresh can't race the assertion
  const qty = await page.evaluate(`(async () => {
    S.inventory = [{ id: 'inv1', name: 'Gel', qty: 5 }];
    await _addonStockQ([{ id: 'inv1', qty: 2 }], -1);
    return (S.inventory.find(x => x.id === 'inv1') || {}).qty;
  })()`);
  await expect.poll(() => calls.some((c) => c.includes('rpc/customer_addon_stock'))).toBe(true);
  expect(calls.some((c) => c === 'inventory')).toBe(false);
  expect(qty).toBe(3); // local copy updated via the RPC path
});

test('staff/open mode still writes queue_entries directly (no RPC)', async ({ page }) => {
  await stubSupabase(page, { sessions: [openSession] }); // secure mode OFF
  await page.goto('/');
  const seen: string[] = [];
  page.on('request', (r) => {
    const m = r.url().match(/\/rest\/v1\/(rpc\/customer_booking_update|queue_entries)/);
    if (m && r.method() === 'PATCH') seen.push(m[1]);
  });
  const res = await page.evaluate(`_ownEntryUpdate('q1', { status: 'cancelled' })`);
  expect(res).not.toBeNull();
  expect(seen.some((c) => c === 'queue_entries')).toBe(true);
  expect(seen.some((c) => c.includes('rpc/'))).toBe(false);
});

test('after the PIN, staff sign in with a Supabase Auth account', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [openSession],
    staff: [{ user_id: 'u-staff-1', role: 'admin' }],
    'auth:token': {
      access_token: 'fake-jwt', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake-refresh',
      user: { id: 'u-staff-1', aud: 'authenticated', role: 'authenticated', email: 'staff@example.com' },
    },
  });
  await secureOn(page);
  await page.goto('/?staff');

  // PIN pad shows first; jump to the auth stage the PIN success path enters
  await expect(page.locator('.pin-title')).toHaveText('Staff Access');
  await page.evaluate(`S._pinStage='auth'; renderPinModal();`);
  // Set values directly: Playwright's mobile-emulation fill mis-targets adjacent
  // email+password inputs (a real soft keyboard doesn't); we're testing submit.
  await page.evaluate(`
    document.getElementById('staff-auth-email').value = 'staff@example.com';
    document.getElementById('staff-auth-pwd').value = 'hunter2A1';
  `);
  await page.locator('#pin-modal .btn-primary').click();

  await expect(page.locator('#staff-tab-nav')).toBeVisible();
  expect(await page.evaluate(`S._staffAuthed`)).toBe(true);
  expect(await page.evaluate(`S.staffRole`)).toBe('admin');
});
