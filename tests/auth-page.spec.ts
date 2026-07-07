import { test, expect } from '@playwright/test';
import { stubSupabase, waitForSb } from './helpers/supabase';

// Deep coverage of the customer sign-in / sign-up modal: validation, Enter-to-submit,
// phone normalization into the RPCs, double-submit guards, and the Google-complete flow.

const customer = { id: 'c9', name: 'Test User', email: 'x@y.com', phone: '+966508727012', height: 170, type_preference: 'Any', created_at: '2026-01-01', session_token: 'tok9' };

async function boot(page: import('@playwright/test').Page, fixtures = {}) {
  await stubSupabase(page, fixtures);
  await page.route(/pwnedpasswords\.com/, (r) => r.fulfill({ status: 200, body: '' })); // never hit the real breach API in tests
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate('openAuthModal()');
}

// Capture RPC bodies for a given function name (registered after stubSupabase → takes precedence).
async function captureRpc(page: import('@playwright/test').Page, fn: string, result: unknown) {
  const calls: Record<string, unknown>[] = [];
  await page.route(new RegExp(`/rest/v1/rpc/${fn}`), async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(result) });
  });
  return calls;
}

test.describe('login', () => {
  test('validates inputs, then Enter submits and logs in', async ({ page }) => {
    await boot(page, { 'rpc:customer_login': [customer] });
    await page.evaluate('doLogin()');
    await expect(page.locator('#auth-err')).toContainText(/email|phone|البريد/i);
    await page.fill('#a-identifier', 'x@y.com');
    await page.evaluate('doLogin()');
    await expect(page.locator('#auth-err')).not.toBeEmpty(); // password required
    await page.fill('#a-pwd', 'Zq8xTselah');
    await page.press('#a-pwd', 'Enter'); // Enter must submit
    await page.waitForFunction('document.getElementById("auth-modal").style.display==="none"');
    expect(await page.evaluate('S.loggedIn && S.loggedIn.session_token')).toBe('tok9');
  });

  test('a local-format phone (05…) is normalized to +966 for the RPC', async ({ page }) => {
    await boot(page);
    const calls = await captureRpc(page, 'customer_login', [customer]);
    await page.fill('#a-identifier', '0508 727 012');
    await page.fill('#a-pwd', 'Zq8xTselah');
    await page.evaluate('doLogin()');
    await page.waitForFunction('document.getElementById("auth-modal").style.display==="none"');
    expect(calls[0].p_identifier).toBe('+966508727012'); // exact-digit SQL match requires this
  });

  test('a LOCKED throttle error shows the lockout message, not invalid-credentials', async ({ page }) => {
    await boot(page);
    await page.route(/\/rest\/v1\/rpc\/customer_login/, (r) => r.fulfill({
      status: 400, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'P0001', message: 'LOCKED' }),
    }));
    await page.fill('#a-identifier', 'x@y.com');
    await page.fill('#a-pwd', 'Zq8xTselah');
    await page.evaluate('doLogin()');
    const err = await page.locator('#auth-err').textContent();
    expect(err).toMatch(/too many|محاولات|wait|دقيقة|minutes/i);
  });
});

