import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

test('front desk mode limits the staff tabs to Sales & Bookings', async ({ page }) => {
  await stubSupabase(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await expect(page.locator('#staff-tab-nav')).toBeVisible();

  const vis = () => page.evaluate(() =>
    [...document.querySelectorAll('#staff-tab-nav .tab-btn')]
      .filter((b) => (b as HTMLElement).style.display !== 'none')
      .map((b) => (b as HTMLElement).dataset.stab),
  );

  // Admin (default): all tabs visible
  expect(await vis()).toEqual(expect.arrayContaining(['cashier', 'queue', 'inventory', 'analytics', 'history']));

  // Switch to Front Desk -> only Sales (cashier) + Bookings (queue)
  await page.evaluate('setStaffRole("frontdesk")');
  expect((await vis()).sort()).toEqual(['cashier', 'queue']);

  // Trying to open a hidden tab bounces back to queue
  await page.evaluate('setStaffTab("analytics")');
  expect(await page.evaluate('S.staffTab')).toBe('queue');

  // Back to Admin restores everything
  await page.evaluate('setStaffRole("admin")');
  expect(await vis()).toContain('analytics');
});
