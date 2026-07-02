import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff } from './helpers/supabase';

test('visiting ?staff without a PIN shows the locked PIN pad', async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/?staff');
  await expect(page.locator('.pin-title')).toHaveText('Staff Access');
  await expect(page.locator('.pin-key').first()).toBeVisible();
});

test('a wrong PIN is rejected with an error', async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/?staff');
  for (const d of ['9', '9', '9', '9']) {
    await page.locator('.pin-key', { hasText: d }).first().click();
  }
  await expect(page.locator('.pin-error')).not.toBeEmpty();
});

test.describe('unlocked staff panel', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page);
    await unlockStaff(page);
    await page.goto('/');
  });

  test('staff view loads with the staff app name', async ({ page }) => {
    await expect(page).toHaveTitle('MicroMobility Rental and Inventory System');
    await expect(page.locator('#staff-tab-nav')).toBeVisible();
  });

  test('bookings tab has the QR scan button and the scanner degrades gracefully without a camera', async ({ page }) => {
    const scanBtn = page.locator('#tab-queue button', { hasText: 'Scan ticket' });
    await expect(scanBtn).toBeVisible();
    await scanBtn.click();
    await expect(page.locator('#scan-modal .pin-title')).toHaveText('Scan booking QR');
    // headless browser grants no camera: the modal must show a clear error, not break
    await expect(page.locator('#scan-msg')).toContainText(/camera/i);
    await page.locator('#scan-modal .pin-cancel').click();
    await expect(page.locator('#scan-modal')).toBeHidden();
  });

  test('scanning a valid ticket payload opens check-in for that booking', async ({ page }) => {
    // inject a fake waiting booking and feed the scanner its QR payload directly
    await page.evaluate(`
      S.queue.push({ id: 'abc123de-0000-4000-8000-000000000001', queueNum: 7, name: 'Scan Test', status: 'waiting', sessionId: 's1', typePreference: 'Any', size: 'M', paid: false });
      _onScanPayload('MMC-7-abc123');
    `);
    await expect(page.locator('#bike-modal')).toContainText('Scan Test');
  });
});
