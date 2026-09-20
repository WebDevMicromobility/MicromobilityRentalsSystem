import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Regression (found by the chaos monkey): editing a bike with no colors array crashed startEdit.
test('editing a bike with no colors array does not crash', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await stubSupabase(page, {
    bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 }], // no colors/color_names
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`startEdit('b1')`);
  expect(errs, errs.join('\n')).toEqual([]);
  expect(await page.evaluate('Array.isArray(S.addBikeColorNames) && S.addBikeColorNames.length')).toBe(1);
});

// The bike number is what the sticker on the frame says, and the NFC tag opens
// micromobility.sa/b/<number>. Handing that number to another bike silently repoints a
// sticker that is already stuck on this one, so saveBikeEdit must stop and ask first.
//
// Two notes on the shape of these tests. The Supabase stub echoes writes back without
// storing them, so what is asserted is the PATCH that leaves the page, not the row after it.
// And #confirm-modal is a block wrapping a position:fixed backdrop, so its own bounding box
// is empty and toBeVisible() rejects it — the box inside is what a person actually sees.
const BIKE = {
  id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available',
  colors: ['#03ff89'], color_names: [''], frame_type: 'Aluminum', bike_number: 7,
};
const openEditor = `setStaffTab('inventory');S.invSection='bikes';renderInventory();startEdit('b1');renderBikes()`;

/** Every PATCH sent to the bikes table, as parsed bodies. */
function recordBikeWrites(page: import('@playwright/test').Page) {
  const writes: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && /\/rest\/v1\/bikes/.test(r.url())) {
      try { writes.push(JSON.parse(r.postData() || '{}')); } catch { /* not json */ }
    }
  });
  return writes;
}

// saveBikeEdit() does not settle until the operator answers, so its promise is held and
// awaited rather than dangled — an unawaited one rejects at teardown and fails the test for
// a reason that has nothing to do with the behaviour under test.
test('cancelling a number change writes nothing', async ({ page }) => {
  await stubSupabase(page, { bikes: [BIKE] });
  const writes = recordBikeWrites(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(openEditor);

  await page.evaluate(`document.getElementById('bk-number').value='8';S._bkNumber='8'`);
  const saving = page.evaluate(`saveBikeEdit()`).catch(() => {});
  await expect(page.locator('#confirm-modal .confirm-box')).toBeVisible();
  await page.evaluate(`closeConfirm()`);
  await saving;
  expect(writes).toEqual([]);
});

test('confirming a number change sends the new number', async ({ page }) => {
  await stubSupabase(page, { bikes: [BIKE] });
  const writes = recordBikeWrites(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(openEditor);

  await page.evaluate(`document.getElementById('bk-number').value='8';S._bkNumber='8'`);
  const saving = page.evaluate(`saveBikeEdit()`).catch(() => {});
  await expect(page.locator('#confirm-modal .confirm-box')).toBeVisible();
  await page.locator('#confirm-modal button.btn-red').click();
  await saving;
  await expect.poll(() => writes.find((w) => 'bike_number' in w)?.bike_number).toBe(8);
});

test('the prompt names the old number and the new one', async ({ page }) => {
  await stubSupabase(page, { bikes: [BIKE] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(openEditor);
  await page.evaluate(`document.getElementById('bk-number').value='8';S._bkNumber='8'`);
  const saving = page.evaluate(`saveBikeEdit()`).catch(() => {});

  const box = page.locator('#confirm-modal .confirm-box');
  await expect(box).toBeVisible();
  // Both numbers have to be in the sentence, or it cannot be acted on.
  await expect(box).toContainText('7');
  await expect(box).toContainText('8');
  await page.evaluate(`closeConfirm()`);
  await saving;
});

// Every other edit must stay a single click - the prompt is for the number alone.
test('editing a bike without touching its number does not prompt', async ({ page }) => {
  await stubSupabase(page, { bikes: [BIKE] });
  const writes = recordBikeWrites(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(openEditor);

  await page.evaluate(`document.getElementById('bk-size').value='L'`);
  await page.evaluate(`saveBikeEdit()`);
  await expect.poll(() => writes.find((w) => 'size' in w)?.size).toBe('L');
  expect(await page.evaluate(`document.getElementById('confirm-modal').style.display`)).not.toBe('block');
});

// A retired bike is kept so the bookings that went out on it still name it — the whole fleet
// was retired rather than deleted on 2026-09-15 for exactly that reason. It is not part of
// the fleet any more, so it must not be counted as one: the "Total" card is the number staff
// read as "how many bikes do we have", and the retired block below has its own count.
test('the fleet total counts the fleet, not its history', async ({ page }) => {
  await stubSupabase(page, {
    bikes: [
      { id: 'a1', name: 'A1', size: 'M', type: 'Road', status: 'available' },
      { id: 'a2', name: 'A2', size: 'M', type: 'Road', status: 'available' },
      { id: 'm1', name: 'M1', size: 'M', type: 'Hybrid', status: 'maintenance' },
      { id: 'r1', name: 'R1', size: 'M', type: 'Road', status: 'retired', retired_date: '2026-09-15' },
      { id: 'r2', name: 'R2', size: 'S', type: 'Hybrid', status: 'retired', retired_date: '2026-09-15' },
    ],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('inventory');S.invSection='bikes';S.bkStatus='all';renderInventory();renderBikes()`);
  const nums = await page.locator('#tab-bikes .stat-card .stat-num').allTextContents();
  // total, available, in use, maintenance — a bike in for maintenance is still ours
  expect(nums.slice(0, 4)).toEqual(['3', '2', '0', '1']);
  // the two retired ones are still loaded, so an old booking can still name them
  expect(await page.evaluate(`getBikes().length`)).toBe(5);
  expect(await page.evaluate(`(bikeById('r1')||{}).name`)).toBe('R1');
});

// A fleet numbered in a high block (9001, 9002, ...) used to be told the next bike was
// number 1, because the suggestion counted up from 1 and stopped at the first free number.
// The first bike added at the desk would then fall out of the block and read "0001" on a
// screen where every other bike reads 90xx. It now counts from where the fleet starts.
test('the suggested bike number follows the fleet, and still fills its gaps', async ({ page }) => {
  await stubSupabase(page, {
    bikes: [9001, 9002, 9004].map((n) => ({
      id: `b${n}`, name: `B${n}`, size: 'M', type: 'Road', status: 'available',
      colors: ['#03ff89'], color_names: [''], bike_number: n,
    })),
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  // 9003 is missing from the block, so that is the one going spare
  expect(await page.evaluate(`_nextBikeNumber()`)).toBe(9003);
  // with the gap filled, the next one continues the block instead of dropping to 1
  await page.evaluate(`S.bikes.push({id:'b9003',name:'B9003',size:'M',type:'Road',status:'available',colors:[],color_names:[],bike_number:9003})`);
  expect(await page.evaluate(`_nextBikeNumber()`)).toBe(9005);
});

test('an empty fleet still starts at one', async ({ page }) => {
  await stubSupabase(page, { bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  expect(await page.evaluate(`_nextBikeNumber()`)).toBe(1);
});
