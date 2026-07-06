import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

// Phone normalization: every way a customer might type their number resolves to one
// clean E.164, never doubling the country code.
test('_normPhone never doubles the country code', async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/');
  const cases: [string, string][] = [
    ['562989838', '+966562989838'],
    ['0562989838', '+966562989838'],
    ['966562989838', '+966562989838'],
    ['+966562989838', '+966562989838'],
    ['00966562989838', '+966562989838'],
    ['+966 56 298 9838', '+966562989838'],
    ['056 298 9838', '+966562989838'],
  ];
  for (const [input, expected] of cases) {
    expect(await page.evaluate(`_normPhone(${JSON.stringify(input)}, '+966')`)).toBe(expected);
  }
});
