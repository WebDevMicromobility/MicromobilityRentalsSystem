import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A bike's NFC tag (and its QR sticker) holds https://<origin>/?bike=042. iOS opens it in
// Safari on tap; the app treats that URL as the "a bike arrived" event. Everything about it
// is staff-only: a device without a staff session lands on the sign-in with no bike on the
// page, in the URL or in a request. With a session and an open check-in the bike goes into
// that modal; with no open check-in the bike's own card opens.

const BIKE = {
  id: 'b1', name: 'Road 042', bike_number: 42, type: 'Road', size: 'M', status: 'available',
  colors: ['#000000'], color_names: ['Black'], frame_type: 'Carbon', groupset: 'Shimano 105', brand: 'Trek', model: 'Domane',
};
const ENTRY = {
  id: 'e1', session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: 7,
  name: 'Rider Seven', phone: '', customer_id: null, group_id: null, status: 'waiting', paid: false,
  price: 30, walk_in: true, registered_at: '2099-01-01T10:00:00Z', type_preference: 'Road', size: 'M',
};
const SESSION = { id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 };

function fixtures(over: Record<string, unknown> = {}) {
  return {
    queue_entries: [ENTRY], sessions: [SESSION], bikes: [BIKE],
    'rpc:staff_resolve_bike': { found: true, bike: { ...BIKE, tag_uid: '04A1B2C3D4E5F6' }, rented_to: null },
    'rpc:staff_checkin': { ok: true, noop: false, assignment_id: 'a1' },
    ...over,
  };
}

/** Every RPC the page called, by name, with the JSON it sent. */
function watchRpcs(page: Page) {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  page.on('request', (r) => {
    const m = r.url().match(/\/rest\/v1\/rpc\/([^/?]+)/);
    if (!m || r.method() !== 'POST') return;
    let body: Record<string, unknown> = {};
    try { body = r.postDataJSON(); } catch { /* no body */ }
    calls.push({ name: m[1], body });
  });
  return calls;
}

test('no staff session: the sign-in, no bike anywhere, and the code is off the address bar', async ({ page }) => {
  await stubSupabase(page, fixtures());
  const rpcs = watchRpcs(page);
  await page.goto('/?bike=42');
  await waitForSb(page);

  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/view-staff/);
  expect(page.url()).not.toContain('bike=');
  await expect(page.locator('body')).not.toContainText('Road 042');
  expect(rpcs.filter((c) => c.name === 'staff_resolve_bike')).toHaveLength(0);
  // Parked for after sign-in, nowhere else.
  expect(await page.evaluate(() => sessionStorage.getItem('cq_pending_bike'))).toBe('42');
});

test('staff session, no open check-in: the bike card opens', async ({ page }) => {
  await stubSupabase(page, fixtures());
  await unlockStaff(page);
  const rpcs = watchRpcs(page);
  await page.goto('/?bike=42');
  await waitForSb(page);

  await expect(page.locator('#bike-profile-modal')).toHaveCSS('display', 'flex');
  await expect(page.locator('#bike-profile-modal')).toContainText('Road 042');
  expect(page.url()).not.toContain('bike=');
  await expect.poll(() => rpcs.find((c) => c.name === 'staff_resolve_bike')?.body).toEqual({ p_code: '42' });
  expect(await page.evaluate(() => sessionStorage.getItem('cq_pending_bike'))).toBeNull();
});

test('staff session with an open check-in: the modal reopens with the bike filled and Confirm focused, and Confirm calls staff_checkin', async ({ page }) => {
  await stubSupabase(page, fixtures());
  await unlockStaff(page);
  await page.addInitScript(() => {
    localStorage.setItem('mm_active_checkin', JSON.stringify({ entryId: 'e1', ref: '#7', openedAt: Date.now() }));
  });
  const rpcs = watchRpcs(page);
  await page.goto('/?bike=42');
  await waitForSb(page);

  const modal = page.locator('#checkin-modal');
  await expect(modal).toHaveCSS('display', 'flex');
  await expect(modal).toContainText('Rider Seven');
  await expect(modal.locator('#ci-bike')).toHaveValue('42');
  await expect(modal.locator('#ci-bike-spec')).toContainText('042');
  await expect(modal.locator('#ci-bike-spec')).toContainText('Carbon');
  await expect(modal).toContainText('You can confirm here');
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe('ci-confirm');
  await expect(modal.locator('#ci-confirm')).toBeEnabled();

  await modal.locator('#ci-confirm').click();
  await expect.poll(() => rpcs.find((c) => c.name === 'staff_checkin')?.body).toEqual({ p_booking_id: 'e1', p_bike_id: 'b1' });
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mm_active_checkin'))).toBeNull();
});

