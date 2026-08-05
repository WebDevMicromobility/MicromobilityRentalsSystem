import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// Approved Saturday Social Ride riders must never see a queue number - not on the
// My Rides card, and not inside the QR payload (any camera decodes it), while JCC
// bookings keep their numbered reference and the staff scanner reads both formats.

const sat = {
  id: 'comm1', day: 'Saturday', session_date: '2099-01-10', capacity: 20, status: 'open', created_at: 1, location: 'JCC',
  event_kind: 'community', needs_approval: true, hide_queue: true, spots: 20, title: 'Saturday Social Ride',
};
const jcc = { id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, location: 'JCC' };
const row = (id: string, session: string, num: number) => ({
  id, name: 'Spec Rider', customer_id: 'c1', session_id: session, session_day: 'Saturday',
  session_date: '2099-01-10', queue_num: num, status: 'waiting', paid: false, price: 0,
  registered_at: '2099-01-01T10:00:00Z', type_preference: 'Any', approval: 'approved',
});
const fixtures = {
  sessions: [jcc, sat],
  bikes: [],
  queue_entries: [row('abc123xyz', 'comm1', 7), row('def456uvw', 's1', 3)],
};

test('approved community booking exposes no queue number, JCC keeps its ref', async ({ page }) => {
  await stubSupabase(page, { ...fixtures, 'rpc:community_member': true });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider' });
  await page.goto('/');
  await waitForSb(page);

  // the community ref is number-free; the JCC ref keeps its number
  expect(await page.evaluate(`bookingRef(getQueue().find(e=>e.sessionId==='comm1'))`)).toBe('MMC-abc123');
  expect(await page.evaluate(`bookingRef(getQueue().find(e=>e.sessionId==='s1'))`)).toBe('MMC-3-def456');

  // the rendered My Rides card never shows #7 for the Saturday booking
  await page.evaluate(`setCustTab('myrides')`);
  const html = String(await page.evaluate(`document.getElementById('tab-myrides').innerHTML`));
  expect(html).not.toContain('#7');
});
