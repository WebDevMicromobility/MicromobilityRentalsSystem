// Generates a signed Apple Wallet pass (.pkpass) for a booking.
//
// Activates only when the Pass Type certificate is configured as Cloudflare Pages env vars
// (see below); until then it returns 501 and the client hides the "Add to Apple Wallet"
// button. Safe to deploy before the cert exists.
//
// Required env vars (Cloudflare Pages -> Settings -> Environment variables, encrypted):
//   APPLE_PASS_P12_BASE64   - the Pass Type ID cert exported from Keychain as .p12, base64-encoded
//   APPLE_PASS_P12_PASSWORD - the password you set on that .p12 export
//   APPLE_PASS_TYPE_ID      - e.g. pass.sa.micromobility.booking
//   APPLE_TEAM_ID           - 72HK45WB4A
//   SUPABASE_ANON_KEY       - already set for the other functions
//
// Security: never trusts client-supplied booking data. It re-reads the booking through the
// token-checked my_bookings RPC using the caller's own customer id + session token, so a user
// can only ever mint a pass for a booking they actually own.

import forge from 'node-forge';
import { zipSync } from 'fflate';
import { PASS_IMAGES } from './_pass-images.js';

const SUPA_DEFAULT = 'https://amyqxovbnlreassrqihr.supabase.co';
const DIRECTIONS = 'https://maps.app.goo.gl/zJLjmiaJgfJDKQwY7';

export async function onRequestPost(context) {
  const { request, env } = context;

  const p12b64 = env.APPLE_PASS_P12_BASE64;
  const p12pw = env.APPLE_PASS_P12_PASSWORD || '';
  const passTypeId = env.APPLE_PASS_TYPE_ID;
  const teamId = env.APPLE_TEAM_ID;
  if (!p12b64 || !passTypeId || !teamId) {
    return json({ ok: false, skipped: 'wallet not configured' }, 501);
  }

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad body' }, 400); }
  const { customerId, token, bookingId } = body || {};
  if (!customerId || !token || !bookingId) return json({ ok: false, error: 'missing fields' }, 400);

  const SUPA = env.SUPABASE_URL || SUPA_DEFAULT;
  const ANON = env.SUPABASE_ANON_KEY;
  if (!ANON) return json({ ok: false, error: 'no anon key' }, 500);

  // Verify ownership + fetch the real booking (token-checked RPC).
  const rpc = await fetch(`${SUPA}/rest/v1/rpc/my_bookings`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: customerId, p_token: token }),
  });
  if (!rpc.ok) return json({ ok: false, error: 'lookup failed' }, 502);
  const rows = await rpc.json();
  const b = Array.isArray(rows) ? rows.find((r) => r.id === bookingId) : null;
  if (!b) return json({ ok: false, error: 'not found' }, 404);

  try {
    const pkpass = await buildPkpass(b, { p12b64, p12pw, passTypeId, teamId });
    return new Response(pkpass, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="booking-${b.queue_num}.pkpass"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return json({ ok: false, error: 'sign failed: ' + (e && e.message) }, 500);
  }
}

