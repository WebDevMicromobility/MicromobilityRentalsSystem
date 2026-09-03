import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Nobody closes out a session by hand: by September, 1,776 bookings were still 'waiting' and
// 191 still 'active' on nights that ended in July. One button finishes the night the way it
// actually went — checked-in riders become done, no-arrivals become no-show — with guarded
// writes (a row another till already dealt with is not rewritten) and an undo.

const OLD = '2020-01-01';
const sessions = [
  { id: OLD, session_date: OLD, day: 'Sunday', status: 'closed', capacity: 10, created_at: 1 },
  { id: '2099-09-09', session_date: '2099-09-09', day: 'Future', status: 'open', capacity: 10, created_at: 2 },
];
const e = (id: string, sid: string, st: string, x: Record<string, unknown> = {}) => ({
  id, session_id: sid, session_day: 'Sunday', session_date: sid, queue_num: 1, name: 'R ' + id,
  phone: '0550000001', type_preference: 'Road', size: 'M', status: st, paid: true, price: 75,
  registered_at: '2020-01-01T10:00:00Z', ...x });

async function boot(page: import('@playwright/test').Page, queue_entries: Record<string, unknown>[]) {
  await stubSupabase(page, { sessions, queue_entries, bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  await page.evaluate(`setStaffTab('queue');S.queueView='sessions';renderStaffQueue()`);
  await page.waitForTimeout(250);
}

function patches(page: import('@playwright/test').Page) {
  const out: { url: string; body: string }[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) out.push({ url: r.url(), body: r.postData() || '' });
  });
  return out;
}

test('checked-in riders become done, no-arrivals become no-show, guarded', async ({ page }) => {
  await boot(page, [
    e('a', OLD, 'active', { checked_in_at: '2020-01-01T21:00:00Z' }),
    e('b', OLD, 'waiting', { checked_in_at: '2020-01-01T21:05:00Z', queue_num: 2 }),
    e('c', OLD, 'waiting', { queue_num: 3 }),
    e('w', OLD, 'waitlist', { queue_num: 4, waitlist_num: 1 }),
  ]);
  const p = patches(page);
  await page.evaluate(`closeOutSession('${OLD}')`);
  await page.locator('.confirm-box button').filter({ hasText: /close out/i }).click();
  await expect.poll(() => p.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  const done = p.find((x) => /"status":"done"/.test(x.body))!;
  const ns = p.find((x) => /"status":"noshow"/.test(x.body))!;
  const ids = (u: string) => decodeURIComponent(u).match(/id=in\.\(([^)]*)\)/)?.[1].split(',') ?? [];
  expect(ids(done.url).sort()).toEqual(['a', 'b']);   // active, and waiting-but-checked-in — they rode
  expect(done.url).toMatch(/status=in\./);             // guarded on current status
  expect(ids(ns.url)).toEqual(['c']);                  // the waitlist row w is not touched
  expect(ns.url).toMatch(/status=eq\.waiting/);
});

test('the button appears only when the night is over AND rows are live', async ({ page }) => {
  await boot(page, [e('a', OLD, 'active'), e('f', '2099-09-09', 'waiting')]);
  // actions live in the detail pane, so look at each session's detail in turn
  await page.evaluate(`selectSessionDetail('${OLD}')`);
  await page.waitForTimeout(200);
  await expect(page.locator('#tab-queue')).toContainText('Close out');
  await page.evaluate(`selectSessionDetail('2099-09-09')`);
  await page.waitForTimeout(200);
  const txt = await page.evaluate(`document.getElementById('tab-queue').innerText`) as string;
  expect(txt).not.toContain('Close out');     // the future session offers nothing
});

test('a fully closed-out night offers nothing', async ({ page }) => {
  await boot(page, [e('a', OLD, 'done'), e('b', OLD, 'noshow', { queue_num: 2 })]);
  await page.evaluate(`selectSessionDetail('${OLD}')`);
  await page.waitForTimeout(200);
  const txt = await page.evaluate(`document.getElementById('tab-queue').innerText`) as string;
  expect(txt).not.toContain('Close out');
});
