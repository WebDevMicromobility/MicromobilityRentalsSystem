import { test, expect, type Page } from '@playwright/test';
import { stubSupabase, waitForSb } from './helpers/supabase';

// Sign-in paths that must tell a failed request apart from an answer.

const customer = { id: 'c9', name: 'Test User', email: 'x@y.com', phone: '+966508727012', height: 170, type_preference: 'Any', created_at: '2026-01-01', session_token: 'tok9' };

async function boot(page: Page, fixtures: Record<string, unknown> = {}) {
  await stubSupabase(page, fixtures);
  await page.goto('/');
  await waitForSb(page);
}

test('Safari\'s "Load failed" at login is a connection problem, not a wrong password', async ({ page }) => {
  await boot(page);
  await page.evaluate('openAuthModal()');
  await page.evaluate(`sb.rpc=async()=>({data:null,error:{message:'TypeError: Load failed',details:'',hint:'',code:''}})`);
  await page.fill('#a-identifier', 'x@y.com');
  await page.fill('#a-pwd', 'Zq8xTselah');
  await page.evaluate('doLogin()');
  await expect(page.locator('#auth-err')).toHaveText(/Connection error|offline/);
});

test('a Google return whose account lookup fails does not open the new-account form', async ({ page }) => {
  await boot(page, { 'rpc:customer_oauth_login': { __rpcError: { status: 503, code: '', message: 'upstream unavailable' } } });
  await page.evaluate(`sb.auth.getSession=async()=>({data:{session:{user:{email:'g@example.com',app_metadata:{provider:'google'},user_metadata:{full_name:'Gee Rider'}}}}})`);
  expect(await page.evaluate('handleGoogleReturn()')).toBe(false);
  expect(await page.evaluate('S._pendingGoogle')).toBeNull();
  await expect(page.locator('.toast').last()).toContainText(/Connection error|offline/);
});

test('a Google return with no account still goes to the new-account form', async ({ page }) => {
  await boot(page, { 'rpc:customer_oauth_login': [] });
  await page.evaluate(`sb.auth.getSession=async()=>({data:{session:{user:{email:'g@example.com',app_metadata:{provider:'google'},user_metadata:{full_name:'Gee Rider'}}}}})`);
  expect(await page.evaluate('handleGoogleReturn()')).toBe('complete');
  expect(await page.evaluate('S._pendingGoogle && S._pendingGoogle.email')).toBe('g@example.com');
});

test('a second tap on Reset while the first is out sends nothing', async ({ page }) => {
  await boot(page);
  let calls = 0;
  await page.route(/\/rest\/v1\/rpc\/customer_reset/, async (route) => {
    calls++;
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify([customer]) });
  });
  await page.evaluate(`openAuthModal();switchAuthMode('forgot');S.forgotEmail='x@y.com';S.forgotCc='+966';S.forgotPhoneRaw='0508727012';S.forgotVerified='pending';S.forgotStep=2;renderAuthModal()`);
  await page.fill('#a-reset-pwd', 'Zq8xTselah');
  await page.fill('#a-reset-pwd2', 'Zq8xTselah');
  await page.evaluate('doResetPassword();doResetPassword();doResetPassword()');
  await page.waitForFunction('S.loggedIn && S.loggedIn.session_token==="tok9"');
  await page.waitForTimeout(200);
  expect(calls).toBe(1);
  expect(await page.evaluate('!!S._authBusy')).toBe(false);          // released for the next flow
});
