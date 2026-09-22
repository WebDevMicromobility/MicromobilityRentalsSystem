import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, loginCustomer, unlockStaff, waitForSb } from './helpers/supabase';

// The reason a rider gives when they cancel is saved on the booking (queue_entries.cancel_reason,
// a code; cancel_note, their words for Other) through customer_booking_update. It used to stay in
// the rider's own browser. Staff read it under the Cancelled badge, in Bookings & history, and as
// "Why riders cancel" in Analytics, in their own language whatever the rider picked it in.

const S1 = '2099-01-01';
const sessions = [{ id: S1, session_date: S1, day: 'Thursday', status: 'open', capacity: 10, created_at: 1 }];
const e = (id: string, x: Record<string, unknown> = {}) => ({
  id, session_id: S1, session_day: 'Thursday', session_date: S1, queue_num: 1, name: 'Rider ' + id,
  phone: '0550000001', type_preference: 'Road', size: 'M', status: 'waiting', paid: false,
  price: 75, registered_at: '2098-12-20T10:00:00Z', customer_id: 'c1', ...x });

async function rider(page: Page) {
  const patches: Record<string, unknown>[] = [];
  await stubSupabase(page, { sessions, bikes: [], queue_entries: [e('b1'), e('b2', { queue_num: 2 })], 'rpc:customer_booking_update': true });
  await page.route(/rpc\/customer_booking_update/, async r => {
    patches.push(r.request().postDataJSON().p_patch);
    await r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: 'true' });
  });
  await loginCustomer(page, { id: 'c1', name: 'Rider b1', session_token: 'tok' });
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length===2`);
  return patches;
}

test('the reason a rider picks is sent with the cancel, as a code, for every rider of the booking', async ({ page }) => {
  const patches = await rider(page);
  await page.evaluate(`showCancelReasonModal('b1')`);
  await page.locator('#cancel-reason-modal .cancel-reason-opt', { hasText: 'The weather' }).click();
  await page.locator('#cancel-reason-modal .btn-primary').click();
  await expect.poll(() => patches.length).toBe(2);                         // the party of two, cancelled together
  for (const p of patches) expect(p).toMatchObject({ status: 'cancelled', cancel_reason: 'weather' });
  expect(patches.some(p => 'cancel_note' in p)).toBe(false);
});

test('Other sends the rider\'s own words beside the code', async ({ page }) => {
  const patches = await rider(page);
  await page.evaluate(`showCancelReasonModal('b1')`);
  await page.locator('#cancel-reason-modal .cancel-reason-opt', { hasText: 'Other' }).click();
  await page.fill('#cancel-other-text', 'My bike at home got fixed');
  await page.locator('#cancel-reason-modal .btn-primary').click();
  await expect.poll(() => patches.length).toBe(2);
  expect(patches[0]).toMatchObject({ cancel_reason: 'other', cancel_note: 'My bike at home got fixed' });
});

test('staff read the reason in their own language: the roster, Bookings & history, and Analytics', async ({ page }) => {
  await stubSupabase(page, {
    sessions, bikes: [], tags: [], customer_tags: [],
    customers: [{ id: 'c1', name: 'Rider c1', email: 'rider.c1@gmail.com', phone: '+966551876215', created_at: '2098-06-01T00:00:00Z' }],
    queue_entries: [
      e('x1', { status: 'cancelled', cancelled_by: 'customer', cancel_reason: 'weather' }),
      e('x2', { status: 'cancelled', cancelled_by: 'customer', cancel_reason: 'weather', queue_num: 2 }),  // same party: counts once
      e('x3', { status: 'cancelled', cancelled_by: 'customer', cancel_reason: 'other', cancel_note: 'Flat tyre on my car', customer_id: 'c2', queue_num: 3 }),
      e('x4', { status: 'cancelled', cancelled_by: 'customer', customer_id: 'c3', queue_num: 4 }),        // before reasons were saved
      e('x5', { status: 'cancelled', cancelled_by: 'staff', customer_id: 'c4', queue_num: 5 }),
    ],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length===5`);
  const cell = await page.evaluate(`statusCellHtml(getQueue().find(x=>x.id==='x3'))`) as string;
  expect(cell).toContain('Other: “Flat tyre on my car”');
  // Bookings & history
  await page.evaluate(`openAccountHistory('c1')`);
  await expect(page.locator('#cust-modal .cx-why').first()).toHaveText('The weather (heat, wind or dust)');
  await page.evaluate(`closeCustomerProfile()`);
  // Analytics: the bookings with a reason, the party once; x4 (no reason) and x5 (staff, none) are not in it
  await page.evaluate(`S.analyticsRange='all';setStaffTab('analytics');_applyAnView('customers')`);
  const card = page.locator('#tab-analytics .cx-card');
  await expect(card.locator('.chart-card-sub')).toContainText('a party counted once: 2, of which staff recorded 0');
  await expect(card.locator('.analytics-bar-label')).toHaveText(['The weather (heat, wind or dust)', 'Other']);
  await expect(card.locator('.cx-word')).toContainText('Flat tyre on my car');
  // In Arabic, the same codes read in Arabic.
  await page.evaluate(`setLang('ar')`);
  await page.evaluate(`renderAnalytics();_applyAnView('customers')`);
  await expect(page.locator('#tab-analytics .cx-card .analytics-bar-label').first()).toHaveText('الطقس (حرارة أو رياح أو غبار)');
});

