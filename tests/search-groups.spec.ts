import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A rider at the desk says a number, not a name. Both search boxes on the queue and waitlist
// pages take that number — from its first digit, so #42 is found by typing "4" — and both
// then widen the result to the whole party. A group books together and is handed bikes
// together, so finding one member and hiding the other three is how a staffer hands out
// three bikes and misses the fourth.

const S1 = '2099-03-03';
const sessions = [{ id: S1, session_date: S1, day: 'Tuesday', status: 'open', capacity: 20, created_at: 1 }];
const row = (id: string, qn: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, session_id: S1, session_day: 'Tuesday', session_date: S1, queue_num: qn, name,
  phone: '0561000' + String(qn).padStart(3, '0'), type_preference: 'Road', status: 'waiting',
  paid: true, price: 75, size: 'M', registered_at: '2099-01-01T10:00:00Z', ...extra,
});
// A party of three tied by group_id, a solo rider, and a decoy whose number merely starts the same.
const queue_entries = [
  row('g1', 41, 'Party Head', { group_id: 'grp-1', group_name: 'The Khan Family' }),
  row('g2', 42, 'Party Two', { group_id: 'grp-1' }),
  row('g3', 43, 'Party Three', { group_id: 'grp-1' }),
  row('solo', 7, 'Solo Rider'),
  row('dec', 410, 'Decoy Rider'),
  row('41027bd3', 88, 'Digit Id Rider'),   // id prefix carries no letters
  // a second party, tied by the account rather than an explicit group
  row('a1', 51, 'Account One', { customer_id: 'cust-9' }),
  row('a2', 52, 'Account Two', { customer_id: 'cust-9' }),
];

async function boot(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions, queue_entries, bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction(`getQueue().length>0`);
  await page.evaluate(`setStaffTab('queue');S.queueView='bookings';renderStaffQueue()`);
}

/** Names the queue's own filter keeps for a query, via the same predicate the view uses. */
async function names(page: import('@playwright/test').Page, q: string) {
  return page.evaluate(`(()=>{
    const pool=getQueue().filter(e=>e.sessionId==='${S1}');
    const hit=pool.filter(e=>_searchHit(e,${JSON.stringify(q)}));
    return _withParty(hit,pool).map(e=>e.name).sort();
  })()`) as Promise<string[]>;
}

test('a booking number finds the rider from its first digit', async ({ page }) => {
  await boot(page);
  expect(await names(page, '7')).toContain('Solo Rider');
  expect(await names(page, '#7')).toContain('Solo Rider');
});

test('finding one rider by number brings their whole party', async ({ page }) => {
  await boot(page);
  const found = await names(page, '42');            // only #42 matches directly
  expect(found).toEqual(['Party Head', 'Party Three', 'Party Two']);
  expect(found).not.toContain('Solo Rider');
});

test('a party tied by the account, not a group id, widens too', async ({ page }) => {
  await boot(page);
  expect(await names(page, '51')).toEqual(['Account One', 'Account Two']);
});

test('a name match widens to the party as well', async ({ page }) => {
  await boot(page);
  expect(await names(page, 'Party Two')).toEqual(['Party Head', 'Party Three', 'Party Two']);
});

test('a raw booking id still matches even when it happens to be all digits', async ({ page }) => {
  await boot(page);
  // _searchHit routes 4+ digit queries through _matchesRef as well as the booking number:
  // ~1 in 130 booking ids carries no letters in its first four characters, and pasting one
  // used to find nothing. Short numbers stay out of it — _matchesRef needs four characters.
  expect(await names(page, '4102')).toEqual(['Digit Id Rider']);
  expect(await names(page, '41')).not.toContain('Digit Id Rider');
});

test('a solo rider stays solo — no key, no widening', async ({ page }) => {
  await boot(page);
  expect(await names(page, 'Solo')).toEqual(['Solo Rider']);
});

test('a prefix search still lists everyone it legitimately matches', async ({ page }) => {
  await boot(page);
  const found = await names(page, '41');            // #41 (party) and #410 (decoy)
  expect(found).toContain('Decoy Rider');
  expect(found).toContain('Party Two');             // pulled in as #41's party
});

test('the queue box itself filters the rendered rows down to the party', async ({ page }) => {
  await boot(page);
  await page.locator('#sf-search-input').fill('42');
  await expect.poll(async () => {
    const html = await page.evaluate(`document.getElementById('tab-queue').innerText`) as string;
    return ['Party Head', 'Party Two', 'Party Three'].every((n) => html.includes(n)) && !html.includes('Solo Rider');
  }, { timeout: 4000 }).toBe(true);
});

test('the waitlist picker offers the party as one line, found by number', async ({ page }) => {
  await boot(page);
  await page.evaluate(`S.queueView='managed';renderStaffQueue()`);
  await page.locator('#mw-name').fill('42');
  const sug = page.locator('#mw-suggest');
  await expect(sug).toBeVisible();
  await expect(sug).toContainText('The Khan Family');   // the group's own name, not one rider's
  await expect(sug).toContainText('+2');                // offered as a single three-rider line
});