test('a bike that is out disables Confirm and names who has it', async ({ page }) => {
  await stubSupabase(page, fixtures({
    'rpc:staff_resolve_bike': { found: true, bike: { ...BIKE, status: 'in-use' }, rented_to: { name: 'Someone Else', since: '2099-02-10T09:00:00Z' } },
  }));
  await unlockStaff(page);
  await page.addInitScript(() => {
    localStorage.setItem('mm_active_checkin', JSON.stringify({ entryId: 'e1', ref: '#7', openedAt: Date.now() }));
  });
  await page.goto('/?bike=42');
  await waitForSb(page);

  const modal = page.locator('#checkin-modal');
  await expect(modal).toHaveCSS('display', 'flex');
  await expect(modal.locator('#ci-bike-spec')).toContainText('Someone Else');
  await expect(modal.locator('#ci-confirm')).toBeDisabled();
});

test('a database without the RPC: the classic check-in write runs instead', async ({ page }) => {
  await stubSupabase(page, fixtures({
    'rpc:staff_checkin': { __rpcError: { status: 404, code: 'PGRST202', message: 'Could not find the function public.staff_checkin' } },
  }));
  await unlockStaff(page);
  await page.addInitScript(() => {
    localStorage.setItem('mm_active_checkin', JSON.stringify({ entryId: 'e1', ref: '#7', openedAt: Date.now() }));
  });
  const patched: Array<Record<string, unknown>> = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries') && r.url().includes('id=eq.e1')) {
      try { patched.push(r.postDataJSON()); } catch { /* not JSON */ }
    }
  });
  await page.goto('/?bike=42');
  await waitForSb(page);

  const modal = page.locator('#checkin-modal');
  await expect(modal.locator('#ci-confirm')).toBeEnabled();
  await modal.locator('#ci-confirm').click();
  await expect.poll(() => patched.some((p) => p.status === 'active' && p.assigned_bike_id === 'b1')).toBe(true);
  await expect(modal).toBeHidden();
});

test('the in-app scanner reads a bike sticker into the open modal, and an expired check-in is ignored', async ({ page }) => {
  await stubSupabase(page, fixtures());
  await unlockStaff(page);
  await page.addInitScript(() => {
    // 16 minutes old: past the 15-minute window, so /?bike= must NOT reopen it.
    localStorage.setItem('mm_active_checkin', JSON.stringify({ entryId: 'e1', ref: '#7', openedAt: Date.now() - 16 * 60 * 1000 }));
  });
  await page.goto('/?bike=42');
  await waitForSb(page);
  await expect(page.locator('#bike-profile-modal')).toHaveCSS('display', 'flex');
  await expect(page.locator('#checkin-modal')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('mm_active_checkin'))).toBeNull();

  // Now a real check-in is open; a sticker scanned through the camera path fills its field.
  // @ts-expect-error app globals
  await page.evaluate(() => { closeBikeProfile(); S.staffTab = 'queue'; renderStaffQueue(); showCheckinModal('e1'); });
  const modal = page.locator('#checkin-modal');
  await expect(modal).toHaveCSS('display', 'flex');
  await expect(modal.locator('#ci-bike')).toHaveValue('');
  // A payment already chosen must survive the arrival of the bike.
  await modal.getByRole('button', { name: /Paid · Card/ }).click();
  // @ts-expect-error app globals
  await page.evaluate(() => _onScanPayload('https://micromobilityrentals.pages.dev/?bike=42'));
  await expect(modal.locator('#ci-bike')).toHaveValue('42');
  await expect(modal.locator('#ci-bike-spec')).toContainText('Shimano 105');
  expect(await page.evaluate('S._ciPaid')).toBe('card');
  // A sticker that holds only the number works too, and the field has its own Scan button.
  await modal.locator('#ci-bike').fill('');
  // @ts-expect-error app globals
  await page.evaluate(() => _onScanPayload('42'));
  await expect(modal.locator('#ci-bike')).toHaveValue('42');
  await expect(modal.getByRole('button', { name: 'Scan sticker' })).toBeVisible();
});
