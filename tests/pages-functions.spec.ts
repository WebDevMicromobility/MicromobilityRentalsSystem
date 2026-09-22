import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

// The Pages Functions never run under the suite's test server (python -m http.server), so a
// middleware rule that 404s an app asset, or a Wallet pass that is wrong on the phone, only ever
// showed in production. These call the functions directly, the way Cloudflare does, with the
// network stubbed. Each test imports a fresh copy (?n=) so module-level state does not leak.

type Ctx = { request: Request; env?: Record<string, string>; next?: () => Response };
type Fn = (ctx: Ctx) => Promise<Response>;
let seq = 0;
async function load(rel: string, name: string): Promise<Fn> {
  const url = pathToFileURL(resolve(__dirname, '..', rel)).href + '?n=' + ++seq;
  const mod = await import(url);
  return mod[name] as Fn;
}

test.describe('the middleware', () => {
  const status = async (path: string) => {
    const onRequest = await load('functions/_middleware.js', 'onRequest');
    const res = await onRequest({ request: new Request('https://site.test' + path), next: () => new Response('asset') });
    return res.status;
  };

  test('serves the phone-number rules the "Looks off" check reads', async () => {
    // Blocked with the configs, production answered it 404 and every phone passed the check.
    expect(await status('/assets/phone-rules.json?v=1.13.13')).toBe(200);
    for (const ok of ['/', '/manifest.json', '/lang/ar.json', '/cities/sa.json', '/assets/tag-jcc.svg', '/staff/', '/.well-known/security.txt'])
      expect(await status(ok), ok).toBe(200);
  });

  test('still hides configs, sources and local databases, at any depth', async () => {
    for (const hidden of [
      '/assets/other.json', '/package.json', '/AGENTS.md', '/app.src.html', '/tests/x.png', '/scripts/deploy-now.sh',
      '/functions/api/wallet-pass.js', '/design_handoff_erp_reskin/a.html', '/.gitignore',
      // wrangler's dev state is tracked in git: the dotfile rule only read the LAST segment.
      '/.wrangler/state/v3/cache/miniflare-CacheObject/metadata.sqlite',
      '/.wrangler/state/v3/observability/x/metadata.sqlite-wal',
      '/assets/.cache/thing.png', '/data/app.db', '/x.sqlite-shm', '/%2Ewrangler/state/a.txt',
    ]) expect(await status(hidden), hidden).toBe(404);
  });
});

