import type { Page } from '@playwright/test';

// Table rows are arrays; 'rpc:<name>' is the RPC's return; 'auth:token' is a
// Supabase Auth session object — so values are broader than arrays.
export type Fixtures = Record<string, unknown>;

// Intercepts every request to *.supabase.co so tests never touch the real
// database. GETs return the fixture rows for the table (default: empty),
// writes are echoed back as if they succeeded. RPCs answer with the fixture
// under 'rpc:<name>'; Auth password sign-in answers with 'auth:token'.
export async function stubSupabase(page: Page, fixtures: Fixtures = {}) {
  // SECURE_AUTH defaults ON in production; pin open mode for the stubbed suite
  // unless a spec explicitly opts into secure mode after this (secureOn sets '1').
  await page.addInitScript(() => localStorage.setItem('cq_secure_auth', '0'));
  // Disable the boot's background "widen" refresh so it can't overwrite state a test sets.
  await page.addInitScript(() => { (window as unknown as { __noWiden?: boolean }).__noWiden = true; });
  await page.route('**://*.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 200, headers: cors() });
    }

    const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
    if (rpc) {
      const body = (fixtures as Record<string, unknown>)[`rpc:${rpc[1]}`];
      return route.fulfill({
        status: 200,
        headers: { ...cors(), 'content-type': 'application/json' },
        body: JSON.stringify(body === undefined ? [] : body),
      });
    }

    if (url.pathname.includes('/auth/v1/token')) {
      const session = (fixtures as Record<string, unknown>)['auth:token'];
      return session
        ? route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify(session) })
        : route.fulfill({ status: 400, headers: { ...cors(), 'content-type': 'application/json' }, body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
    }
    if (url.pathname.includes('/auth/v1/')) {
      return route.fulfill({ status: 200, headers: { ...cors(), 'content-type': 'application/json' }, body: '{}' });
    }

    const m = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = m ? m[1] : null;

    if (method === 'GET' || method === 'HEAD') {
      const rows = ((table && fixtures[table]) || []) as unknown[];
      return route.fulfill({
        status: 200,
        headers: { ...cors(), 'content-type': 'application/json', 'content-range': `0-${rows.length}/${rows.length}` },
        body: JSON.stringify(rows),
      });
    }

    // POST/PATCH/DELETE: pretend it worked, echo the payload back.
    let body: unknown = [];
    try {
      const sent = req.postDataJSON();
      body = Array.isArray(sent) ? sent : [sent];
    } catch { /* non-JSON body */ }
    return route.fulfill({
      status: method === 'POST' ? 201 : 200,
      headers: { ...cors(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
  };
}

// Unlocks the staff panel locally, exactly like a successful PIN entry does.
export async function unlockStaff(page: Page) {
  await page.addInitScript(() => localStorage.setItem('cq_staff', '1'));
}

// Signs a customer in locally, exactly like a remembered login session does.
export async function loginCustomer(page: Page, cust: Record<string, unknown> = {}) {
  const c = { id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', ...cust };
  await page.addInitScript((session) => localStorage.setItem('cq_session', session), JSON.stringify(c));
}

// Wait until the app is ready: the Supabase client (sb) is built AND a data load has
// FULLY completed. loadData() flips S.dataLoaded (first paint) before it fetches the
// trailing cashier_sales, so waiting on dataLoaded alone lets a test inject state that the
// late fetch then clobbers. _lastLoadOk is set only after the whole load finishes, so it's
// the race-free signal. (Falls back to dataLoaded if _lastLoadOk isn't defined.)
export async function waitForSb(page: Page) {
  await page.waitForFunction(
    'typeof sb !== "undefined" && !!sb && typeof S !== "undefined" && !!S.dataLoaded' +
      ' && (typeof _lastLoadOk === "undefined" || _lastLoadOk === true)',
    undefined,
    { timeout: 10000 },
  );
}
