import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

// Staff can sign in with email OR phone; _staffPhoneE164 normalizes a raw phone entry
// to E.164 (Saudi default) so it matches the phone stored on the Supabase Auth account.

test('_staffPhoneE164 normalizes Saudi phone formats to E.164', async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/');
  const cases: [string, string][] = [
    ['0566668818', '+966566668818'],   // national leading-0
    ['566668818', '+966566668818'],    // bare 9-digit mobile
    ['+966566668818', '+966566668818'],// already E.164
    ['966566668818', '+966566668818'], // country code, no +
    ['00966566668818', '+966566668818'],// international 00 prefix
    ['+966 56 666 8818', '+966566668818'], // spaces stripped
  ];
  for (const [input, expected] of cases) {
    expect(await page.evaluate(`_staffPhoneE164(${JSON.stringify(input)})`)).toBe(expected);
  }
});