test.describe('the error ping to Discord', () => {
  const site = 'https://site.test';
  async function ping(onRequestPost: Fn, body: unknown, headers: Record<string, string> = {}) {
    return onRequestPost({
      request: new Request(site + '/api/log-error', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: site, 'cf-connecting-ip': '198.51.100.1', ...headers },
        body: JSON.stringify(body),
      }),
      env: { DISCORD_WEBHOOK: 'https://discord.test/hook' },
    });
  }
  let sent: { content: string; allowed_mentions?: { parse: string[] } }[] = [];
  const realFetch = globalThis.fetch;
  test.beforeEach(() => {
    sent = [];
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => { sent.push(JSON.parse(String(init?.body))); return new Response('{}'); }) as typeof fetch;
  });
  test.afterEach(() => { globalThis.fetch = realFetch; });

  test('cannot ping the channel or break out of its code blocks', async () => {
    const post = await load('functions/api/log-error.js', 'onRequestPost');
    const res = await ping(post, { msg: 'boom\n```\n@everyone look', src: 'a`b', ua: '@here <@123>' });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].allowed_mentions).toEqual({ parse: [] });
    expect(sent[0].content).not.toMatch(/@(everyone|here)|<@123>/);
    expect(sent[0].content.match(/```/g)).toHaveLength(2); // only the block the function opens and closes
  });

  test('one sender posting junk does not silence another sender', async () => {
    const post = await load('functions/api/log-error.js', 'onRequestPost');
    await ping(post, { msg: 'junk' });
    expect(await (await ping(post, { msg: 'junk again' })).json()).toMatchObject({ skipped: 'throttled' });
    await ping(post, { msg: 'a real error' }, { 'cf-connecting-ip': '203.0.113.9' });
    expect(sent.map((s) => s.content.includes('a real error'))).toEqual([false, true]);
  });

  test('forwards nothing that did not come from the site itself', async () => {
    const post = await load('functions/api/log-error.js', 'onRequestPost');
    const res = await ping(post, { msg: 'x' }, { origin: 'https://evil.test' });
    expect(res.status).toBe(403);
    expect(await res.json()).toHaveProperty('ok', false); // still a function's JSON answer: CI's probe reads it
    expect(sent).toHaveLength(0);
  });
});

test.describe('the Apple Wallet pass', () => {
  // A throwaway signing identity: node-forge (a dev dependency) makes a key, a self-signed
  // certificate standing in for both the pass certificate and Apple's WWDR one, and the .p12.
  let p12b64 = '', wwdrDer = new Uint8Array();
  test.beforeAll(async () => {
    const forge = (await import('node-forge' as string)).default;
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date(Date.now() - 864e5);
    cert.validity.notAfter = new Date(Date.now() + 864e5);
    const attrs = [{ name: 'commonName', value: 'Pass Test' }];
    cert.setSubject(attrs); cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'pw', { algorithm: '3des' });
    p12b64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());
    wwdrDer = Uint8Array.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), (c: string) => c.charCodeAt(0));
  });

  const booking = { id: 'abcdef123456', session_id: 's1', session_date: '2026-09-23', session_day: 'Wednesday', queue_num: 7, name: 'Rider', status: 'waiting', approval: null as string | null, price: 50 };
  const circuit = { id: 's1', event_kind: 'rental', ride_kind: null as string | null, bike_slots: JSON.stringify({ _time: '21:00 - 23:00' }), meet_url: null as string | null, needs_approval: false, hide_queue: false };
  const realFetch = globalThis.fetch;
  let sessionUrls: string[] = [];
  test.afterEach(() => { globalThis.fetch = realFetch; });

  async function pass(b: typeof booking, sess: Record<string, unknown> | null, pw = 'pw') {
    sessionUrls = [];
    globalThis.fetch = (async (u: string | URL | Request) => {
      const url = String(u);
      if (url.includes('/rpc/my_bookings')) return new Response(JSON.stringify([b]));
      if (url.includes('/rpc/list_sessions')) { sessionUrls.push(url); return new Response(JSON.stringify(sess ? [sess] : [])); }
      if (url.includes('apple.com')) return new Response(wwdrDer);
      return new Response('', { status: 404 });
    }) as typeof fetch;
    const post = await load('functions/api/wallet-pass.js', 'onRequestPost');
    const res = await post({
      request: new Request('https://site.test/api/wallet-pass', { method: 'POST', body: JSON.stringify({ customerId: 'c1', token: 't', bookingId: b.id }) }),
      env: { APPLE_PASS_P12_BASE64: p12b64, APPLE_PASS_P12_PASSWORD: pw, APPLE_PASS_TYPE_ID: 'pass.test', APPLE_TEAM_ID: 'TEAM', SUPABASE_ANON_KEY: 'anon', SUPABASE_URL: 'https://db.test' },
    });
    if (res.headers.get('content-type') !== 'application/vnd.apple.pkpass') return { status: res.status, body: await res.json(), json: null };
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    return { status: res.status, body: null, json: JSON.parse(strFromU8(files['pass.json'])) };
  }

  test('a ride that ends at midnight or later expires the next day, not before it starts', async () => {
    const { json } = await pass(booking, { ...circuit, bike_slots: JSON.stringify({ _time: '21:00 - 00:30' }) });
    expect(json.semantics.eventStartDate).toBe('2026-09-23T21:00:00+03:00');
    expect(json.expirationDate).toBe('2026-09-24T00:30:00+03:00');
    expect(json.relevantDate).toBe('2026-09-23T20:15:00+03:00');
    // Asking for the one session, not every session ever run.
    expect(sessionUrls[0]).toContain('/rpc/list_sessions?id=eq.s1');
  });

  test('the directions link is a link, and the circuit is where the circuit ride meets', async () => {
    const { json } = await pass(booking, circuit);
    const dir = json.eventTicket.backFields.find((f: { key: string }) => f.key === 'directions');
    expect(dir.value).toMatch(/^https:\/\//);
    expect(dir.attributedValue).toBe(`<a href="${dir.value}">Open in Maps</a>`);
    expect(json.locations[0]).toMatchObject({ latitude: 21.6266, longitude: 39.1099 });
    expect(json.barcodes[0].message).toBe('MMC-7-abcdef');
  });

  test('a ride that meets elsewhere is placed there, or not at all', async () => {
    const pool = { ...circuit, event_kind: 'community', ride_kind: 'swim', needs_approval: false };
    const pinned = await pass(booking, { ...pool, meet_url: 'https://www.google.com/maps/place/Pool/@21.5433,39.1728,17z' });
    expect(pinned.json.locations[0]).toMatchObject({ latitude: 21.5433, longitude: 39.1728 });
    expect(pinned.json.locations[0].relevantText).not.toContain('Circuit');
    const short = await pass(booking, { ...pool, meet_url: 'https://maps.app.goo.gl/abc123' });
    expect(short.json.locations).toBeUndefined();
    expect(short.json.semantics.venueLocation).toBeUndefined();
  });

  test('a ride staff approve issues a pass only once approved and published, and never with its number in the QR', async () => {
    const sat = { ...circuit, event_kind: 'community', ride_kind: null, needs_approval: true, hide_queue: false, bike_slots: JSON.stringify({ _time: '05:30 - 06:00' }) };
    expect((await pass({ ...booking, approval: 'pending' }, sat)).status).toBe(409);
    expect((await pass({ ...booking, approval: 'approved' }, { ...sat, hide_queue: true })).status).toBe(409);
    expect((await pass({ ...booking, approval: 'approved' }, null)).status).toBe(503); // cannot be checked
    const ok = await pass({ ...booking, approval: 'approved' }, sat);
    expect(ok.status).toBe(200);
    expect(ok.json.barcodes[0].message).toBe('MMC-abcdef');
    expect(ok.json.barcode.message).toBe('MMC-abcdef');
  });

  test('a signing failure tells the rider nothing about the certificate', async () => {
    const res = await pass(booking, circuit, 'wrong password');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'sign failed' });
  });
});
