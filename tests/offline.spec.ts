import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff } from './helpers/supabase';

// Phase-0 offline resilience: the app snapshots the last good load to localStorage
// (_cacheSave) and restores it when the network is down (_cacheRestore), so staff
// aren't left with a blank screen if the connection drops mid-session.

const openSession = {
  id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12,
  status: 'open', created_at: 1, bike_slots: null, location: 'JCC', addons: null,
};
const booking = {
  id: 'q1', name: 'Offline Rider', email: 'o@x.com', phone: '0500000001', size: 'M',
  type_preference: 'Any', paid: false, price: 30, session_id: 's1', session_day: 'Friday',
  session_date: '2099-01-09', queue_num: 3, status: 'waiting',
  registered_at: '2099-01-09T10:00:00Z', walk_in: false,
};

test('staff sees the cached queue after the network drops', async ({ page }) => {
  // 1. Load online so the app snapshots the data to localStorage.
  await stubSupabase(page, { sessions: [openSession], queue_entries: [booking] });
  await unlockStaff(page);
  await page.goto('/');
  await expect(page.locator('#tab-queue')).toContainText('Offline Rider');
  // confirm a snapshot was actually written
  await expect.poll(() => page.evaluate('!!localStorage.getItem("cq_snapshot")')).toBe(true);

  // 2. Go offline: every Supabase request now fails.
  await page.route('**://*.supabase.co/**', (r) => r.abort());
  await page.reload();

  // 3. The cached booking still renders (restored from the snapshot), not a blank screen.
  await expect(page.locator('#tab-queue')).toContainText('Offline Rider', { timeout: 10000 });
  expect(await page.evaluate('S.dataLoaded === true')).toBe(true);
});

test('a booking made offline is queued and not lost', async ({ page }) => {
  await stubSupabase(page, { sessions: [openSession] });
  await page.addInitScript(() => localStorage.setItem('cq_session', JSON.stringify(
    { id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001' })));
  await page.goto('/');
  // simulate an offline booking submit: the outbox should capture it
  await page.evaluate(`Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });`);
  const queued = await page.evaluate(`
    S.selSession = 's1';
    _bookOutboxAdd({ id: 'boff1', name: 'Queued Rider', session_id: 's1', queue_num: 9, status: 'waiting' });
    _bookOutboxCount();
  `);
  expect(Number(queued)).toBeGreaterThan(0); // the booking is safely queued for later sync
});
