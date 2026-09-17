import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A tap on a report builder row used to rebuild the whole dialog: it jumped back to the top,
// replayed its entrance and dropped focus, which read as the builder "refreshing". Now a tap
// repaints its own row and a filter pick updates only what depends on it.

const D = '2099-02-08';
const sessions = [{ id: 's0', day: 'Sunday', session_date: D, capacity: 9, status: 'open', created_at: 1, bike_slots: JSON.stringify({ _time: '21:00 - 23:00', _total: 9 }), location: 'JCC', addons: null }];
const queue_entries = [{ id: 'e1', session_id: 's0', session_day: 'Sunday', session_date: D, queue_num: 1, name: 'Spec Rider', phone: '0500000001', customer_id: 'c1', type_preference: 'Hybrid', status: 'waiting', paid: false, price: 60, registered_at: '2099-01-01T10:00:00Z' }];
const customers = [
  { id: 'c1', name: 'Amal Member', email: 'amal@example.test', phone: '+966500000001', gender: 'female', created_at: '2026-08-20T10:00:00Z' },
  { id: 'c2', name: 'Bader Lapsed', email: 'bader@example.test', phone: '+966500000002', gender: 'male', created_at: '2025-01-05T10:00:00Z' },
];

async function boot(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, queue_entries, customers });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
}
const probe = (page: import('@playwright/test').Page) => page.evaluate(() => { document.querySelector('#print-opts-modal .modal-box')!.setAttribute('data-probe', 'same'); });

test('session report builder: a tap flips its row and a filter pick is kept, the dialog is never rebuilt', async ({ page }) => {
  await boot(page);
  await page.evaluate(`showPrintReportOptions()`);
  const box = page.locator('#print-opts-modal .modal-box');
  await expect(box).toBeVisible();
  await probe(page);
  const row = box.locator('[data-rep="cols:phone"]');
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  await expect(box).toHaveAttribute('data-probe', 'same'); // the same dialog, not a rebuilt one
  await page.selectOption('#print-opts-modal select:has(option[value="Hybrid"])', 'Hybrid');
  await expect(box).toHaveAttribute('data-probe', 'same');
  expect(await page.evaluate(`_repOpts().fType`)).toBe('Hybrid');
  expect(await page.evaluate(`_repOpts().cols.phone`)).toBe(1);
  // Reopened, the dialog shows what was picked.
  await page.evaluate(`_closePrintOpts();showPrintReportOptions()`);
  await expect(page.locator('#print-opts-modal [data-rep="cols:phone"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#print-opts-modal select:has(option[value="Hybrid"])')).toHaveValue('Hybrid');
});

test('account report builder: a filter pick updates the count in place, a chart switch enables its type picker', async ({ page }) => {
  await boot(page);
  await page.evaluate(`showAccountReportOptions()`);
  const box = page.locator('#print-opts-modal .modal-box');
  await expect(box).toBeVisible();
  await probe(page);
  await expect(page.locator('#acr-count')).toContainText('2 / 2');
  await page.selectOption('#print-opts-modal select[aria-label="Gender"]', 'male');
  await expect(page.locator('#acr-count')).toContainText('1 / 2');
  await expect(box).toHaveAttribute('data-probe', 'same');

  const chart = box.locator('[data-rep^="chartsOn:"]').first();
  const picker = chart.locator('xpath=following-sibling::select');
  const wasOn = (await chart.getAttribute('aria-pressed')) === 'true';
  await chart.click();
  await expect(chart).toHaveAttribute('aria-pressed', wasOn ? 'false' : 'true');
  if (wasOn) await expect(picker).toBeDisabled(); else await expect(picker).toBeEnabled();
  await expect(box).toHaveAttribute('data-probe', 'same');
});
