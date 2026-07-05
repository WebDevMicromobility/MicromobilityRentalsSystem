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
  // the top tab-nav is desktop-only, mobile uses the bottom nav)
  await page.evaluate(`setCustTab('myrides')`);
  await expect(page.locator('#tab-myrides')).toContainText('#3');
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
