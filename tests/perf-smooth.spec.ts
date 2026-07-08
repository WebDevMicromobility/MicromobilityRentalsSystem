import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

test('_debRender coalesces a burst of calls into one, and search inputs use it', async ({ page }) => {
  await stubSupabase(page, {
    inventory: [{ id: 'i1', name: 'Gel', category: 'EnergyGels', qty: 5, price: 3, low_threshold: 1 }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  // the debounce helper fires the callback ONCE after a burst
  const n = await page.evaluate(`(async()=>{
    let c=0; const f=()=>c++;
    _debRender('t',f,60); _debRender('t',f,60); _debRender('t',f,60);
    await new Promise(r=>setTimeout(r,120));
    return c;
  })()`) as number;
  expect(n).toBe(1); // 3 rapid calls -> one render
});

test('font + scroll perf changes render without console errors', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    queue_entries: [{ id: 'q1', name: 'Sara', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:00:00Z' }],
  });
  await unlockStaff(page);
  await page.goto('/?staff');
  await waitForSb(page);
  await page.evaluate('renderStaffQueue()');
  // font preload present in the head
  expect(await page.evaluate(`!!document.querySelector('link[rel="preload"][as="font"]')`)).toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});
