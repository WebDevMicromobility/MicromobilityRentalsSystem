import type { Page } from '@playwright/test';

// Table rows are arrays; 'rpc:<name>' is the RPC's return; 'auth:token' is a
// Supabase Auth session object — so values are broader than arrays.
export type Fixtures = Record<string, unknown>;

/** A write failure the stub should inject, so specs can reach the error branches.
 *  `table` limits it to one table (default: every write); `methods` to POST/PATCH/DELETE.
 *  `once` fails the first matching write only, which is how you test a retry succeeding. */
export type FailWrite = {
  table?: string;
  methods?: string[];
  once?: boolean;
  status?: number;
  code?: string;
  message?: string;
};

// Intercepts every request to *.supabase.co so tests never touch the real
// database. GETs return the fixture rows for the table (default: empty),
// writes are echoed back as if they succeeded. RPCs answer with the fixture
// under 'rpc:<name>'; Auth password sign-in answers with 'auth:token'.
export async function stubSupabase(page: Page, fixtures: Fixtures = {}, failWrite?: FailWrite) {
  let failsLeft = failWrite ? (failWrite.once ? 1 : Infinity) : 0;
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
      let body = (fixtures as Record<string, unknown>)[`rpc:${rpc[1]}`];
      // An `rpc:<name>` fixture of { __rpcError: {...} } answers with a PostgREST error
      // instead of rows. Needed to cover the two branches a client has to tell apart: a
      // function that is missing (fall back) and one that refused (surface it).
      if (body && typeof body === 'object' && '__rpcError' in (body as Record<string, unknown>)) {
        const e = (body as { __rpcError: Record<string, unknown> }).__rpcError;
        return route.fulfill({
          status: Number(e.status) || 404,
          headers: { ...cors(), 'content-type': 'application/json' },
          body: JSON.stringify({ code: e.code, message: e.message, details: null, hint: null }),
        });
      }
      // list_sessions is how customers read sessions since tag-gated events: the real RPC
      // returns the sessions table (public rows + tagged ones), so default it to the
      // sessions fixture unless a spec overrides it explicitly.
      if (body === undefined && rpc[1] === 'list_sessions') body = fixtures['sessions'] || [];
      // Customer bookings go through customer_create_booking, which returns one row per
      // rider. Left to the generic `[]` default it would read as a refusal and every spec
      // that books through the UI would fail, so echo the rows back the way the real
      // function does. A spec that cares about the server overriding the client's guess
      // stubs `rpc:customer_create_booking` explicitly.
      if (body === undefined && rpc[1] === 'customer_create_booking') {
        let sent: { p_entries?: Record<string, unknown>[] } = {};
        try { sent = req.postDataJSON(); } catch { /* no body */ }
        body = (sent?.p_entries ?? []).map((r) => ({
          id: r.id, queue_num: r.queue_num, status: r.status,
          waitlist_num: r.waitlist_num ?? null, price: r.price,
        }));
      }
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

    // Injected write failure. Without this the stub answers 2xx to every write, so ~60% of
    // the app's save paths — the ones with no error check — look identical to working code
    // in the suite, and RLS denials are unreachable in a test.
    if (
      failWrite && failsLeft > 0 &&
      (!failWrite.table || failWrite.table === table) &&
      (!failWrite.methods || failWrite.methods.includes(method))
    ) {
      failsLeft--;
      return route.fulfill({
        status: failWrite.status ?? 403,
        headers: { ...cors(), 'content-type': 'application/json' },
        body: JSON.stringify({
          code: failWrite.code ?? '42501',
          message: failWrite.message ?? 'new row violates row-level security policy',
        }),
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

/** The booking rows the client sent, whichever door it used.
 *
 *  Customer bookings go through the customer_create_booking RPC (so the row can come back
 *  without SELECT on queue_entries); staff paths still insert directly. Specs care about
 *  what was sent, not which transport carried it, so this captures both and answers with
 *  rows shaped the way each caller expects.
 *
 *  Pass `rpcMissing` to simulate a database that predates the RPC, which must make the
 *  client fall back to a direct insert. */
export async function captureBookingRows(page: Page, opts: { rpcMissing?: boolean } = {}) {
  const rows: Record<string, unknown>[] = [];
  const head = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };

  await page.route(/\/rest\/v1\/rpc\/customer_create_booking/, async (route) => {
    if (opts.rpcMissing) {
      return route.fulfill({
        status: 404, headers: head,
        body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.customer_create_booking' }),
      });
    }
    const sent = route.request().postDataJSON() as { p_entries?: Record<string, unknown>[] };
    const entries = sent?.p_entries ?? [];
    entries.forEach((r) => rows.push(r));
    // Echo the shape the real RPC returns, so the client's queue-number sync has something
    // to read back. queue_num is passed through rather than invented, since specs assert it.
    return route.fulfill({
      status: 200, headers: head,
      body: JSON.stringify(entries.map((r) => ({
        id: r.id, queue_num: r.queue_num, status: r.status,
        waitlist_num: r.waitlist_num ?? null, price: r.price,
      }))),
    });
  });

  await page.route(/\/rest\/v1\/queue_entries/, async (route) => {
    if (route.request().method() === 'POST') {
      const b = route.request().postDataJSON();
      (Array.isArray(b) ? b : [b]).forEach((r: Record<string, unknown>) => rows.push(r));
    }
    return route.fulfill({ status: 201, headers: head, body: '[]' });
  });

  return rows;
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
  };
}

// Unlocks the staff panel locally, exactly like a successful PIN entry does.
// Also names the operator: the op-gate modal blocks the staff view until a name is set
// (every logged action carries who did it), and specs act as "Spec Staff".
export async function unlockStaff(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cq_staff', '1');
    localStorage.setItem('cq_op_name', 'Spec Staff');
  });
}

// Signs a customer in locally, exactly like a remembered login session does.
// session_token is required: customer flows always use the token RPCs (CUST_RPC), and a
// remembered session without a token is dropped at getSession() to force a fresh login.
export async function loginCustomer(page: Page, cust: Record<string, unknown> = {}) {
  const c = { id: 'c1', name: 'Spec Rider', email: 'spec@example.com', phone: '0500000001', session_token: 'tok-spec', ...cust };
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
