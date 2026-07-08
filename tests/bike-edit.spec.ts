import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Regression (found by the chaos monkey): editing a bike with no colors array crashed startEdit.
test('editing a bike with no colors array does not crash', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await stubSupabase(page, {
    bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }], // no colors/color_names
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`startEdit('b1')`);
  expect(errs, errs.join('\n')).toEqual([]);
  expect(await page.evaluate('Array.isArray(S.addBikeColorNames) && S.addBikeColorNames.length')).toBe(1);
});
