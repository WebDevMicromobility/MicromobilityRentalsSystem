import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// micromobility.sa/account sends a rider here with ?handoff=site to sign up, reset a password or
// sign in with Google or Apple; once signed in, the booking app asks for a one-time code
// (customer_handoff_create) and hands them back to the website, signed in there too.
const CODE = 'ab'.repeat(24);
const fixtures = { sessions: [{ id: 's1', day: 'Sunday', session_date: '2099-01-04', capacity: 12, status: 'open', created_at: 1, location: 'JCC' }], bikes: [], queue_entries: [] };

async function catchSite(page: Page) {
  const seen: string[] = [];
  await page.route(/^https:\/\/micromobility\.sa\/api\/account\/handoff/, (r) => { seen.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>website</p>' }); });
  return seen;
}

test('a signed-in rider is handed straight back to the website with a one-time code', async ({ page }) => {
  await stubSupabase(page, { ...fixtures, 'rpc:customer_handoff_create': CODE });
  const seen = await catchSite(page);
  await loginCustomer(page);
  await page.goto('/?handoff=site');
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]).toBe(`https://micromobility.sa/api/account/handoff?code=${CODE}`);
});

test('signed out, it opens the sign-up and hands back once the rider is signed in', async ({ page }) => {
  await stubSupabase(page, { ...fixtures, 'rpc:customer_handoff_create': CODE });
  const seen = await catchSite(page);
  await page.goto('/?handoff=site&auth=signup');
  await waitForSb(page);
  expect(await page.evaluate('S.authMode')).toBe('signup');
  expect(await page.evaluate(`sessionStorage.getItem('cq_handoff')`)).toBe('1');
  expect(new URL(page.url()).search).toBe(''); // the address is cleaned
  expect(seen.length).toBe(0);
  // signing in (as a remembered login does), then the landing opens as after any sign-in
  await page.evaluate(`localStorage.setItem('cq_session', JSON.stringify({ id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', session_token: 'tok-spec' }))`);
  await page.reload();
  await expect.poll(() => seen.length).toBe(1);
});

test('before the database has the handoff, the rider simply stays here, signed in', async ({ page }) => {
  await stubSupabase(page, { ...fixtures, 'rpc:customer_handoff_create': { __rpcError: { status: 404, code: 'PGRST202', message: 'Could not find the function public.customer_handoff_create' } } });
  const seen = await catchSite(page);
  await loginCustomer(page);
  await page.goto('/?handoff=site');
  await waitForSb(page);
  await page.waitForTimeout(500);
  expect(seen.length).toBe(0);
  expect(await page.evaluate('S.view')).toBe('landing');
  expect(await page.evaluate(`sessionStorage.getItem('cq_handoff')`)).toBeNull(); // not asked again on every page
});
