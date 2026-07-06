import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

// Backstop for the "undefined" flash: esc() must never emit the literal strings
// "undefined"/"null" when a field is missing (it renders empty instead).

test('esc() renders null/undefined as empty, not the literal text', async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/');
  expect(await page.evaluate(`esc(undefined)`)).toBe('');
  expect(await page.evaluate(`esc(null)`)).toBe('');
  expect(await page.evaluate(`esc('')`)).toBe('');
  // normal values + escaping still work
  expect(await page.evaluate(`esc('Ali & <b>x</b>')`)).toBe('Ali &amp; &lt;b&gt;x&lt;/b&gt;');
});
