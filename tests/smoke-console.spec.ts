import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, loginCustomer, waitForSb } from './helpers/supabase';

// Whole-app smoke: load the main views and assert nothing throws to the console.
const fixtures = {
  sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, location: 'JCC', addons: null }],
  inventory: [
    { id: 'i1', name: 'Vitamin Water', category: 'Drinks', qty: 5, price: 10, low_threshold: 1 },
    { id: 'i2', name: 'Caramel Choco Bar', brand: 'Barebells', category: 'ProteinBars', qty: 2, price: 0, low_threshold: 1 },
    { id: 'i3', name: 'SiS GO Isotonic Orange', brand: 'SiS', category: 'EnergyGels', qty: 4, price: 12, low_threshold: 1 },
  ],
};

function collectErrors(page: import('@playwright/test').Page) {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  return errs;
}

test('staff panel: inventory + sales render with no console errors', async ({ page }) => {
  const errs = collectErrors(page);
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('S.inventory && S.inventory.length > 0');
  // Render inventory (both sections) and the sales tab
  await page.evaluate(() => {
    // @ts-expect-error app globals
    S.invSection = 'supplements'; renderInventory();
    // @ts-expect-error app globals
    S.invSection = 'bikes'; renderInventory();
    // @ts-expect-error app globals
    renderCashier();
  });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('customer booking + add-ons render with no console errors', async ({ page }) => {
  const errs = collectErrors(page);
  await stubSupabase(page, fixtures);
  await loginCustomer(page);
  await page.goto('/');
  await waitForSb(page);
  await page.locator('.sess-card').first().click();
  await expect(errs, errs.join('\n')).toEqual([]);
});
