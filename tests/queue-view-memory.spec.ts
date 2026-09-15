import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A refresh brings the staffer back to the session and view they had, not to tonight's default.
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const S2 = '2099-01-20';
const sessions = [
  { id: today, day: 'Today', session_date: today, capacity: 20, status: 'open', created_at: 1 },
  { id: S2, day: 'Tuesday', session_date: S2, capacity: 20, status: 'open', created_at: 2 },
];

test('the chosen session, view and status filter survive a refresh', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('queue');renderStaffQueue()`);
  expect(await page.evaluate('S.sfSession')).toBe(today);                       // tonight by default
  await page.evaluate(`setSfSession('${S2}');S.queueView='sessions';renderStaffQueue();setSfStatus('waiting')`);
  await page.reload();
  await waitForSb(page);
  await page.evaluate(`setStaffTab('queue');renderStaffQueue()`);
  expect(await page.evaluate('[S.sfSession, S.queueView, S.sfStatus]')).toEqual([S2, 'sessions', 'waiting']);
});

test('a remembered session that no longer exists falls back to tonight', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [] });
  await unlockStaff(page);
  await page.addInitScript(() => sessionStorage.setItem('cq_queue_view', JSON.stringify({ sfSession: 'gone-2050-01-01', queueView: 'bookings', sfStatus: 'all' })));
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('queue');renderStaffQueue()`);
  expect(await page.evaluate('S.sfSession')).toBe(today);
});
