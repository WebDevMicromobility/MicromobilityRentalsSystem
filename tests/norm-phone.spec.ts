import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

// Phone normalization is country-agnostic: it uses the SELECTED country code and never
// doubles it, whatever format the customer types.
test('_normPhone never doubles the country code (any country)', async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/');
  const cases: [string, string, string][] = [
    // input, country code, expected
    ['562989838', '+966', '+966562989838'],
    ['0562989838', '+966', '+966562989838'],
    ['966562989838', '+966', '+966562989838'],
    ['+966562989838', '+966', '+966562989838'],
    ['00966562989838', '+966', '+966562989838'],
    ['501234567', '+971', '+971501234567'],      // UAE
    ['+971501234567', '+971', '+971501234567'],
    ['00971501234567', '+971', '+971501234567'],
    ['5551234567', '+1', '+15551234567'],         // US
    ['15551234567', '+1', '+15551234567'],
    ['07911123456', '+44', '+447911123456'],      // UK (trunk 0)
    ['+447911123456', '+44', '+447911123456'],
  ];
  for (const [input, cc, expected] of cases) {
    expect(await page.evaluate(`_normPhone(${JSON.stringify(input)}, ${JSON.stringify(cc)})`)).toBe(expected);
  }
});