async function staffDesk(page: Page) {
  const writes: Record<string, unknown>[] = [];
  await stubSupabase(page, { sessions, bikes: [], queue_entries: [e('w1', { customer_id: null }), e('w2', { customer_id: null, queue_num: 2 })] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length===2`);
  page.on('request', r => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) { try { writes.push(r.postDataJSON()); } catch { /* not JSON */ } }
  });
  return writes;
}
const confirmBtn = (page: Page) => page.locator('#confirm-modal button', { hasText: 'Cancel booking' }).last();

test('staff can say why when they cancel, and the reason is saved with the cancel', async ({ page }) => {
  const writes = await staffDesk(page);
  await page.evaluate(`staffCancelEntry('w1')`);
  const chips = page.locator('#confirm-modal .cx-chip');
  await expect(chips).toHaveCount(11);                                     // the rider's eight, duplicate, mistake, other
  await expect(chips.nth(8)).toHaveText('Duplicate booking');
  await chips.nth(8).click();
  await expect(chips.nth(8)).toHaveAttribute('aria-pressed', 'true');
  await confirmBtn(page).click();
  await expect.poll(() => writes.find(w => w.status === 'cancelled')).toMatchObject({ cancelled_by: 'staff', cancel_reason: 'duplicate' });
});

test('a staff cancel with no reason picked goes ahead without one; Other keeps the words', async ({ page }) => {
  const writes = await staffDesk(page);
  await page.evaluate(`staffCancelEntry('w1')`);
  await confirmBtn(page).click();
  await expect.poll(() => writes.filter(w => w.status === 'cancelled').length).toBe(1);
  expect(writes.find(w => w.status === 'cancelled')).not.toHaveProperty('cancel_reason');
  await page.evaluate(`staffCancelEntry('w2')`);
  await page.locator('#confirm-modal .cx-chip', { hasText: 'Other' }).click();
  await page.fill('#cx-note', 'Moved to a private session');
  await confirmBtn(page).click();
  await expect.poll(() => writes.filter(w => w.status === 'cancelled').length).toBe(2);
  expect(writes.filter(w => w.status === 'cancelled')[1]).toMatchObject({ cancel_reason: 'other', cancel_note: 'Moved to a private session' });
});

test('the check-in screen\'s Cancel booking asks the same, optionally', async ({ page }) => {
  const writes = await staffDesk(page);
  await page.evaluate(`showCheckinModal('w1')`);
  await page.evaluate(`_ciCancelBooking()`);
  await page.locator('#confirm-modal .cx-chip', { hasText: 'Booked by mistake' }).click();
  await confirmBtn(page).click();
  await expect.poll(() => writes.find(w => w.status === 'cancelled')).toMatchObject({ cancel_reason: 'mistake' });
});
