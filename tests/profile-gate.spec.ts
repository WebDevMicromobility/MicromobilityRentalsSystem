import { test, expect } from '@playwright/test';

/** The birth date is three selects (day, month, year) over a hidden YYYY-MM-DD input. */
async function pickBirth(page: import('@playwright/test').Page, id: string, iso: string) {
  const [y, m, d] = iso.split('-');
  await page.selectOption(`#${id}-y`, y);
  await page.selectOption(`#${id}-m`, String(+m));
  await page.selectOption(`#${id}-d`, String(+d));
}
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// After a rider's eighth booking, picking an event brings one page before the session list:
// birth date and nationality, both required. Every booking counts except a cancelled one -
// upcoming and waitlisted included; a complete profile never sees it; it never says why.

const S1 = '2099-01-01';
const sessions = [{ id: S1, session_date: S1, day: 'Sunday', status: 'open', capacity: 20, created_at: 1, event_kind: 'jcc' }];
const past = (i: number) => `2026-0${1 + (i % 8)}-1${i % 9}`;
const row = (i: number, status: string) => ({
  id: 'b' + i, customer_id: 'c1', session_id: past(i), session_day: 'Tuesday', session_date: past(i), queue_num: i + 1,
  name: 'Spec Rider', phone: '0500000001', type_preference: 'Road', size: 'M', status, paid: status !== 'noshow',
  price: 75, registered_at: past(i) + 'T10:00:00Z',
});
const eight = [0, 1, 2, 3].map(i => row(i, 'done')).concat([row(4, 'noshow'), row(5, 'active'), row(6, 'waiting'), row(7, 'waitlist')]); // upcoming and waitlisted count too

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
  // the page never says why (the day/year selects hold every number, so read the prose only)
  expect(await box.evaluate(el => { const c = el.cloneNode(true) as HTMLElement; c.querySelectorAll('select').forEach(s => s.remove()); return c.textContent || ''; })).not.toMatch(/\b8\b|eight/i);
  expect(await page.evaluate('S.selEvent')).toBe('none');               // the event did not open
  await expect(page.locator('#app-footer')).toBeHidden();
  await expect(page.locator('#pg-save')).toBeDisabled();

  await pickBirth(page, 'pg-birth', '1996-03-14');
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
  // The gate hides the footer while it is up; afterwards the page is whole again. The footer
  // itself only exists on a desk screen, so check it where it exists.
  expect(await page.evaluate(`document.body.classList.contains('gate-page')`)).toBe(false);
  await page.setViewportSize({ width: 1280, height: 900 });
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
  // The chooser cannot even offer a future year; a stale device value still gets refused.
  expect(await page.evaluate(`[...document.querySelectorAll('#pg-birth-y option')].some(o=>o.value==='2099')`)).toBe(false);
  await page.evaluate(`_pgBirth('2099-01-01')`);
  await page.selectOption('#pg-nat', 'Egypt');
  await page.evaluate(`_pgSave()`);
  await expect(page.locator('#profile-gate .pg-msg')).toHaveText("A birth date can't be in the future.");
  // Five years old today is refused too; the rider has to be six.
  const five = await page.evaluate(`(()=>{const p=todayStr().split('-');return (p[0]-5)+'-'+p[1]+'-'+p[2];})()`) as string;
  await page.evaluate(`_pgBirth('${five}')`);
  await page.evaluate(`_pgSave()`);
  await expect(page.locator('#profile-gate .pg-msg')).toHaveText('Riders must be at least 6 years old. Check the birth date.');
  expect(calls).toHaveLength(0);
  await pickBirth(page, 'pg-birth', '1996-03-14');                   // picking clears the error
  await expect(page.locator('#profile-gate .pg-msg')).toHaveCount(0);
});

test('a failed save keeps the values and says so', async ({ page }) => {
  await boot(page, eight, { nationality: null, birth_date: null }, { 'rpc:customer_update_profile': { __rpcError: { status: 500, code: 'XX000', message: 'boom' } } });
  await page.evaluate(`S.selEvent='none';selectEvent('jcc')`);
  await pickBirth(page, 'pg-birth', '1996-03-14');
  await page.selectOption('#pg-nat', 'Egypt');
  await page.click('#pg-save');
  await expect(page.locator('#profile-gate .pg-net')).toContainText('Couldn’t save');
  await expect(page.locator('#pg-birth')).toHaveValue('1996-03-14');
  await expect(page.locator('#pg-nat')).toHaveValue('Egypt');
  await expect(page.locator('#pg-save')).toBeEnabled();
  expect(await page.evaluate('S.selEvent')).toBe('none');
});

test('the birth chooser: month names in the rider\'s language, and the day list follows the month', async ({ page }) => {
  await boot(page, eight, { nationality: null, birth_date: null });
  await page.evaluate(`selectEvent('jcc')`);
  const months = await page.evaluate(`[...document.querySelectorAll('#pg-birth-m option')].map(o=>o.textContent)`) as string[];
  expect(months.slice(1)).toEqual(['January','February','March','April','May','June','July','August','September','October','November','December']);
  await page.selectOption('#pg-birth-y', '1996');
  await page.selectOption('#pg-birth-m', '1');
  await page.selectOption('#pg-birth-d', '31');
  await expect(page.locator('#pg-birth')).toHaveValue('1996-01-31');
  await page.selectOption('#pg-birth-m', '2');                     // February 1996 has 29 days
  expect(await page.evaluate(`document.querySelectorAll('#pg-birth-d option').length - 1`)).toBe(29);
  await expect(page.locator('#pg-birth')).toHaveValue('1996-02-29'); // the 31st was clamped, not dropped
  await page.evaluate(`setLang('ar')`);
  const ar = await page.evaluate(`document.querySelector('#pg-birth-m option[value="1"]').textContent`);
  expect(ar).toBe('يناير');
});
