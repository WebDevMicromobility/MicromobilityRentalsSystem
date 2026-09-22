import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, unlockStaff, waitForSb } from './helpers/supabase';

// Defaults that used to reach for the oldest thing on record instead of the current one,
// and state that outlived the account it belonged to.

const past = { id: '2020-01-04', day: 'Saturday', session_date: '2020-01-04', capacity: 20, status: 'open', created_at: 1,
  event_kind: 'community', needs_approval: true, hide_queue: true, spots: 20, title: 'Ride From Long Ago' };
const next = { id: '2099-01-10', day: 'Saturday', session_date: '2099-01-10', capacity: 20, status: 'open', created_at: 2,
  event_kind: 'community', needs_approval: true, hide_queue: true, spots: 20, title: 'The Next Ride' };

// 2026-09-22: it used to name the ride the card leads to. Somebody who is not a member is told
// the rides are invite-only and how to ask — never which ride is on.
test('the members-only dialog names no ride, whatever is coming up', async ({ page }) => {
  await stubSupabase(page, { sessions: [past, next], queue_entries: [] });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`selectEvent('community')`);
  const modal = page.locator('#confirm-modal');
  await expect(modal).toContainText('Community members only');
  await expect(modal).not.toContainText('The Next Ride');
  await expect(modal).not.toContainText('Ride From Long Ago');
  await expect(modal.locator('.ev-name')).toHaveCount(0);
});

test('with nothing coming up, the dialog names no ride at all (never the circuit)', async ({ page }) => {
  await stubSupabase(page, { sessions: [past], queue_entries: [] });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`selectEvent('community')`);
  const modal = page.locator('#confirm-modal');
  await expect(modal).toContainText('Community members only');
  await expect(modal.locator('.ev-name')).toHaveCount(0);
});

// With no ride tonight the queue opens on the latest ride before today (575fd6c, _currentSessId);
// what this keeps is that tonight's ride is found even with a ride's mark on its id.
test('the staff queue opens on tonight\'s ride, even with a ride\'s mark on its id', async ({ page }) => {
  const old = { id: '2020-01-05', day: 'Sunday', session_date: '2020-01-05', status: 'open', capacity: 10, created_at: 1 };
  const later = { id: '2099-01-05', day: 'Monday', session_date: '2099-01-05', status: 'full', capacity: 10, created_at: 2 };
  await stubSupabase(page, { sessions: [old, later], queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const today = await page.evaluate('todayStr()') as string;
  await page.evaluate(`S.sessions.push({id:'${today}-pw',session_date:'${today}',day:'Today',status:'open',capacity:10,created_at:3,event_kind:'community',ride_kind:'petromin',needs_approval:false});_autoSelectSession()`);
  expect(await page.evaluate('S.sfSession')).toBe(`${today}-pw`);        // tonight's, even with a ride's mark on its id
});

test('signing out drops the promo code and the add-ons picked on the account', async ({ page }) => {
  await stubSupabase(page, { queue_entries: [] });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.promoApplied={id:'p1',code:'ONLYFORC1',kind:'percent',value:50,customer_id:'c1'};S._promoMsg='applied';S.regAddons=[{id:'a1',qty:1}];S.modifyEntryId='e1';doLogout(true)`);
  expect(await page.evaluate('[S.promoApplied,S._promoMsg,S.regAddons.length,S.modifyEntryId]')).toEqual([null, '', 0, null]);
});
