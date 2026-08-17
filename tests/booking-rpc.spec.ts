import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb, captureBookingRows } from './helpers/supabase';

// Customer bookings go through customer_create_booking, a SECURITY DEFINER RPC that inserts
// and returns the rows. That is the whole reason queue_entries can stop being world-readable:
// `.insert().select()` gets its rows via RETURNING, which applies SELECT policies, so dropping
// `public read` broke booking outright in August. These pin the three behaviours the switch
// depends on — use the RPC, fall back only when it is genuinely absent, and never swallow a
// refusal (a refusal that fell back to a direct insert would bypass every server-side check).

const sessions = [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }];
const bikes = [{ id: 'b1', name: 'B1', size: 'M', type: 'Road', status: 'available', rental_price: 75 }];

const book = (page: import('@playwright/test').Page) => page.evaluate(
  `S.selSession='s1'; S.regQty=1; S.regBikeHeights=[175]; S.regBikeTypes=['Road'];
   S.regRiderNames=['Spec Rider']; S.promoApplied=null; submitReg();`,
);

/** Records which transport each booking attempt used. */
async function watchTransport(page: import('@playwright/test').Page) {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'POST') return;
    const u = r.url();
    if (u.includes('/rpc/customer_create_booking')) seen.push('rpc');
    else if (u.includes('/rest/v1/queue_entries')) seen.push('insert');
  });
  return seen;
}

test.describe('booking goes through the RPC', () => {
  test('a normal booking uses the RPC and never inserts directly', async ({ page }) => {
    await stubSupabase(page, { sessions, bikes, queue_entries: [] });
    await loginCustomer(page, { id: 'c1' });
    await page.goto('/');
    await waitForSb(page);
    const seen = await watchTransport(page);
    const rows = await captureBookingRows(page);

    await book(page);
    await expect.poll(() => rows.length).toBe(1);
    expect(seen).toContain('rpc');
    expect(seen).not.toContain('insert'); // the direct path is what RETURNING made unusable
  });

  test('the RPC carries the caller token, so the server can derive the owner', async ({ page }) => {
    await stubSupabase(page, { sessions, bikes, queue_entries: [] });
    await loginCustomer(page, { id: 'c1', session_token: 'tok-spec' });
    await page.goto('/');
    await waitForSb(page);

    let body: Record<string, unknown> | null = null;
    await page.route(/\/rpc\/customer_create_booking/, async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify([{ id: 'x', queue_num: 3, status: 'waiting', waitlist_num: null, price: 75 }]),
      });
    });

    await book(page);
    await expect.poll(() => body !== null).toBe(true);
    expect(body!.p_id).toBe('c1');
    expect(body!.p_token).toBe('tok-spec');
    expect(Array.isArray(body!.p_entries)).toBe(true);
  });

  test('the queue number and status the server returns win over what the client guessed', async ({ page }) => {
    await stubSupabase(page, { sessions, bikes, queue_entries: [] });
    await loginCustomer(page, { id: 'c1' });
    await page.goto('/');
    await waitForSb(page);

    // The DB assigns the number atomically and may coerce a full session to waitlist. The
    // client's guess must lose — that is why the row has to come back at all.
    await page.route(/\/rpc\/customer_create_booking/, async (route) => route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify([{ id: 'srv', queue_num: 99, status: 'waitlist', waitlist_num: 4, price: 75 }]),
    }));

    await book(page);
    await expect.poll(() => page.evaluate('(S.lastTickets||[]).length')).toBeGreaterThan(0);
    const t = await page.evaluate('S.lastTickets[0]') as { queueNum: number; status: string };
    expect(t.queueNum).toBe(99);
    expect(t.status).toBe('waitlist');
  });
});

test.describe('the fallback is narrow on purpose', () => {
  test('a database without the RPC falls back to a direct insert', async ({ page }) => {
    await stubSupabase(page, { sessions, bikes, queue_entries: [] });
    await loginCustomer(page, { id: 'c1' });
    await page.goto('/');
    await waitForSb(page);
    const seen = await watchTransport(page);
    const rows = await captureBookingRows(page, { rpcMissing: true });

    await book(page);
    await expect.poll(() => rows.length).toBe(1);
    expect(seen).toContain('rpc');    // tried
    expect(seen).toContain('insert'); // then fell back, so a deploy in either order is safe
  });

  test('a refusal is surfaced, not quietly retried as a direct insert', async ({ page }) => {
    await stubSupabase(page, { sessions, bikes, queue_entries: [] });
    await loginCustomer(page, { id: 'c1' });
    await page.goto('/');
    await waitForSb(page);
    const seen = await watchTransport(page);

    // An RLS denial, a bad token, a closed session — anything other than "no such function".
    // Falling back here would route around every check the RPC exists to enforce.
    await page.route(/\/rpc\/customer_create_booking/, async (route) => route.fulfill({
      status: 403,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' }),
    }));

    await book(page);
    await page.waitForTimeout(600);
    expect(seen).toContain('rpc');
    expect(seen).not.toContain('insert');
  });

  test('an empty result counts as a refusal, because the RPC returns a row per rider', async ({ page }) => {
    await stubSupabase(page, { sessions, bikes, queue_entries: [] });
    await loginCustomer(page, { id: 'c1' });
    await page.goto('/');
    await waitForSb(page);
    const seen = await watchTransport(page);

    // The RPC returns nothing when the token fails or the session is closed. Treating that
    // as "maybe the function is missing" would hand those cases to the direct insert.
    await page.route(/\/rpc\/customer_create_booking/, async (route) => route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: '[]',
    }));

    await book(page);
    await page.waitForTimeout(600);
    expect(seen).not.toContain('insert');
  });
});