test.describe('signup', () => {
  async function fillSignup(page: import('@playwright/test').Page) {
    await page.evaluate('switchAuthMode("signup")');
    await page.fill('#a-name', 'Faisal Babalghoum');
    await page.evaluate('setSignupGender("male")');
    await page.fill('#a-email', 'faisal@example.com');
    await page.fill('#a-phone', '0508566560');
    await page.fill('#a-pwd', 'Zq8xTselah');
    await page.fill('#a-pwd2', 'Zq8xTselah');
    await page.fill('#a-height', '175');
  }

  test('validation cascade fires in order', async ({ page }) => {
    await boot(page);
    await page.evaluate('switchAuthMode("signup")');
    const errAfter = async () => { await page.evaluate('doSignup()'); return (await page.locator('#auth-err').textContent()) || ''; };
    expect(await errAfter()).toBeTruthy();                       // name
    await page.fill('#a-name', 'One');                           // single word → still name error
    expect(await errAfter()).toBeTruthy();
    await page.fill('#a-name', 'Faisal Babalghoum');
    expect(await errAfter()).toBeTruthy();                       // gender
    await page.evaluate('setSignupGender("male")');
    expect(await errAfter()).toBeTruthy();                       // email
    await page.fill('#a-email', 'bad-email');
    expect(await errAfter()).toBeTruthy();                       // email format
    await page.fill('#a-email', 'faisal@example.com');
    expect(await errAfter()).toBeTruthy();                       // phone
    await page.fill('#a-phone', '0508566560');
    expect(await errAfter()).toBeTruthy();                       // weak password
    await page.fill('#a-pwd', 'Zq8xTselah');
    await page.fill('#a-pwd2', 'Zq8xOther');
    expect(await errAfter()).toBeTruthy();                       // mismatch
  });

  test('successful signup sends a normalized phone and keeps the session token', async ({ page }) => {
    await boot(page);
    const calls = await captureRpc(page, 'customer_signup', [{ session_token: 'tok-new' }]);
    await fillSignup(page);
    await page.press('#a-height', 'Enter'); // Enter submits signup too
    await page.waitForFunction('document.getElementById("auth-modal").style.display==="none"');
    expect(calls.length).toBe(1);
    expect(calls[0].p_phone).toBe('+966508566560');
    expect(calls[0].p_gender).toBe('male');
    expect(await page.evaluate('S.loggedIn.session_token')).toBe('tok-new');
  });

  test('double-submit fires exactly one signup RPC', async ({ page }) => {
    await boot(page);
    const calls = await captureRpc(page, 'customer_signup', [{ session_token: 't' }]);
    await fillSignup(page);
    await page.evaluate('doSignup();doSignup();doSignup()');
    await page.waitForFunction('document.getElementById("auth-modal").style.display==="none"');
    expect(calls.length).toBe(1);
  });

  test('a duplicate email maps to the email-exists error', async ({ page }) => {
    await boot(page);
    await page.route(/\/rest\/v1\/rpc\/customer_signup/, (r) => r.fulfill({
      status: 409, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }),
    }));
    await fillSignup(page);
    await page.evaluate('doSignup()');
    const err = await page.locator('#auth-err').textContent();
    expect(err).toMatch(/already|مسجل|exists/i);
  });
});

test.describe('forgot password', () => {
  test('reset sends a normalized phone (leading 0 stripped) and logs in', async ({ page }) => {
    await boot(page);
    const calls = await captureRpc(page, 'customer_reset', [customer]);
    await page.evaluate('switchAuthMode("forgot")');
    await page.fill('#a-forgot-email', 'x@y.com');
    await page.fill('#a-forgot-phone', '0508727012');
    await page.press('#a-forgot-phone', 'Enter'); // Enter advances step 1
    await expect(page.locator('#a-reset-pwd')).toBeVisible();
    await page.fill('#a-reset-pwd', 'Zq8xTselah');
    await page.fill('#a-reset-pwd2', 'Zq8xTselah');
    await page.press('#a-reset-pwd2', 'Enter'); // Enter submits step 2
    await page.waitForFunction('document.getElementById("auth-modal").style.display==="none"');
    expect(calls[0].p_phone).toBe('+966508727012'); // was "+9660508727012" → could never match
    expect(await page.evaluate('S.loggedIn.id')).toBe('c9');
  });
});

test.describe('google complete-profile', () => {
  test('cancel signs out the pending Google session so the modal stops reappearing', async ({ page }) => {
    await boot(page);
    await page.evaluate('S._pendingGoogle={email:"g@x.com",name:"Gee User"};openGoogleComplete()');
    await expect(page.locator('#a-height')).toBeVisible();
    await page.locator('#auth-modal .btn-secondary').click(); // Cancel - Go Home
    await page.waitForFunction('document.getElementById("auth-modal").style.display==="none"');
    expect(await page.evaluate('S._pendingGoogle')).toBeNull();
  });

  test('finish validates then signs up once with the normalized phone', async ({ page }) => {
    await boot(page);
    const calls = await captureRpc(page, 'customer_oauth_signup', [{ session_token: 'gtok' }]);
    await page.evaluate('S._pendingGoogle={email:"g@x.com",name:"Gee User"};openGoogleComplete()');
    await page.evaluate('doCompleteGoogle()');
    await expect(page.locator('#auth-err')).not.toBeEmpty(); // gender required
    await page.evaluate('setSignupGender("female")');
    await page.fill('#a-height', '156');
    await page.fill('#a-phone', '0508727012');
    await page.evaluate('doCompleteGoogle();doCompleteGoogle()');
    await page.waitForFunction('document.getElementById("auth-modal").style.display==="none"');
    expect(calls.length).toBe(1); // double-tap guard
    expect(calls[0].p_phone).toBe('+966508727012');
    expect(await page.evaluate('S.loggedIn.session_token')).toBe('gtok');
  });
});

test('the auth modal renders every mode in Arabic with zero console errors', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await stubSupabase(page);
  await page.addInitScript(() => localStorage.setItem('cq_lang', 'ar'));
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`
    openAuthModal();
    switchAuthMode('signup');
    switchAuthMode('forgot');
    S.forgotStep=2; renderAuthModal();
    S._pendingGoogle={email:'g@x.com',name:'Gee'}; openGoogleComplete();
  `);
  expect(errs, errs.join('\n')).toEqual([]);
});
