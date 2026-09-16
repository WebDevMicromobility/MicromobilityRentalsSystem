import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, loginCustomer, waitForSb } from './helpers/supabase';

// Nationality is an optional profile field. It is never asked at signup; the customer sets
// it on My Account, staff set it on the account form, and the report lists it.

const sessions = [{ id: '2099-01-01', session_date: '2099-01-01', day: 'Sunday', status: 'open', capacity: 20, created_at: 1 }];

test('My Account fills nationality in from customer_profile and saves it through the RPC', async ({ page }) => {
  await stubSupabase(page, {
    sessions, queue_entries: [],
    'rpc:customer_profile': [{ id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', nationality: 'Egypt', gender: 'male' }],
    'rpc:customer_update_profile': true,
  });
  await loginCustomer(page, { id: 'c1' });                       // a session from before the field existed
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setCustTab('account')`);
  await expect(page.locator('#acc-nationality')).toHaveValue('Egypt');   // hydrated, then painted again
  expect(await page.evaluate(`JSON.parse(localStorage.getItem('cq_session')).nationality`)).toBe('Egypt');

  const calls: string[] = [];
  page.on('request', r => { if (/rpc\/customer_update_profile/.test(r.url())) calls.push(r.postData() || ''); });
  await page.selectOption('#acc-nationality', 'Jordan');
  await page.evaluate(`saveAccount()`);
  await expect.poll(() => calls.length).toBe(1);
  expect(JSON.parse(calls[0]).p_nationality).toBe('Jordan');
  expect(await page.evaluate(`S.loggedIn.nationality`)).toBe('Jordan');
});

test('the signup form never asks for nationality', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [] });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`showAuthModal&&showAuthModal('signup')`).catch(() => {});
  expect(await page.evaluate(`document.body.innerHTML.includes('id="sgn-nationality"')`)).toBe(false);
  expect(await page.evaluate(`[...document.querySelectorAll('.auth-field label')].some(l=>/Nationality/.test(l.textContent||''))`)).toBe(false);
});

test('staff set it on the account form and the report lists and filters by it', async ({ page }) => {
  const customers = [
    { id: 'c1', name: 'Amal Member', email: 'amal@example.test', phone: '+966500000001', gender: 'female', nationality: 'Egypt', created_at: '2026-08-20T10:00:00Z' },
    { id: 'c2', name: 'Bader Lapsed', email: 'bader@example.test', phone: '+966500000002', gender: 'male', nationality: null, created_at: '2025-01-05T10:00:00Z' },
  ];
  await stubSupabase(page, { customers, tags: [], customer_tags: [], sessions, queue_entries: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('getCustomers().length>0');
  await page.evaluate(`localStorage.removeItem('cq_acc_rep_opts');S._accOpts=null;`);

  const cells = await page.evaluate(`_accRows().map(r=>[r.c.id,r.cells.nationality])`) as [string, string][];
  expect(Object.fromEntries(cells)).toEqual({ c1: 'Egypt', c2: '' });
  expect(await page.evaluate(`_accBreakdown('nationality',_accRows(),_accOpts())`)).toEqual([{ label: 'Egypt', value: 1 }, { label: 'Not set', value: 1 }]);
  expect(await page.evaluate(`(()=>{const o=_accOpts();o.fNationality='Egypt';const ids=_accRows().map(r=>r.c.id);o.fNationality='all';return ids;})()`)).toEqual(['c1']);

  const patches: string[] = [];
  page.on('request', r => { if (r.method() === 'PATCH' && /customers/.test(r.url())) patches.push(r.postData() || ''); });
  await page.evaluate(`showEditCustomerModal('c2')`);
  await expect(page.locator('#cf-nationality')).toHaveValue('');
  await page.selectOption('#cf-nationality', 'Pakistan');
  await page.evaluate(`saveCustForm()`);
  await expect.poll(() => patches.length).toBeGreaterThan(0);
  expect(JSON.parse(patches[0]).nationality).toBe('Pakistan');
});

test('the list holds every country: Saudi Arabia first, then alphabetical in the rider\'s language', async ({ page }) => {
  await stubSupabase(page, {
    sessions, queue_entries: [],
    'rpc:customer_profile': [{ id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', nationality: null, gender: 'male' }],
  });
  await loginCustomer(page, { id: 'c1' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setCustTab('account')`);
  const en = await page.evaluate(`[...document.querySelectorAll('#acc-nationality option')].map(o=>[o.value,o.textContent])`) as [string, string][];
  expect(en[0][0]).toBe('');                                  // the placeholder
  expect(en[1]).toEqual(['Saudi Arabia', 'Saudi Arabia']);   // pinned to the top
  const rest = en.slice(2).map(o => o[1]);
  expect(rest.length).toBeGreaterThan(190);                   // every country, not the residence shortlist
  expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, 'en')));
  expect(rest).toContain('Japan');
  expect(rest).not.toContain('Saudi Arabia');

  await page.evaluate(`setLang('ar')`);
  const ar = await page.evaluate(`[...document.querySelectorAll('#acc-nationality option')].map(o=>[o.value,o.textContent])`) as [string, string][];
  expect(ar[1]).toEqual(['Saudi Arabia', 'السعودية']);       // the value never changes, only the label
  const arLabels = ar.slice(2).map(o => o[1]);
  expect(arLabels).toEqual([...arLabels].sort((a, b) => a.localeCompare(b, 'ar')));
  expect(ar.find(o => o[0] === 'Japan')?.[1]).toBe('اليابان');
});
