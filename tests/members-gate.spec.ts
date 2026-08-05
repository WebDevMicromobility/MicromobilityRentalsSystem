import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// Saturday Social Ride members gate: the community session is visible to every
// signed-in customer, but only members (community_member() RPC answers true)
// may continue into the booking flow; everyone else gets the members-only
// dialog. The stub answers [] for unknown RPCs, so a spec without an explicit
// 'rpc:community_member' fixture behaves as a NON-member.

const jcc = { id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, location: 'JCC' };
const sat = {
  id: 'comm1', day: 'Saturday', session_date: '2099-01-10', capacity: 20, status: 'open', created_at: 1, location: 'JCC',
  event_kind: 'community', needs_approval: true, hide_queue: true, spots: 20, title: 'Saturday Social Ride',
};
const fixtures = {
  sessions: [jcc, sat],
  bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }],
  queue_entries: [],
};

test('non-member clicking the Saturday card in Reserve gets the members-only dialog', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setCustTab('register')`);

  await page.locator('.sess-card-comm').click();
  const modal = page.locator('#confirm-modal');
  await expect(modal).toContainText('Members only');
  await expect(modal).toContainText('Saturday Social Ride');
  // the session was NOT selected
  expect(await page.evaluate('S.selSession')).toBeNull();

  // dialog dismisses cleanly
  await modal.locator('button', { hasText: 'Got it' }).click();
  await expect(modal).toBeHidden();
});

test('non-member clicking the landing Saturday event card gets the dialog and stays on landing', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate('goLanding()'); // a signed-in customer boots into Reserve; the event cards live on landing

  await page.locator('#land-events .landing-event-card.community').click();
  await expect(page.locator('#confirm-modal')).toContainText('Members only');
  expect(await page.evaluate('S.view')).toBe('landing');
});

test('member continues into the booking flow with no dialog', async ({ page }) => {
  await stubSupabase(page, { ...fixtures, 'rpc:community_member': true });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setCustTab('register')`);

  await page.locator('.sess-card-comm').click();
  await expect(page.locator('.sess-card-comm.sess-selected')).toBeVisible();
  expect(await page.evaluate('S.selSession')).toBe('comm1');
  await expect(page.locator('#confirm-modal')).toBeHidden();
});

test('member landing card click opens the community Reserve flow', async ({ page }) => {
  await stubSupabase(page, { ...fixtures, 'rpc:community_member': true });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate('goLanding()');

  await page.locator('#land-events .landing-event-card.community').click();
  await page.waitForFunction(`S.view==='customer'`);
  expect(await page.evaluate('S.selEvent')).toBe('community');
  await expect(page.locator('#confirm-modal')).toBeHidden();
});
