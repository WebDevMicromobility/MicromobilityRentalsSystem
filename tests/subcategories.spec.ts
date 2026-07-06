import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Protein Snacks is a parent group split into Cookies / Gummies / Muffins sub-categories.
// The Sales item picker must nest them: one "Protein Snacks" card at the top level that
// drills into the three sub-category cards, then into the items.

const fixtures = {
  sessions: [{
    id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12,
    status: 'open', created_at: 1, bike_slots: null, location: 'JCC', addons: null,
  }],
  inventory: [
    { id: 'ck1', name: 'Choc Cookie',  category: 'ProteinCookies', qty: 5, price: 8, low_threshold: 1 },
    { id: 'gm1', name: 'Berry Gummy',  category: 'ProteinGummies', qty: 5, price: 6, low_threshold: 1 },
    { id: 'mf1', name: 'Banana Muffin', category: 'ProteinMuffins', qty: 5, price: 9, low_threshold: 1 },
    { id: 'dr1', name: 'Vitamin Water', category: 'Drinks',        qty: 5, price: 10, low_threshold: 1 },
  ],
};

// Set the drill state, re-render the Sales tab, and return the picker's [data-cat] cards.
async function pickerCards(page: import('@playwright/test').Page, pick: string) {
  return page.evaluate((p) => {
    // @ts-expect-error app globals
    S._ctPickCat = p; renderCashier();
    return [...document.querySelectorAll('#tab-cashier [data-cat]')].map((b) => ({
      cat: (b as HTMLElement).dataset.cat, text: (b.textContent || '').replace(/\s+/g, ' ').trim(),
    }));
  }, pick);
}

test.describe('protein sub-categories', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page, fixtures);
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
  });

  test('the three protein subs collapse into one parent card that drills down', async ({ page }) => {
    // Top level: one Protein Snacks group card (3 items), Drinks stands alone, no raw sub cards.
    const top = await pickerCards(page, '');
    const cats = top.map((c) => c.cat);
    expect(cats).toContain('__grp__ProteinSnacks');
    expect(cats).toContain('Drinks');
    expect(cats).not.toContain('ProteinCookies');
    const grp = top.find((c) => c.cat === '__grp__ProteinSnacks')!;
    expect(grp.text).toContain('Protein Snacks');
    expect(grp.text).toContain('3 items');

    // Drill into the group: the three sub-category cards, each with one item.
    const subs = await pickerCards(page, '__grp__ProteinSnacks');
    const subCats = subs.map((c) => c.cat);
    expect(subCats).toEqual(expect.arrayContaining(['ProteinCookies', 'ProteinGummies', 'ProteinMuffins']));
    expect(subCats).not.toContain('__grp__ProteinSnacks');

    // Drill into a sub-category: its item is listed.
    await pickerCards(page, 'ProteinCookies');
    await expect(page.locator('#tab-cashier')).toContainText('Choc Cookie');
  });
});
