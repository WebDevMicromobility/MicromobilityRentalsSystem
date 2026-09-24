import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// staff.micromobility.sa serves the same app, locked to its staff side. It opens on the staff
// sign-in or the panel, never on the customer pages, and the sign-in cannot be closed onto
// them. Search engines are shut out. Chromium resolves *.localhost to this machine, so
// staff.localhost stands in for the real address.

const staffUrl = (path = '/') => {
  const base = new URL(String(test.info().project.use.baseURL));
  return `${base.protocol}//staff.localhost:${base.port}${path}`;
};
const sessions = [{ id: '2099-03-03', day: 'Tuesday', session_date: '2099-03-03', capacity: 40, status: 'open', created_at: 1, bike_slots: '{"_time":"21:00 - 23:00"}' }];

async function open(page: Page, staff: boolean) {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [] });
  if (staff) await unlockStaff(page);
  await page.goto(staffUrl());
  await waitForSb(page);
}

test('a signed-out device gets the staff sign-in alone', async ({ page }) => {
  await open(page, false);
  await expect(page.locator('#pin-modal .pin-box')).toBeVisible();
  await expect(page).toHaveTitle('Micromobility Staff');
  await expect(page.locator('#view-landing')).toBeHidden();
  await expect(page.locator('#auth-modal')).toBeHidden(); // never the customer sign-in
  await expect(page.locator('#customer-tab-nav')).toBeHidden();
});

test('closing the sign-in brings it back: there is nothing behind it', async ({ page }) => {
  await open(page, false);
  await page.locator('#pin-modal .pin-cancel').click();
  await expect(page.locator('#pin-modal .pin-box')).toBeVisible();
  expect(await page.evaluate('S.view')).not.toBe('customer');
});

test('an unlocked device opens on the staff panel, and customer routes lead back to it', async ({ page }) => {
  await open(page, true);
  await expect(page.locator('#view-staff')).toHaveClass(/active/);
  await expect(page).toHaveTitle('Micromobility Staff');
  await page.evaluate(`goLanding()`);
  expect(await page.evaluate('S.view')).toBe('staff');
  await page.evaluate(`goCustomer('register')`);
  expect(await page.evaluate('S.view')).toBe('staff');
});

test('the customer address is unchanged', async ({ page }) => {
  await stubSupabase(page, { sessions, queue_entries: [], bikes: [] });
  await page.goto('/');
  await waitForSb(page);
  await expect(page).toHaveTitle('Micromobility Experiences');
  await expect(page.locator('#pin-modal .pin-box')).toHaveCount(0);
  expect(await page.evaluate(`document.body.classList.contains('staff-host')`)).toBe(false);
});

test.describe('the middleware on the staff address', () => {
  const run = async (url: string) => {
    const mod = await import(pathToFileURL(resolve(__dirname, '..', 'functions/_middleware.js')).href + '?h=' + Math.random());
    return mod.onRequest({ request: new Request(url), next: () => new Response('asset', { headers: { 'content-type': 'text/html' } }) }) as Promise<Response>;
  };
  test('shuts every crawler out', async () => {
    const r = await run('https://staff.micromobility.sa/robots.txt');
    expect(await r.text()).toBe('User-agent: *\nDisallow: /\n');
  });
  test('marks every page noindex, and still hides internal files', async () => {
    const r = await run('https://staff.micromobility.sa/');
    expect(r.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await r.text()).toBe('asset');
    expect((await run('https://staff.micromobility.sa/AGENTS.md')).status).toBe(404);
  });
  test('leaves the customer address alone', async () => {
    const r = await run('https://micromobilityrentals.pages.dev/');
    expect(r.headers.get('x-robots-tag')).toBeNull();
    expect(await (await run('https://micromobilityrentals.pages.dev/robots.txt')).text()).toBe('asset');
  });
});
