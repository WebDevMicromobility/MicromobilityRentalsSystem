import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Escape on stacked dialogs, the staff section a reload returns to, and the silent reload that
// ships a new build when the app is put away.
const SID = '2099-02-10';
const sessions = [{ id: SID, day: 'Friday', session_date: SID, capacity: 12, status: 'open', created_at: 1 }];
const queue = [{ id: 'e1', session_id: SID, session_day: 'Friday', session_date: SID, queue_num: 1, name: 'First', phone: '', status: 'active', paid: true, price: 30, type_preference: 'Road', size: 'M', registered_at: '2099-01-01T10:00:00Z' }];

test('Escape closes only the top dialog of a stack', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: queue });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate("showCashierModal('e1')");
  await expect(page.locator('#cashier-modal .modal-backdrop')).toBeVisible();
  // The team manager opens from inside the sale window.
  await page.evaluate('showTeamManager()');
  await expect(page.locator('#team-mgr-modal .modal-backdrop')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#team-mgr-modal .modal-backdrop')).toBeHidden();
  await expect(page.locator('#cashier-modal .modal-backdrop')).toBeVisible();
  // A prompt's own field uses Escape to cancel the prompt; the sale window stays too.
  await page.evaluate("window.__v='x'; promptDialog({title:'Note',value:'a'}).then(v=>{window.__v=v;}); 0"); // not awaited: it resolves on Escape
  const input = page.locator('#confirm-modal input');
  await input.focus();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate('window.__v')).toBeNull();
  await expect(page.locator('#cashier-modal .modal-backdrop')).toBeVisible();
  // With nothing above it, Escape closes the sale window itself.
  await page.keyboard.press('Escape');
  await expect(page.locator('#cashier-modal .modal-backdrop')).toBeHidden();
});

for (const snapshot of [false, true]) {
  // Riders is the Petromin page inside Queue now (7d0c58a): a reload there comes back to that page.
  test(`a reload on Riders comes back to the Petromin page${snapshot ? ' (snapshot painted first)' : ''}`, async ({ page }) => {
    await stubSupabase(page, { sessions, queue_entries: queue });
    await unlockStaff(page);
    await page.addInitScript((snap) => {
      sessionStorage.setItem('cq_nav_stab', 'riders');
      if (snap) localStorage.setItem('cq_snapshot', JSON.stringify({ q: [], ses: [], bk: [], inv: [], cs: [] }));
    }, snapshot);
    await page.goto('/');
    await waitForSb(page);
    await expect.poll(() => page.evaluate('S.staffTab+":"+S.queueView')).toBe('queue:petromin');
  });
}

test('a remembered legacy "logs" section opens History instead of failing the staff boot', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: queue });
  await unlockStaff(page);
  await page.addInitScript(() => sessionStorage.setItem('cq_nav_stab', 'logs'));
  await page.goto('/');
  await waitForSb(page);
  await expect.poll(() => page.evaluate('S.view')).toBe('staff');
  expect(await page.evaluate('[S.staffTab,S.histView]')).toEqual(['history', 'log']);
});

test('a new build waits for a hide with no work in hand before it reloads', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: queue });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  test.skip(!(await page.evaluate("'serviceWorker' in navigator")), 'no service worker container in this browser setup');
  const hide = () => page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    // @ts-expect-error test cleanup of the override
    delete document.hidden;
  });
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pointerdown')); // a person is using the page: no instant reload
    navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'shell-updated' } }));
    // @ts-expect-error marker that a reload would wipe
    window.__marker = 1;
  });
  await expect(page.locator('#upd-bar')).toBeVisible();
  // A sale window is open: going to the background (a photo picker, WhatsApp) must not reload.
  await page.evaluate("showCashierModal('e1')");
  await hide();
  await page.waitForTimeout(300);
  expect(await page.evaluate('window.__marker')).toBe(1);
  // Nothing in hand: the next hide ships the new build.
  await page.evaluate('closeCashierModal()');
  const nav = page.waitForEvent('framenavigated');
  await hide();
  await nav;
  await waitForSb(page);
  expect(await page.evaluate('window.__marker')).toBeUndefined();
});
