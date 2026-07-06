import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The built-in nutrition library (_libNutri) attaches facts to known products by name/brand,
// with no per-item DB writes. Humantra electrolyte sticks share one label across every flavour.

test.describe('nutrition library', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page);
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
  });

  test('every Humantra product resolves the same electrolyte label without stored nutrition', async ({ page }) => {
    const out = await page.evaluate(() => {
      const items = [
        { id: 'h1', name: 'Humantra Lemon',      brand: 'Humantra', flavour: 'Lemon' },
        { id: 'h2', name: 'Mango Passion',        brand: 'Humantra', flavour: 'Mango' },
        { id: 'h3', name: 'Watermelon sachet',    brand: 'humantra', flavour: '' },
      ];
      // @ts-expect-error app globals
      const nus = items.map((it) => _itemNutri(it));
      // @ts-expect-error app globals
      const hasAll = items.every((it) => _hasNutri(it));
      const first = nus[0];
      return {
        hasAll,
        allSame: nus.every((n) => JSON.stringify(n) === JSON.stringify(first)),
        kcal: first.kcal,
        carbs: first.carbs_g,
        serving: first.serving,
        microCount: first.micros.length,
        b12: first.micros.find((m: { n: string }) => m.n === 'Vitamin B12'),
        sodium: first.micros.find((m: { n: string }) => m.n === 'Sodium'),
      };
    });

    expect(out.hasAll).toBe(true);
    expect(out.allSame).toBe(true);
    expect(out.kcal).toBe(5);
    expect(out.carbs).toBe('<1');
    expect(out.serving).toContain('3.6');
    expect(out.microCount).toBe(10);
    expect(out.b12).toMatchObject({ a: '100', u: 'µg', nrv: '4167' });
    expect(out.sodium).toMatchObject({ a: '180', u: 'mg', nrv: '8' });
  });

  test('VOSS water resolves its zero-calorie low-mineral label', async ({ page }) => {
    const out = await page.evaluate(() => {
      const it = { id: 'v1', name: 'VOSS Water 250ml', brand: 'Voss' };
      // @ts-expect-error app globals
      const n = _itemNutri(it);
      return { kcal: n.kcal, serving: n.serving, microCount: n.micros.length, ca: n.micros.find((m: { n: string }) => m.n === 'Calcium') };
    });
    expect(out.kcal).toBe(0);
    expect(out.serving).toContain('250');
    expect(out.microCount).toBe(4);
    expect(out.ca).toMatchObject({ u: 'mg' });
  });

  test('a saved nutrition object still wins over the library', async ({ page }) => {
    const kcal = await page.evaluate(() =>
      // @ts-expect-error app globals
      _itemNutri({ name: 'Humantra Lemon', brand: 'Humantra', nutrition: { kcal: 42 } }).kcal,
    );
    expect(kcal).toBe(42);
  });
});
