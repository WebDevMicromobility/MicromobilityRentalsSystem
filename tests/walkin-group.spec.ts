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

// customers.default_pay = 'house': any new booking created for that person starts on the
// house (paid, SAR 0). Matched by account AND name, so other riders still pay normally.
test('a customer with default payment "on the house" books as paid with price 0', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const customers = [{ id: 'c1', name: 'House Rider', email: 'h@x.com', phone: '0500000001', height: 175, default_pay: 'house' }];
  await stubSupabase(page, { sessions, customers });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    showWalkinModal();
  });

  const posts: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) {
      const sent = r.postDataJSON();
      posts.push(...(Array.isArray(sent) ? sent : [sent]));
    }
  });
  const modal = page.locator('#walkin-modal');
  await modal.locator('#wi-name').fill('House Rider'); // matches the saved customer
  await modal.getByRole('button', { name: /Walk/i }).last().click();
  await expect(modal).toBeHidden();

  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].customer_id).toBe('c1');
  expect(posts[0].paid).toBe(true); // default payment applied
  expect(posts[0].price).toBe(0);
});

// default_pay can be limited to specific bike types: 'house:Road' rides free on a Road
// bike but pays normally on any other type.
test('type-restricted "on the house" only applies to the listed bike types', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const customers = [{ id: 'c2', name: 'Road Only', email: 'r@x.com', phone: '0500000002', height: 175, default_pay: 'house:Road' }];
  await stubSupabase(page, { sessions, customers });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const posts: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) {
      const sent = r.postDataJSON();
      posts.push(...(Array.isArray(sent) ? sent : [sent]));
    }
  });

  const modal = page.locator('#walkin-modal');
  const walkIn = async (type: string) => {
    await page.evaluate(() => {
      // @ts-expect-error app globals
      showWalkinModal();
    });
    await modal.locator('#wi-name').fill('Road Only');
    await modal.getByRole('button', { name: type, exact: true }).click();
    await modal.getByRole('button', { name: /Walk/i }).last().click();
    await expect(modal).toBeHidden();
  };

  await walkIn('Road'); // covered type -> free
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].paid).toBe(true);
  expect(posts[0].price).toBe(0);

  await walkIn('Mountain'); // uncovered type -> normal payment
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].paid).toBe(false);
  expect(posts[1].price as number).toBeGreaterThan(0);
});
