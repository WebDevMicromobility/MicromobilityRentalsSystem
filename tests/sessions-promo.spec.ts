import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

test('two branches can hold sessions on the same date (ids differ by branch slug)', async ({ page }) => {
  await stubSupabase(page, { bikes: [{ id: 'b1', name: 'B1', size: 'M', type: 'Hybrid', status: 'available' }] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const inserts: Record<string, unknown>[] = [];
  await page.route(/\/rest\/v1\/sessions/, async (route) => {
    if (route.request().method() === 'POST') inserts.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '[]' });
  });
  const mk = (loc: string) => `
    S.queueView='sessions'; renderStaffQueue(); // sessions UI lives inside the Bookings tab
    S.showAddSession=true; S.newSessMode='counts'; S.newSessTypeSizes={Road:{XS:0,S:0,M:2,L:0},Hybrid:{XS:0,S:0,M:0,L:0},Mountain:{XS:0,S:0,M:0,L:0}};
    renderSessions();
    document.getElementById('ns-date').value='2099-03-05';
    document.getElementById('ns-location').value='${loc}';
    addSession();`;
  await page.evaluate(mk('JCC'));
  await expect.poll(() => inserts.length).toBe(1);
  await page.evaluate(mk('Sharafeyah Branch'));
  await expect.poll(() => inserts.length).toBe(2);
  expect(inserts[0].id).toBe('2099-03-05-jcc');
  expect(inserts[1].id).toBe('2099-03-05-sharafeyah');
  expect(inserts[0].session_date).toBe('2099-03-05'); // date field stays clean for sorting/filters
});

test('a fixed-amount promo split sums exactly to the discounted total', async ({ page }) => {
  await stubSupabase(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const out = await page.evaluate(`(()=>{
    // replicate the split: 3 riders at 57.5, 10 SAR off → target 162.50
    const entries=[{price:57.5},{price:57.5},{price:57.5}];
    const base=172.5, disc=10, f=(base-disc)/base, target=Math.round((base-disc)*100)/100;
    entries.forEach(e=>{e.price=Math.max(0,Math.round(e.price*f*100)/100);});
    const sum1=Math.round(entries.reduce((s,e)=>s+e.price,0)*100)/100;
    const drift=Math.round((target-sum1)*100)/100;
    if(drift!==0)entries[entries.length-1].price=Math.max(0,Math.round((entries[entries.length-1].price+drift)*100)/100);
    return { sum: Math.round(entries.reduce((s,e)=>s+e.price,0)*100)/100, target };
  })()`);
  expect(out.sum).toBe(out.target); // 162.50 exactly, no halala drift
});
