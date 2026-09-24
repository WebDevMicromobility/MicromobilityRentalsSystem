import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The session strip holds one band of rides at a time - Tonight, Upcoming or Past - so tonight's
// chips are not lost among next month's. The band follows the ride on screen: the desk still
// opens on tonight's live ride (else the latest past one), and the pill agrees with it. Picking
// a pill opens that band's first ride. Reset view brings back tonight's ride with no filters.

const TODAY = '2026-10-06'; // a Tuesday in Jeddah
const slot = (t = '21:00 - 23:00') => JSON.stringify({ _time: t, _total: 40 });
const sess = (id: string, day: string, status: string, extra: Record<string, unknown> = {}) =>
  ({ id, session_date: id.slice(0, 10), day, status, capacity: 40, created_at: 1, bike_slots: slot(), ...extra });
const sessions = [
  sess('2026-09-29', 'Tuesday', 'closed'),
  sess('2026-10-04', 'Sunday', 'closed'),
  sess(TODAY, 'Tuesday', 'open'),
  sess('2026-10-11', 'Sunday', 'open'),
  sess('2026-10-13', 'Tuesday', 'open'),
  sess('2026-10-18', 'Sunday', 'closed'), // a future ride someone closed: not in Upcoming
  sess('2026-10-10', 'Saturday', 'open', { event_kind: 'community', ride_kind: 'saturday', needs_approval: true, hide_queue: true, spots: 60 }),
];

async function desk(page: Page, opts: { now?: string; frontDesk?: boolean } = {}) {
  await page.clock.setFixedTime(new Date(opts.now || `${TODAY}T15:00:00Z`)); // 18:00 in Jeddah
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`allSessions().length>0`);
  if (opts.frontDesk) await page.evaluate(`S.staffRole='frontdesk'`);
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';_autoSelectSession();renderStaffQueue()`);
}
const pill = (page: Page, name: RegExp) => page.locator('.sess-scope .filter-pill', { hasText: name });
const chipDates = (page: Page) => page.locator('.sess-bar-desktop .sess-summary-chip').evaluateAll(
  els => els.map(e => (e.getAttribute('onclick') || '').match(/"([^"]+)"/)?.[1] || ''));

test('opens on Tonight, with a count on every band', async ({ page }) => {
  await desk(page);
  await expect(pill(page, /Tonight/)).toHaveAttribute('aria-pressed', 'true');
  await expect(pill(page, /Tonight/).locator('.scope-n')).toHaveText('1');
  await expect(pill(page, /Upcoming/).locator('.scope-n')).toHaveText('3'); // 11th, 13th and the Saturday ride; the closed 18th is not live
  await expect(pill(page, /Past/).locator('.scope-n')).toHaveText('2');
  expect(await chipDates(page)).toEqual([TODAY]);
  expect(await page.evaluate('S.sfSession')).toBe(TODAY);
  await expect(page.locator('.sess-scope-reset')).toHaveCount(0); // already on the opening view
});

test('a pill opens the first ride of its band, and the strip shows only that band', async ({ page }) => {
  await desk(page);
  await pill(page, /Upcoming/).click();
  expect(await page.evaluate('S.sfSession')).toBe('2026-10-10');
  expect((await chipDates(page)).sort()).toEqual(['2026-10-10', '2026-10-11', '2026-10-13']);
  await pill(page, /Past/).click();
  expect(await page.evaluate('S.sfSession')).toBe('2026-10-04'); // newest first
  expect(await chipDates(page)).toEqual(['2026-10-04', '2026-09-29']);
  await expect(pill(page, /Past/)).toHaveAttribute('aria-pressed', 'true');
});

test('picking a ride from the session list moves the band with it', async ({ page }) => {
  await desk(page);
  await page.evaluate(`setSfSession('2026-09-29')`);
  await expect(pill(page, /Past/)).toHaveAttribute('aria-pressed', 'true');
  expect(await chipDates(page)).toContain('2026-09-29');
});

test('Reset view returns to tonight and clears the filters', async ({ page }) => {
  await desk(page);
  await pill(page, /Past/).click();
  await page.evaluate(`S.sfStatus='done';S.sfPay='paid';S.sfSearch='ali';renderStaffQueue()`);
  await page.locator('.sess-scope-reset').click();
  expect(await page.evaluate('[S.sfSession,S.sfStatus,S.sfPay,S.sfSearch]')).toEqual([TODAY, 'all', 'all', '']);
  await expect(pill(page, /Tonight/)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sess-scope-reset')).toHaveCount(0);
});

test('with no ride tonight the desk opens on the latest past ride (the existing rule), in Past', async ({ page }) => {
  await desk(page, { now: '2026-10-07T15:00:00Z' }); // Wednesday: nothing on
  expect(await page.evaluate('S.sfSession')).toBe(TODAY);
  await expect(pill(page, /Past/)).toHaveAttribute('aria-pressed', 'true');
  await expect(pill(page, /Tonight/)).toBeDisabled();
});

test('Front Desk never sees the approval ride in any band', async ({ page }) => {
  await desk(page, { frontDesk: true });
  await expect(pill(page, /Upcoming/).locator('.scope-n')).toHaveText('2');
  await pill(page, /Upcoming/).click();
  expect(await chipDates(page)).not.toContain('2026-10-10');
});

test('Arabic labels', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('cq_lang', 'ar'); localStorage.setItem('cq_lang_pick', '1'); } catch { /* */ } });
  await desk(page);
  await expect(page.locator('.sess-scope')).toContainText('الليلة');
  await expect(page.locator('.sess-scope')).toContainText('القادمة');
  await expect(page.locator('.sess-scope')).toContainText('السابقة');
});

test('on a phone the three pills share one row at a tappable height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await desk(page);
  const boxes = await page.locator('.sess-scope .filter-pill').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top), h: r.height }; }));
  expect(new Set(boxes.map(b => b.y)).size).toBe(1);
  for (const b of boxes) expect(b.h).toBeGreaterThanOrEqual(44);
});
