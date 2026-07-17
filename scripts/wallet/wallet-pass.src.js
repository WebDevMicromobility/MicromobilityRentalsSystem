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
import { PASS_IMAGES } from './pass-images.js';

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
  // Client-resolved add-ons (display only — ownership is still verified below via the token).
  const addons = _cleanAddons(body && body.addons);
  // Booking group: all rider ids on this booking. Filtered against my_bookings below, so a
  // caller can only ever group their OWN bookings.
  const groupIds = Array.isArray(body && body.groupIds)
    ? body.groupIds.filter((x) => typeof x === 'string').slice(0, 50)
    : [];

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

  // The riders on this booking = the rows the client named, kept only if actually owned.
  let group = groupIds.length ? rows.filter((r) => groupIds.includes(r.id)) : [b];
  if (!group.some((r) => r.id === b.id)) group = [b];

  try {
    const pkpass = await buildPkpass(b, { p12b64, p12pw, passTypeId, teamId, addons, group });
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
  const group = (Array.isArray(cfg.group) && cfg.group.length) ? cfg.group : [b];
  const single = group.length === 1;
  const ref6 = b.id ? String(b.id).slice(0, 6) : '';
  const primaryNum = b.queue_num != null ? String(b.queue_num) : '';
  const barcodeMsg = ['MMC', primaryNum, ref6].filter(Boolean).join('-'); // matches the app scanner

  // All queue numbers on the booking, e.g. "#6" | "#6-#8" | "#6, #7, #9".
  const nums = group.map((r) => (r.queue_num != null ? Number(r.queue_num) : null))
    .filter((n) => n != null).sort((a, c) => a - c);
  const numsDisplay = _numsDisplay(nums) || `#${primaryNum}`;

  const when = `${b.session_day || ''} ${b.session_date || ''}`.trim();
  const shortWhen = _shortWhen(b.session_day, b.session_date); // "Sun 19 Jul" for the header (glance value)
  const time = b.session_time || '';                            // "9 PM - 11 PM"
  const dates = _sessionDates(b); // { start, end } ISO-8601 (Jeddah +03:00), or null if unparseable

  // Riders: a name for a solo booking, a count for a group.
  const ridersValue = single ? (b.name || '') : `${group.length} riders`;
  // Bike type: show it if everyone picked the same, else "Mixed".
  const types = [...new Set(group.map((r) => _bikeLabel(r.type_preference)).filter(Boolean))];
  const bikeType = types.length === 1 ? types[0] : (types.length > 1 ? 'Mixed' : '');

  // Total = every rider's rental (from the trusted rows) + all add-ons (client-resolved).
  const addons = Array.isArray(cfg.addons) ? cfg.addons : [];
  const rentalSum = group.reduce((s, r) =>
    s + ((r.price != null && r.price !== '' && !Number.isNaN(+r.price)) ? +r.price : 0), 0);
  const addonSum = addons.reduce((s, a) => s + (Number(a.p) || 0), 0);
  const grand = Math.round((rentalSum + addonSum) * 100) / 100;
  const priceStr = (rentalSum || addonSum) ? `SAR ${grand}` : '';

  // Best practice: keep secondary + auxiliary to ~4 fields total on an event ticket with a QR.
  const secondary = [];
  if (time) secondary.push({ key: 'time', label: 'TIME', value: time });
  if (ridersValue) secondary.push({ key: 'riders', label: single ? 'RIDER' : 'RIDERS', value: ridersValue });

  const auxiliary = [];
  if (bikeType) auxiliary.push({ key: 'bike', label: 'BIKE', value: bikeType });
  if (priceStr) auxiliary.push({ key: 'total', label: 'TOTAL', value: priceStr });

  // Back-of-pass rider list (only for a group) and add-on list.
  const ridersBack = single ? [] : [{
    key: 'riders_list', label: 'Riders',
    value: group.slice().sort((a, c) => (a.queue_num || 0) - (c.queue_num || 0))
      .map((r) => `#${r.queue_num} ${r.name || ''}${_bikeLabel(r.type_preference) ? ' - ' + _bikeLabel(r.type_preference) : ''}`.trim())
      .join('\n'),
  }];
  const addonsBack = addons.length
    ? [{ key: 'addons', label: 'Add-ons', value: addons.map((a) => `${a.n}${a.q > 1 ? ' x' + a.q : ''} - SAR ${a.p}`).join('\n') }]
    : [];

  const pass = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: String(b.id),
    organizationName: 'MicroMobility Rentals',
    description: `Booking ${numsDisplay} - Jeddah Corniche Circuit`,
    foregroundColor: 'rgb(242,245,242)',
    backgroundColor: 'rgb(7,9,11)',
    labelColor: 'rgb(0,229,133)',
    sharingProhibited: true,
    // Surface on the lock screen around the ride time, and grey out after it ends.
    ...(dates ? { relevantDate: dates.start, expirationDate: dates.end } : {}),
    barcodes: [{ format: 'PKBarcodeFormatQR', message: barcodeMsg, messageEncoding: 'iso-8859-1', altText: numsDisplay }],
    // keep the legacy single-barcode field too for older iOS
    barcode: { format: 'PKBarcodeFormatQR', message: barcodeMsg, messageEncoding: 'iso-8859-1', altText: numsDisplay },
    locations: [{ latitude: 21.6266, longitude: 39.1099, relevantText: 'Your ride is nearby - the Circuit is just ahead' }],
    // Semantic tags let iOS drive Live Activities, lock-screen relevance and the event guide.
    semantics: {
      eventName: 'Jeddah Corniche Circuit ride',
      venueName: 'Jeddah Corniche Circuit',
      venueLocation: { latitude: 21.6266, longitude: 39.1099 },
      eventType: 'PKEventTypeGeneric',
      ...(dates ? { eventStartDate: dates.start, eventEndDate: dates.end } : {}),
    },
    eventTicket: {
      // Header is the ONLY field visible when the pass is collapsed in the stack — put the
      // most useful glance value (the date) here so a rider can find this pass among others.
      headerFields: [{ key: 'date', label: 'SESSION', value: shortWhen || 'Circuit' }],
      primaryFields: [{ key: 'queue', label: single ? 'QUEUE' : 'QUEUE NUMBERS', value: numsDisplay }],
      secondaryFields: secondary,
      auxiliaryFields: auxiliary,
      backFields: [
        { key: 'when', label: 'Session', value: `${when}${time ? ' · ' + time : ''}`.trim() },
        { key: 'venue', label: 'Venue', value: 'Jeddah Corniche Circuit' },
        { key: 'directions', label: 'Directions', value: `<a href="${DIRECTIONS}">Open in Maps</a>` },
        ...ridersBack,
        ...addonsBack,
        { key: 'pay', label: 'Payment', value: 'Pay at the booth — cash, mada or STC Pay.' },
        { key: 'help', label: 'Good to know', value: 'Show this pass on arrival. Bikes are assigned first come, first served, so arrive a little early to get the type you picked.' },
        { key: 'ref', label: 'Reference', value: barcodeMsg },
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

// Render a sorted list of queue numbers compactly: [6] -> "#6", [6,7,8] -> "#6-#8"
// (consecutive), otherwise "#6, #7, #9".
function _numsDisplay(nums) {
  if (!nums || !nums.length) return '';
  if (nums.length === 1) return `#${nums[0]}`;
  const consecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  if (consecutive) return `#${nums[0]}-#${nums[nums.length - 1]}`;
  return nums.map((n) => `#${n}`).join(', ');
}

// Short glance date for the header, e.g. "Sunday" + "19 Jul 2026" -> "Sun 19 Jul".
function _shortWhen(day, date) {
  const d = String(day || '').trim().slice(0, 3);
  const dt = String(date || '').trim().replace(/\s*\d{4}\s*$/, ''); // drop the year
  return `${d} ${dt}`.trim();
}

// Parse the booking's date + time strings into ISO-8601 datetimes in Jeddah time (+03:00,
// Arabia Standard Time, no DST). Returns { start, end } or null if the strings can't be read.
// Built by hand (no Date parsing) so a locale quirk can never throw and break the pass.
const _MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function _sessionDates(b) {
  try {
    const md = String(b.session_date || '').match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
    if (!md) return null;
    const mo = _MONTHS[md[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    const day = +md[1], year = +md[3];
    const p2 = (n) => String(n).padStart(2, '0');
    const iso = (h, min) => `${year}-${p2(mo)}-${p2(day)}T${p2(h)}:${p2(min)}:00+03:00`;
    const parseT = (s) => {
      const t = s.match(/(\d{1,2})(?::(\d{2}))?\s*([AaPp])/);
      let h = +t[1]; const min = t[2] ? +t[2] : 0; const pm = /p/i.test(t[3]);
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
      return iso(h, min);
    };
    const times = String(b.session_time || '').match(/\d{1,2}(?::\d{2})?\s*[AaPp][Mm]/g) || [];
    const start = times.length ? parseT(times[0]) : iso(0, 0);
    const end = times.length >= 2 ? parseT(times[times.length - 1]) : iso(23, 59);
    return { start, end };
  } catch (e) {
    return null;
  }
}

// Sanitize the client-supplied add-on list: cap count and lengths, coerce types. This is
// display-only text (ownership is verified separately), so we just keep it sane and bounded.
function _cleanAddons(a) {
  if (!Array.isArray(a)) return [];
  return a.slice(0, 20).map((x) => ({
    n: String((x && x.n) || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    q: Math.max(1, Math.min(99, parseInt(x && x.q, 10) || 1)),
    p: Math.max(0, Math.min(100000, Math.round((Number(x && x.p) || 0) * 100) / 100)),
  })).filter((x) => x.n);
}

// Friendly bike-type label for the pass (matches the app's wording).
function _bikeLabel(t) {
  const k = String(t || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const map = {
    road: 'Road', hybrid: 'Hybrid', mountain: 'Mountain', gravel: 'Gravel',
    any: 'Any', roadcarbon: 'Road Carbon',
  };
  if (map[k]) return map[k];
  const s = String(t || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
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
