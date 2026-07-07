import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// MM Team roster must sync via the shared team_members table, not just this device's localStorage.
test('team roster loads from the shared team_members table (plus names used in sales)', async ({ page }) => {
  await stubSupabase(page, {
    team_members: [{ name: 'Rakan' }, { name: 'Huda' }],
    cashier_sales: [{ id: 'cs1', session_id: 's1', team_name: 'Legacy Guy', pay: 'team', name: 'x', qty: 1, price: 5 }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const names = await page.evaluate('teamNames()') as string[];
  // DB names present on this device even though they were never added here locally…
  expect(names).toContain('Rakan');
  expect(names).toContain('Huda');
  // …and a name only seen in past sales is never lost.
  expect(names).toContain('Legacy Guy');
  // The DB sync function exists (called on every roster save).
  expect(await page.evaluate('typeof _teamRosterSyncDB')).toBe('function');
});
