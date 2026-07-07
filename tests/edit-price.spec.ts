import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The Edit Payment Amount modal must show the FULL total (rental + add-ons), list each add-on
// with steppers, and offer an "add add-ons" button.
test('edit-price modal shows the rental+add-ons total and per-add-on steppers', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, addons: JSON.stringify(['g1','w1']) }],
    inventory: [
      { id: 'g1', name: 'Energy Gel', category: 'EnergyGels', qty: 10, price: 10, low_threshold: 1 },
      { id: 'w1', name: 'Water', category: 'Drinks', qty: 10, price: 5, low_threshold: 1 },
    ],
    queue_entries: [{ id: 'q1', name: 'Sara', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09',
      queue_num: 1, status: 'active', paid: false, price: 30, registered_at: '2099-01-09T10:00:00Z',
      addons: JSON.stringify([{ id: 'g1', qty: 2 }, { id: 'w1', qty: 1 }]) }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate('showEditPriceModal("q1")');

  const html = await page.evaluate('document.getElementById("edit-price-modal").innerHTML') as string;
  // Total = rental 30 + gel 2×10 + water 1×5 = 55
  expect(html).toContain('SAR 55');
  expect(html).toContain('Energy Gel');
  expect(html).toContain('Water');
  expect(html).toContain('_epAddonStep');   // per-add-on steppers present
  expect(html).toContain('_epOpenAddons');  // add-more button present

  // Removing the single Water via a stepper drops the total to 50 and restocks it.
  await page.evaluate('_epAddonStep("q1","w1",-1)');
  const after = await page.evaluate('document.getElementById("edit-price-modal").innerHTML') as string;
  expect(after).toContain('SAR 50');
  expect(after).not.toContain('Water');
  const wStock = await page.evaluate('(S.inventory.find(i=>i.id==="w1")||{}).qty');
  expect(wStock).toBe(11); // restocked on removal
});
