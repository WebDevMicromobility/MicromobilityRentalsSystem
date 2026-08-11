import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Walk-in modal: extra rider rows book several walk-ups at once. Unnamed extras ride under
// the first name ("Tamer 2"), and 2+ riders share a group_id so the roster groups them.
test('walk-in modal books multiple riders as one group', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  await stubSupabase(page, { sessions });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    showWalkinModal();
  });

  const modal = page.locator('#walkin-modal');
  await modal.locator('#wi-name').fill('Tamer');
  await modal.locator('#wi-height').fill('180');
  await modal.getByRole('button', { name: /\+ Add rider/ }).click();
  await expect(modal.locator('#wi-r-name-0')).toBeVisible(); // second rider row, left unnamed

  const posts: Record<string, unknown>[][] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) {
      const sent = r.postDataJSON();
      posts.push(Array.isArray(sent) ? sent : [sent]);
    }
  });
  await modal.getByRole('button', { name: /\(2\)/ }).click();
  await expect(modal).toBeHidden();

  expect(posts).toHaveLength(1);
  const rows = posts[0];
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => r.name)).toEqual(['Tamer', 'Tamer 2']);
  expect(rows[0].group_id).toBeTruthy();
  expect(rows[0].group_id).toBe(rows[1].group_id); // grouped on the roster
  expect(rows.every((r) => r.walk_in === true && r.session_id === 's0' && r.status === 'waiting')).toBe(true);
});
