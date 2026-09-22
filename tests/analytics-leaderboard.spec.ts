import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The rider leaderboard and the community statistics live in Analytics, as two more of its
// views; Community keeps the accounts and the flagged list. Moved 2026-09-22.
const sessions = [{ id: 's1', day: 'Friday', session_date: '2026-09-18', capacity: 20, status: 'closed', created_at: 1 }];
const ride = (id: string, qn: number, name: string, cust: string) => ({
  id, session_id: 's1', session_day: 'Friday', session_date: '2026-09-18', queue_num: qn,
  name, phone: '', customer_id: cust, status: 'done', paid: true, price: 57.5,
  type_preference: 'Hybrid', registered_at: '2026-09-17T10:00:00Z', ride_duration: 60,
});
const queue_entries = [
  ride('e1', 1, 'Amal Top', 'c1'), ride('e2', 2, 'Amal Top', 'c1'), ride('e3', 3, 'Badr Next', 'c2'),
];
const customers = [
  { id: 'c1', name: 'Amal Top', created_at: '2026-01-01' },
  { id: 'c2', name: 'Badr Next', created_at: '2026-01-02' },
];

async function staff(page: Page) {
  await stubSupabase(page, { sessions, queue_entries, customers });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
}

test('Analytics has Leaderboard and Statistics views, each showing only its own sections', async ({ page }) => {
  await staff(page);
  await page.evaluate(`setStaffTab('analytics')`);
  const tab = page.locator('#tab-analytics');
  await tab.locator('.an-nav-btn[data-anview="leaderboard"]').click();
  await expect(tab.locator('.form-title', { hasText: 'Leaderboard' }).filter({ visible: true })).toHaveCount(1);
  await expect(tab.getByText('Amal Top').filter({ visible: true }).first()).toBeVisible();
  await expect(tab.locator('.insights-grid')).toBeHidden(); // Overview is not on this view

  await tab.locator('.an-nav-btn[data-anview="stats"]').click();
  await expect(tab.locator('.form-title', { hasText: 'Leaderboard' }).filter({ visible: true })).toHaveCount(0);
  await expect(tab.getByText('Milestone watch').filter({ visible: true }).first()).toBeVisible();
  await expect(tab.locator('.analytics-kpi-card').filter({ visible: true }).first()).toBeVisible();
});

test('the leaderboard controls repaint Analytics and keep its view', async ({ page }) => {
  await staff(page);
  await page.evaluate(`setStaffTab('analytics');setAnView('leaderboard')`);
  await page.evaluate(`setLb('lbWindow','month')`);
  expect(await page.evaluate('S.anView')).toBe('leaderboard');
  await expect(page.locator('#tab-analytics .an-nav-btn.active')).toHaveAttribute('data-anview', 'leaderboard');
  await expect(page.locator('#tab-analytics .form-title', { hasText: 'Leaderboard' }).filter({ visible: true })).toHaveCount(1);
});

test('Community keeps accounts, the flagged list and the membership applications, and opens on accounts', async ({ page }) => {
  await staff(page);
  await page.evaluate(`setStaffTab('community')`);
  const pills = page.locator('#tab-community .filter-row').first().locator('.filter-pill');
  await expect(pills).toHaveText(['Accounts', 'Flagged', /^Applications/]); // the pill carries the pending count
  await expect(pills.first()).toHaveClass(/active/);
  await expect(page.locator('#tab-community')).not.toContainText('Leaderboard');
  // a device that last had the leaderboard open lands on accounts
  await page.evaluate(`S.communityTab='leaderboard';renderCommunity()`);
  await expect(pills.first()).toHaveClass(/active/);
});
