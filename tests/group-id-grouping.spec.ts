import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Staff "Add group" / booking-editor added riders: rows sharing a group_id must render as
// ONE roster group even with no customer account (walk-ins), while account-less rows
// without a group_id stay solo. Consecutive groups show a "#1 - #2" queue-number range in
// both the desktop table and the mobile cards; solo rows never do.
test('riders sharing a group_id render as one group even without customer accounts', async ({ page }) => {
  const row = (id: string, qn: number, name: string, groupId: string | null): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn,
    name, phone: '', customer_id: null, group_id: groupId, status: 'waiting', paid: false,
    price: 30, walk_in: true, registered_at: '2099-01-01T10:00:00Z',
  });
  const q = [
    row('e1', 1, 'Grouped One', 'g1'),
    row('e2', 2, 'Grouped Two', 'g1'),
    row('e3', 3, 'Solo Three', null),
    row('e4', 4, 'Solo Four', null),
  ];
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  await stubSupabase(page, { queue_entries: q, sessions });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const txt = await page.evaluate(() => {
    // @ts-expect-error app globals
    S.staffTab = 'queue'; renderStaffQueue();
    return document.body.textContent || '';
  });
  expect(txt).toMatch(/#1\s*[-–]\s*#2/); // e1+e2 grouped by group_id
  expect(txt).not.toMatch(/#2\s*[-–]\s*#3/); // the group does not swallow the next solo row
  expect(txt).not.toMatch(/#3\s*[-–]\s*#4/); // account-less rows without group_id stay solo
});
