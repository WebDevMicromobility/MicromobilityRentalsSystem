import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// After staff complete a customer's ride, the rating prompt is MANDATORY: no dismiss, no "Later",
// and it requires the experience score before it will close.
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const disp = (page: import('@playwright/test').Page) =>
  page.evaluate(`document.getElementById('rate-modal').style.display`);

test('a completed unrated ride forces a non-dismissible rating prompt', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: today, capacity: 12, status: 'open', created_at: 1 }],
    queue_entries: [{ id: 'q1', name: 'Spec Rider', customer_id: 'c1', session_id: 's1', session_day: 'Friday',
      session_date: today, queue_num: 1, status: 'done', paid: true, price: 30, registered_at: today + 'T10:00:00Z' }],
    'rpc:customer_booking_update': true, // customer rating write succeeds
  });
  await loginCustomer(page, { id: 'c1' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.view='customer'; setCustTab('myrides')`);

  expect(await disp(page)).toBe('flex');                                   // forced open
  expect(await page.locator('#rate-modal .btn-secondary').count()).toBe(0); // no "Later"/cancel

  // backdrop click does NOT dismiss
  await page.locator('#rate-modal .modal-backdrop').click({ position: { x: 5, y: 5 } });
  expect(await disp(page)).toBe('flex');

  // switching tabs re-triggers it — can't route around
  await page.evaluate(`setCustTab('register')`);
  expect(await disp(page)).toBe('flex');

  // submitting WITHOUT an experience score is blocked
  await page.evaluate('submitRating()');
  expect(await disp(page)).toBe('flex');

  // give the experience score → now it submits and closes
  await page.evaluate(`setRate('exp',8); submitRating()`);
  await page.waitForFunction(`document.getElementById('rate-modal').style.display==='none'`);
  expect(await page.evaluate(`getQueue().find(e=>e.id==='q1').ratingExp`)).toBe(8);
});

test('a rated ride does not force the prompt', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: today, capacity: 12, status: 'open', created_at: 1 }],
    queue_entries: [{ id: 'q1', name: 'Spec Rider', customer_id: 'c1', session_id: 's1', session_day: 'Friday',
      session_date: today, queue_num: 1, status: 'done', paid: true, price: 30, rating_exp: 9, registered_at: today + 'T10:00:00Z' }],
  });
  await loginCustomer(page, { id: 'c1' });
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`S.view='customer'; setCustTab('myrides')`);
  expect(await disp(page)).not.toBe('flex'); // already rated → no forced prompt
});
