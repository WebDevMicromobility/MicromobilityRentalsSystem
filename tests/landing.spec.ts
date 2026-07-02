import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

test.beforeEach(async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/');
});

test('landing page renders with the customer app name', async ({ page }) => {
  await expect(page).toHaveTitle('MicroMobility Rentals');
  await expect(page.locator('#land-main-title')).toContainText('Reserve Your');
  await expect(page.locator('#land-sub')).toHaveText('Bicycle rentals - Jeddah Corniche Circuit');
});

test('shows the no-sessions message when nothing is bookable', async ({ page }) => {
  await expect(page.locator('#land-avail-strip')).toContainText('No sessions are currently open');
});

test('arabic toggle flips direction and translates the landing page', async ({ page }) => {
  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#land-sub')).toHaveText('تأجير الدراجات - حلبة كورنيش جدة');
  await expect(page.locator('#footer-copy')).toContainText('جميع الحقوق محفوظة');
  // and back
  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('language choice survives a reload', async ({ page }) => {
  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#land-sub')).toHaveText('تأجير الدراجات - حلبة كورنيش جدة');
});
