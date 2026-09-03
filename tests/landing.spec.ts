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

// With Spanish gone there are two languages, so the header control is a switch rather than a
// menu: one tap, and the label names the language it takes you TO.
test('the language button switches to arabic and back', async ({ page }) => {
  await expect(page.locator('#lang-btn')).toContainText('عربي');   // says where it goes
  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#land-sub')).toHaveText('تأجير الدراجات وجولات مجتمعية في جدة');
  await expect(page.locator('#footer-copy')).toContainText('جميع الحقوق محفوظة');
  await expect(page.locator('#lang-btn')).toContainText('ENG');    // and now it offers the way back
  // and back to english, in one tap rather than two
  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#land-sub')).toContainText('Bicycle rentals');
});

test('it opens no menu — the tap is the whole interaction', async ({ page }) => {
  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.pay-menu-popup')).toHaveCount(0);
});

test('language choice survives a reload', async ({ page }) => {
  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#land-sub')).toHaveText('تأجير الدراجات وجولات مجتمعية في جدة');
});
