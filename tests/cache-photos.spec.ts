import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The snapshot must keep small Storage-URL photos (so they show instantly from cache) but drop
// heavy base64 data: URIs. This is what makes add-on/inventory photos not blank on a cold load.
test('cache keeps URL photos but strips heavy base64', async ({ page }) => {
  await stubSupabase(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const snap = await page.evaluate(() => {
    // @ts-expect-error app globals
    S.inventory = [
      { id: 'u1', name: 'URL item', photo: 'https://x.supabase.co/storage/v1/object/public/photos/a.jpg' },
      { id: 'b1', name: 'B64 item', photo: 'data:image/png;base64,AAAABBBBCCCC' },
    ];
    // @ts-expect-error app globals
    S.bikes = []; S.sessions = []; S.cashSales = [];
    // @ts-expect-error app globals
    _cacheSave();
    return JSON.parse(localStorage.getItem('cq_snapshot') || '{}');
  });
  const inv = snap.inv as Array<{ id: string; photo?: string }>;
  const url = inv.find((i) => i.id === 'u1');
  const b64 = inv.find((i) => i.id === 'b1');
  expect(url!.photo).toContain('storage/v1/object'); // URL kept
  expect(b64!.photo).toBeUndefined();                // base64 dropped
});
