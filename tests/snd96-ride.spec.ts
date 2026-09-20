import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

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
  expect(await page.evaluate(`_openToAll(allSessions().find(s=>s.id==='snd1'))`)).toBe(true);
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
