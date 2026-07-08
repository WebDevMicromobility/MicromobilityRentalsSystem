import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

test('scroll helper honors reduced-motion (auto), else smooth', async ({ page }) => {
  await stubSupabase(page);
  await unlockStaff(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await waitForSb(page);
  expect(await page.evaluate('_sb()')).toBe('auto');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await page.evaluate('_sb()')).toBe('smooth');
});

test('the Sales cart puts the total + Record button in a sticky action bar', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    inventory: [{ id: 'i1', name: 'Gel', category: 'EnergyGels', qty: 5, price: 8, low_threshold: 1 }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.locator('#staff-tab-nav [data-stab="cashier"]').click();
  // put an item in the cart so the footer renders
  await page.evaluate(`S._ctSession='s1'; S._ctCart=[{item_id:'i1',name:'Gel',cat:'EnergyGels',qty:1,price:8,pay:'paid'}]; renderCashier();`);
  const foot = page.locator('#tab-cashier .mm-cart-foot');
  await expect(foot).toBeVisible();
  await expect(foot.locator('#ct-grand')).toBeVisible();          // total is in the bar
  await expect(foot.locator('button', { hasText: /Record/ })).toBeVisible(); // so is the Record button
});
