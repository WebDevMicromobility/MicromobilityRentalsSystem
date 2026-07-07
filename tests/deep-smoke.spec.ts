import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, loginCustomer, waitForSb } from './helpers/supabase';

const fixtures = {
  sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, location: 'JCC', addons: JSON.stringify(['i2']) }],
  inventory: [
    { id: 'i1', name: 'Helmet', category: 'Helmet', qty: 0, price: 40, low_threshold: 1 },
    { id: 'i2', name: 'Gel', brand: 'SiS', category: 'EnergyGels', qty: 3, price: 0, low_threshold: 5 },
    { id: 'i3', name: 'Cookie', brand: 'Quest', category: 'ProteinCookies', qty: 2, price: 8, low_threshold: 1, cost: 4 },
  ],
  queue_entries: [
    { id: 'q1', name: 'Sara', phone: '0561111111', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'done', paid: true, price: 30, customer_id: 'c1', registered_at: '2099-01-09T10:00:00Z', addons: JSON.stringify([{ id: 'i2', qty: 1 }]) },
    { id: 'q2', name: 'Omar', phone: '0562222222', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 2, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:05:00Z' },
    { id: 'q3', name: '', phone: '', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 3, status: 'noshow', paid: false, price: 30, registered_at: '2099-01-09T10:06:00Z' },
  ],
  cashier_sales: [{ id: 'cs1', receipt_id: 'r1', session_id: 's1', name: 'Cookie', item_id: 'i3', category: 'ProteinCookies', qty: 1, price: 8, pay: 'paid', created_at: '2099-01-09T11:00:00Z' }],
};

for (const lang of ['en', 'ar']) {
  test(`every staff tab renders in ${lang} with zero console errors`, async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await stubSupabase(page, fixtures);
    await unlockStaff(page);
    await page.addInitScript((l) => localStorage.setItem('cq_lang', l), lang);
    await page.goto('/?staff');
    await waitForSb(page);
    await page.evaluate(`
      for (const tab of ['queue','inventory','cashier','community','analytics','history']) setStaffTab(tab);
      S.queueView='sessions'; renderStaffQueue(); S.queueView='bookings';
      for (const v of ['overview','revenue','ridership','operations','fleet','customers','growth']) setAnView(v);
      showEditPriceModal('q1'); closeEditPriceModal();
      showAddonPicker('q2'); closeAddonPicker();
    `);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`customer views render in ${lang} with zero console errors`, async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await stubSupabase(page, fixtures);
    await loginCustomer(page, { id: 'c1' });
    await page.addInitScript((l) => localStorage.setItem('cq_lang', l), lang);
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`
      setCustTab('register'); setCustTab('myrides'); setCustTab('account');
      setCustTab('register');
    `);
    await page.locator('.sess-card').first().click();
    expect(errs, errs.join('\n')).toEqual([]);
  });
}
