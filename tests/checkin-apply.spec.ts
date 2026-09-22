import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The check-in modal, 2026-09-22: Check In is an action on the rider, beside No-Show and Cancel
// booking. Confirm keeps what the modal changed — payment, bike type, a picked bike held as a
// reservation — and leaves the rider waiting. Every button in the modal is the same size as the
// ones beside it.

const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
const entry = {
  id: 'e1', session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: 7, name: 'Quick Rider',
  phone: '0500000001', customer_id: null, type_preference: 'Any', size: 'M', status: 'waiting', paid: false, price: 60,
  height: 178, registered_at: '2099-02-10T10:00:00Z',
};
const bikes = [{ id: 'b1', name: 'R-01', type: 'Road', size: 'M', status: 'available', colors: [] }];

type P = import('@playwright/test').Page;
async function open(page: P) {
  await stubSupabase(page, { sessions, queue_entries: [entry], bikes });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`showCheckinModal('e1')`);
  const modal = page.locator('#checkin-modal');
  await expect(modal.getByText('#7 Quick Rider')).toBeVisible();
  const patches: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries') && r.url().includes('id=eq.e1')) patches.push(r.postDataJSON());
  });
  return { modal, patches };
}

test('Confirm keeps the payment and type it was given and leaves the rider waiting', async ({ page }) => {
  const { modal, patches } = await open(page);
  await modal.getByRole('button', { name: /Paid · Card/ }).click();
  await modal.getByRole('button', { name: 'Road', exact: true }).click();
  await modal.locator('#ci-confirm').click();
  await expect(modal).toBeHidden();

  await expect.poll(() => patches.length).toBeGreaterThanOrEqual(1);
  expect(patches[0].status).toBeUndefined();        // nobody was checked in
  expect(patches[0].paid).toBe(true);
  expect(patches[0].type_preference).toBe('Road');
  expect(await page.evaluate(`getQueue().find(e=>e.id==='e1').status`)).toBe('waiting');
});

test('Check In sits beside No-Show and Cancel booking, and checks the rider in', async ({ page }) => {
  const { modal, patches } = await open(page);
  const actions = modal.locator('.ci-actions .btn-sm');
  await expect(actions).toHaveCount(3);
  await expect(actions.nth(0)).toHaveText('Check In');
  await expect(actions.nth(1)).toHaveText('No-Show');
  await expect(actions.nth(2)).toHaveText('Cancel booking');
  await modal.locator('#ci-checkin').click();
  await expect(modal).toBeHidden();
  await expect.poll(() => patches.length).toBeGreaterThanOrEqual(1);
  expect(patches[0].status).toBe('active');
});

test('every button in the modal matches the ones beside it', async ({ page }) => {
  const { modal } = await open(page);
  const widths = async (sel: string) =>
    (await modal.locator(sel).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width))));
  const same = (w: number[]) => { expect(w.length).toBeGreaterThan(1); expect(Math.max(...w) - Math.min(...w)).toBeLessThanOrEqual(1); };
  same(await widths('.ci-actions .btn-sm'));        // Check In · No-Show · Cancel booking
  same(await widths('.modal-footer > button'));     // Close · Confirm
  for (const g of await modal.locator('.ci-opts').all()) {   // the payment row, then the type row
    same(await g.locator('.toggle-btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width))));
  }
  // and nothing spills out of its own button
  for (const b of await modal.locator('.ci-actions .btn-sm, .modal-footer > button, .ci-opts .toggle-btn').all()) {
    expect(await b.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  }
});

test('the members-only dialog gives its three buttons one size', async ({ page }) => {
  await stubSupabase(page, { sessions: [{ ...sessions[0], id: 'comm1', event_kind: 'community', needs_approval: true, hide_queue: true, title: 'Saturday Social Ride' }], queue_entries: [] });
  await page.addInitScript(() => localStorage.setItem('cq_session', JSON.stringify({ id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', session_token: 'tok-spec' })));
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`selectEvent('community')`);
  const row = page.locator('#confirm-modal .cm-actions');
  await expect(row.locator('a, button')).toHaveCount(3);
  const box = await row.locator('a, button').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) }; }));
  expect(Math.max(...box.map((b) => b.w)) - Math.min(...box.map((b) => b.w))).toBeLessThanOrEqual(1);
  expect(Math.max(...box.map((b) => b.h)) - Math.min(...box.map((b) => b.h))).toBeLessThanOrEqual(1);
  for (const b of await row.locator('a, button').all()) {
    expect(await b.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  }
});