async function buildPkpass(b, cfg) {
  const num = b.queue_num != null ? String(b.queue_num) : '';
  const ref6 = b.id ? String(b.id).slice(0, 6) : '';
  const barcodeMsg = ['MMC', num, ref6].filter(Boolean).join('-'); // matches the app scanner
  const when = `${b.session_day || ''} ${b.session_date || ''}`.trim();
  const time = b.session_time || '';
  const frame = b.size || '';

  const pass = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: String(b.id),
    organizationName: 'MicroMobility Rentals',
    description: `Booking #${num} — Jeddah Corniche Circuit`,
    foregroundColor: 'rgb(242,245,242)',
    backgroundColor: 'rgb(8,9,11)',
    labelColor: 'rgb(0,229,133)',
    logoText: 'MicroMobility',
    barcodes: [{ format: 'PKBarcodeFormatQR', message: barcodeMsg, messageEncoding: 'iso-8859-1', altText: `#${num}` }],
    // keep the legacy single-barcode field too for older iOS
    barcode: { format: 'PKBarcodeFormatQR', message: barcodeMsg, messageEncoding: 'iso-8859-1', altText: `#${num}` },
    locations: [{ latitude: 21.6266, longitude: 39.1099, relevantText: 'Your ride is nearby — head to Gate A' }],
    eventTicket: {
      headerFields: [{ key: 'queue', label: 'QUEUE #', value: `#${num}` }],
      primaryFields: [{ key: 'session', label: 'SESSION', value: when || 'Jeddah Corniche Circuit' }],
      secondaryFields: [
        { key: 'time', label: 'TIME', value: time || '—' },
        { key: 'rider', label: 'RIDER', value: b.name || '—' },
      ],
      auxiliaryFields: [
        { key: 'frame', label: 'FRAME', value: frame || '—' },
        { key: 'gate', label: 'GATE', value: 'A' },
      ],
      backFields: [
        { key: 'venue', label: 'Venue', value: 'Jeddah Corniche Circuit, Gate A' },
        { key: 'directions', label: 'Directions', value: DIRECTIONS },
        { key: 'pay', label: 'Payment', value: 'Pay at the booth — cash, mada or STC Pay.' },
        { key: 'help', label: 'Note', value: 'Show this pass at Gate A. Bikes are assigned first come, first served.' },
      ],
    },
  };

  // Assemble the bundle: pass.json + images, then manifest (SHA-1 of each), then signature.
  const files = {};
  files['pass.json'] = strBytes(JSON.stringify(pass));
  for (const [name, b64] of Object.entries(PASS_IMAGES)) files[name] = b64Bytes(b64);

  const manifest = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = sha1hex(bytes);
  const manifestStr = JSON.stringify(manifest);
  files['manifest.json'] = strBytes(manifestStr);

  const wwdrPem = await getWWDR(); // Apple intermediate, fetched + cached
  files['signature'] = signManifest(manifestStr, cfg.p12b64, cfg.p12pw, wwdrPem);

  return zipSync(files, { level: 6 });
}

// ── crypto helpers (node-forge, pure JS — works in the Workers runtime) ──
function sha1hex(bytes) {
  const md = forge.md.sha1.create();
  md.update(forge.util.createBuffer(bytes).getBytes());
  return md.digest().toHex();
}

function _seedForge() {
  try {
    const src = (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : (typeof crypto !== 'undefined' ? crypto : null);
    if (!src || !src.getRandomValues) return;
    const seedSync = (needed) => {
      const b = new Uint8Array(needed || 32); src.getRandomValues(b);
      let out = ''; for (let i = 0; i < b.length; i++) out += String.fromCharCode(b[i]); return out;
    };
    forge.random.seedFileSync = seedSync;
    forge.random.seedFile = (needed, cb) => cb(null, seedSync(needed));
    // top up the entropy pools immediately so the first sign never blocks on a seed file
    forge.random.collect(seedSync(32));
  } catch (e) { /* best-effort */ }
}
function signManifest(manifestStr, p12b64, pw, wwdrPem) {
  _seedForge();
  const der = forge.util.decode64(p12b64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, pw);
  let key = null, cert = null;
  for (const sc of p12.safeContents) for (const bag of sc.safeBags) {
    if (bag.key) key = bag.key;
    if (bag.cert && !cert) cert = bag.cert;
  }
  if (!key || !cert) throw new Error('p12 missing key or cert');
  const wwdr = forge.pki.certificateFromPem(wwdrPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestStr, 'utf8');
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime },
    ],
  });
  p7.sign({ detached: true });
  const derSig = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return binStrToBytes(derSig);
}

// Apple WWDR G4 intermediate — required in the signature chain. Fetched from Apple's CA
// (DER) and cached for the isolate's lifetime; converted to PEM for forge.
let _wwdrPem = null;
async function getWWDR() {
  if (_wwdrPem) return _wwdrPem;
  const res = await fetch('https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer');
  if (!res.ok) throw new Error('WWDR fetch failed');
  const der = new Uint8Array(await res.arrayBuffer());
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(binFromBytes(der)));
  const cert = forge.pki.certificateFromAsn1(asn1);
  _wwdrPem = forge.pki.certificateToPem(cert);
  return _wwdrPem;
}

// ── byte helpers ──
function strBytes(s) { return new TextEncoder().encode(s); }
function b64Bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function binStrToBytes(bin) {
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
  return out;
}
function binFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
