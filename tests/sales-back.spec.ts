import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Drilling into a category in the Sales item picker must show a labelled Back button (with a
// back-arrow clip-art) at the start.
test('Sales picker shows a Back button with an arrow after drilling in', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    inventory: [
      { id: 'i1', name: 'Gel', brand: 'SiS', category: 'EnergyGels', qty: 5, price: 8, low_threshold: 1 },
      { id: 'i2', name: 'Water', category: 'Drinks', qty: 5, price: 3, low_threshold: 1 },
    ],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.locator('#staff-tab-nav [data-stab="cashier"]').click();

  const picker = page.locator('#tab-cashier');
  // drill in via the first category/section card in the picker
  await picker.locator('[data-cat]').first().waitFor();
  await picker.locator('[data-cat]').first().click();

  // a Back button with the arrow clip-art is now present
  const back = picker.locator('button', { hasText: 'Back' }).first();
  await expect(back).toBeVisible();
  const html = await picker.innerHTML();
  expect(html).toContain('M19 12H5M11 18l-6-6 6-6'); // back-arrow clip-art path

  // clicking Back returns toward the top level (fewer/no back buttons)
  await back.click();
  await expect(picker.locator('[data-cat]').first()).toBeVisible();
});
