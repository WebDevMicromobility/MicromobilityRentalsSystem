import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

// Staff self-service password change: the modal validates before ever calling Supabase,
// so weak or mismatched entries are rejected locally.

test('change-password modal rejects weak and mismatched passwords', async ({ page }) => {
  await stubSupabase(page);
  await page.addInitScript(() => localStorage.setItem('cq_secure_auth', '1')); // after stub, which pins '0'
  await page.goto('/');
  await page.evaluate(`S._staffAuthed = true; openStaffPwdModal();`);
  await expect(page.locator('#staff-pwd-modal')).toBeVisible();

  // too weak (no uppercase/number, < 8)
  await page.evaluate(`document.getElementById('staff-newpwd').value='weak'; document.getElementById('staff-newpwd2').value='weak';`);
  await page.locator('#staff-pwd-modal .btn-primary').click();
  await expect(page.locator('#staff-pwd-err')).not.toHaveText('');

  // strong but mismatched
  await page.evaluate(`document.getElementById('staff-newpwd').value='Strong1Pass'; document.getElementById('staff-newpwd2').value='Different1Pass';`);
  await page.locator('#staff-pwd-modal .btn-primary').click();
  await expect(page.locator('#staff-pwd-err')).toHaveText('Passwords do not match.');
});
