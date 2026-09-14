import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// After a rider's eighth booking that happened (rode or no-show), picking an event brings
// one page before the session list: birth date and nationality, both required. Cancelled
// and upcoming bookings don't count; a complete profile never sees it; it never says why.

const S1 = '2099-01-01';
const sessions = [{ id: S1, session_date: S1, day: 'Sunday', status: 'open', capacity: 20, created_at: 1, event_kind: 'jcc' }];
const past = (i: number) => `2026-0${1 + (i % 8)}-1${i % 9}`;
const row = (i: number, status: string) => ({
  id: 'b' + i, customer_id: 'c1', session_id: past(i), session_day: 'Tuesday', session_date: past(i), queue_num: i + 1,
  name: 'Spec Rider', phone: '0500000001', type_preference: 'Road', size: 'M', status, paid: status !== 'noshow',
  price: 75, registered_at: past(i) + 'T10:00:00Z',
});
const eight = [0, 1, 2, 3, 4, 5].map(i => row(i, 'done')).concat([row(6, 'noshow'), row(7, 'noshow')]);

async function boot(page: import('@playwright/test').Page, bookings: Record<string, unknown>[], profile: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  await stubSupabase(page, {
    sessions, queue_entries: bookings, 'rpc:my_bookings': bookings,   // the direct read (tests) and the secure RPC (production) both carry the account's rows
    'rpc:customer_profile': [{ id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', ...profile }],
    'rpc:customer_update_profile': true, ...extra,
  });
  await loginCustomer(page, { id: 'c1' });
  await page.goto('/');
  await waitForSb(page);
}

test('eight bookings and a bare profile: the gate takes the event pick, saves both, then continues', async ({ page }) => {
  await boot(page, eight, { nationality: null, birth_date: null });
  const calls: string[] = [];
  page.on('request', r => { if (/rpc\/customer_update_profile/.test(r.url())) calls.push(r.postData() || ''); });
  await page.evaluate(`S.selEvent='none';selectEvent('jcc')`);
  const box = page.locator('#profile-gate .pg-box');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Two details to finish your profile');
  expect(await box.innerText()).not.toMatch(/\b8\b|eight/i);          // the page never says why
  expect(await page.evaluate('S.selEvent')).toBe('none');               // the event did not open
  await expect(page.locator('#app-footer')).toBeHidden();
  await expect(page.locator('#pg-save')).toBeDisabled();

  await page.fill('#pg-birth', '1996-03-14');
  await expect(page.locator('#pg-save')).toBeDisabled();             // one of two
  await page.selectOption('#pg-nat', 'Egypt');
  await expect(page.locator('#pg-save')).toBeEnabled();
  await page.click('#pg-save');
  await expect(box).toBeHidden();
  expect(calls).toHaveLength(1);
  const body = JSON.parse(calls[0]);
  expect(body.p_birth_date).toBe('1996-03-14');
  expect(body.p_nationality).toBe('Egypt');
  expect(body.p_name).toBe('Spec Rider');                            // the rest of the profile carried through
  expect(await page.evaluate('[S.selEvent,S.loggedIn.nationality,S.loggedIn.birth_date]')).toEqual(['jcc', 'Egypt', '1996-03-14']);
  await expect(page.locator('#app-footer')).toBeVisible();
});

test('seven bookings: no gate', async ({ page }) => {
  await boot(page, eight.slice(0, 7), { nationality: null, birth_date: null });
  await page.evaluate(`selectEvent('jcc')`);
  await expect(page.locator('#profile-gate')).toBeHidden();
  expect(await page.evaluate('S.selEvent')).toBe('jcc');
});

test('cancelled bookings do not count', async ({ page }) => {
  await boot(page, eight.slice(0, 6).concat([row(6, 'cancelled'), row(7, 'cancelled')]), { nationality: null, birth_date: null });
  await page.evaluate(`selectEvent('jcc')`);
  await expect(page.locator('#profile-gate')).toBeHidden();
  expect(await page.evaluate('S.selEvent')).toBe('jcc');
});

test('a complete profile never sees it', async ({ page }) => {
  await boot(page, eight, { nationality: 'Jordan', birth_date: '1990-01-01' });
  await page.evaluate(`selectEvent('jcc')`);
  await expect(page.locator('#profile-gate')).toBeHidden();
  expect(await page.evaluate('S.selEvent')).toBe('jcc');
});

test('a birth date that cannot be right is refused before anything is sent', async ({ page }) => {
  await boot(page, eight, { nationality: null, birth_date: null });
  const calls: string[] = [];
  page.on('request', r => { if (/rpc\/customer_update_profile/.test(r.url())) calls.push(r.url()); });
  await page.evaluate(`selectEvent('jcc')`);
  await page.fill('#pg-birth', '2099-01-01');
  await page.selectOption('#pg-nat', 'Egypt');
  await page.evaluate(`_pgSave()`);
  await expect(page.locator('#profile-gate .pg-msg')).toHaveText('Enter your birth date to continue.');
  expect(calls).toHaveLength(0);
  await page.fill('#pg-birth', '1996-03-14');                        // typing clears the error
  await expect(page.locator('#profile-gate .pg-msg')).toHaveCount(0);
});

test('a failed save keeps the values and says so', async ({ page }) => {
  await boot(page, eight, { nationality: null, birth_date: null }, { 'rpc:customer_update_profile': { __rpcError: { status: 500, code: 'XX000', message: 'boom' } } });
  await page.evaluate(`S.selEvent='none';selectEvent('jcc')`);
  await page.fill('#pg-birth', '1996-03-14');
  await page.selectOption('#pg-nat', 'Egypt');
  await page.click('#pg-save');
  await expect(page.locator('#profile-gate .pg-net')).toContainText('Couldn’t save');
  await expect(page.locator('#pg-birth')).toHaveValue('1996-03-14');
  await expect(page.locator('#pg-nat')).toHaveValue('Egypt');
  await expect(page.locator('#pg-save')).toBeEnabled();
  expect(await page.evaluate('S.selEvent')).toBe('none');
});
