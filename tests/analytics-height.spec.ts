import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

const fixtures = {
  sessions: [
    { id: 'sA', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1, location: 'JCC' },
    { id: 'sB', day: 'Saturday', session_date: '2099-01-10', capacity: 12, status: 'open', created_at: 2, location: 'JCC' },
  ],
  bikes: [
    { id: 'r1', name: 'Road 1', size: 'M', type: 'Road', status: 'available', rental_price: 75 },
    { id: 'h1', name: 'Hybrid 1', size: 'M', type: 'Hybrid', status: 'available', rental_price: 57.5 },
  ],
  queue_entries: [
    { id: 'a1', name: 'Tall Rider', height: 185, session_id: 'sA', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'done', paid: true, price: 75, assigned_bike_id: 'r1', registered_at: '2099-01-09T10:00:00Z' },
    { id: 'a2', name: 'Short Rider', height: 158, session_id: 'sA', session_day: 'Friday', session_date: '2099-01-09', queue_num: 2, status: 'done', paid: true, price: 57.5, assigned_bike_id: 'h1', registered_at: '2099-01-09T10:01:00Z' },
    { id: 'b1', name: 'Mid Rider', height: 172, session_id: 'sB', session_day: 'Saturday', session_date: '2099-01-10', queue_num: 1, status: 'done', paid: true, price: 75, assigned_bike_id: 'r1', registered_at: '2099-01-10T10:00:00Z' },
  ],
};

test('analytics: session picker, rider-heights card, and the per-session report data', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('analytics')`);

  // rider-heights card present with the average (185+158+172)/3 = 172
  const html = await page.evaluate(`document.getElementById('tab-analytics').innerHTML`);
  expect(html).toContain('Rider Heights');
  expect(html).toContain('172 cm');

  // session picker exists with both sessions + "All sessions"
  const opts = await page.evaluate(`[...document.querySelectorAll('#tab-analytics select')].flatMap(s=>[...s.options].map(o=>o.textContent)).filter(t=>/All sessions|Fri|Sat/.test(t))`);
  expect((opts as string[]).some((o) => o.includes('All sessions'))).toBe(true);

  // the report data: 2 sessions, per-session heights + bike-type counts
  const report = await page.evaluate(`(()=>{ const d=_anHeightBikeData(); return d.map(x=>({date:x.sess.session_date, people:x.people.length, road:x.typeCounts.Road, hybrid:x.typeCounts.Hybrid})); })()`) as Array<{ date: string; people: number; road: number; hybrid: number }>;
  expect(report.length).toBe(2);
  const sA = report.find((r) => r.date === '2099-01-09')!;
  expect(sA.people).toBe(2);   // both riders had heights
  expect(sA.road).toBe(1);     // 1 Road bike rented
  expect(sA.hybrid).toBe(1);   // 1 Hybrid rented

  // filtering to one session narrows the report
  await page.evaluate(`S.anSession='sB'; renderAnalytics();`);
  const one = await page.evaluate(`_anHeightBikeData().length`);
  expect(one).toBe(1);
});

test('the height+bike CSV export builds without error', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('analytics')`);
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.evaluate(`
    const clicks=[]; const realCreate=document.createElement.bind(document);
    document.createElement=(t)=>{const el=realCreate(t); if(t==='a'){el.click=()=>clicks.push(el.download);} return el;};
    URL.createObjectURL=()=>'blob:x'; URL.revokeObjectURL=()=>{};
    exportHeightBikeCsv();
    window.__csvName=clicks[0];
  `);
  expect(await page.evaluate('window.__csvName')).toBe('heights_bike_types.csv');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('report data includes a per-session height summary and ranges', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setStaffTab('analytics')`);
  const d = await page.evaluate(`(()=>{const x=_anHeightBikeData().find(r=>r.sess.session_date==='2099-01-09'); return { summary:x.hSummary, ranges:x.hRanges };})()`) as { summary: { count: number; avg: number; min: number; max: number }; ranges: Array<[string, number]> };
  // session A had 185 and 158
  expect(d.summary.count).toBe(2);
  expect(d.summary.min).toBe(158);
  expect(d.summary.max).toBe(185);
  expect(d.summary.avg).toBe(172); // round((185+158)/2)=172 (171.5 -> 172)
  // ranges: one <160, one 180+
  const byLabel = Object.fromEntries(d.ranges);
  expect(byLabel['<160']).toBe(1);
  expect(byLabel['180+']).toBe(1);
});
