import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

test.beforeEach(async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/');
});

test('landing page renders with the customer app name', async ({ page }) => {
  await expect(page).toHaveTitle('MicroMobility Rentals');
  await expect(page.locator('#land-main-title')).toContainText('Reserve Your');
  await expect(page.locator('#land-sub')).toHaveText('Bicycle rentals & community rides in Jeddah');
});

test('shows the no-sessions message when nothing is bookable', async ({ page }) => {
  await expect(page.locator('#land-avail-strip')).toContainText('No sessions are currently open');
});

test('language dropdown switches to arabic and back', async ({ page }) => {
  await page.locator('#lang-btn').click();
  // Two languages now — Spanish was dropped from the product.
  await expect(page.locator('.pay-menu-popup')).not.toContainText('Español');
  await expect(page.locator('.pay-menu-popup button')).toHaveCount(2);
  await page.locator('.pay-menu-popup button', { hasText: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#land-sub')).toHaveText('تأجير الدراجات وجولات مجتمعية في جدة');
  await expect(page.locator('#footer-copy')).toContainText('جميع الحقوق محفوظة');
  // and back to english
  await page.locator('#lang-btn').click();
  await page.locator('.pay-menu-popup button', { hasText: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#land-sub')).toContainText('Bicycle rentals');
});

test('language choice survives a reload', async ({ page }) => {
  await page.locator('#lang-btn').click();
  await page.locator('.pay-menu-popup button', { hasText: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#land-sub')).toHaveText('تأجير الدراجات وجولات مجتمعية في جدة');
});
