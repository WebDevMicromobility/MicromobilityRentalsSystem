import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const past = '2020-01-01';

// When viewing ALL sessions, "Expected" must not count riders stuck 'waiting' on past sessions.
test('Expected count ignores stale waiting riders from past sessions (all-sessions view)', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [
      { id: 'sT', day: 'Friday', session_date: today, capacity: 12, status: 'open', created_at: 2 },
      { id: 'sP', day: 'Monday', session_date: past, capacity: 12, status: 'open', created_at: 1 },
    ],
    queue_entries: [
      { id: 'w-today', name: 'Today Waiting', session_id: 'sT', session_day: 'Friday', session_date: today, queue_num: 1, status: 'waiting', paid: false, price: 30, registered_at: today + 'T10:00:00Z' },
      // 3 stale 'waiting' left on a past session — must NOT count as expected
      ...[1, 2, 3].map((n) => ({ id: 'w-old' + n, name: 'Old ' + n, session_id: 'sP', session_day: 'Monday', session_date: past, queue_num: n, status: 'waiting', paid: false, price: 30, registered_at: past + 'T10:00:00Z' })),
    ],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.sfSession='all'; renderStaffQueue();`);

  const expected = await page.evaluate(`[...document.querySelectorAll('#tab-queue .stat-card')].find(c=>/expected/i.test(c.textContent))?.querySelector('.stat-num')?.textContent`);
  expect(expected).toBe('1'); // only today's waiting, not the 3 stale past ones

  // selecting the past session explicitly still shows its real count (3)
  await page.evaluate(`S.sfSession='sP'; renderStaffQueue();`);
  const perSession = await page.evaluate(`[...document.querySelectorAll('#tab-queue .stat-card')].find(c=>/expected/i.test(c.textContent))?.querySelector('.stat-num')?.textContent`);
  expect(perSession).toBe('3');
});
