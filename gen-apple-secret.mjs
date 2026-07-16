// Generates the Apple client secret (a signed JWT) that Supabase's Apple provider needs.
// Zero dependencies - plain Node crypto.
//
//   node gen-apple-secret.mjs /path/to/AuthKey_ABC123DEFG.p8 ABC123DEFG
//                                                    (p8 file)  (Key ID)
//
// Apple caps validity at 6 months - re-run this and update Supabase before it expires.
// NEVER commit the .p8 file or the generated secret to git.

import { readFileSync } from 'fs';
import { createPrivateKey, sign } from 'crypto';

const TEAM_ID = '72HK45WB4A';                    // Apple membership Team ID
const SERVICES_ID = 'sa.micromobility.rentals.web'; // the Services ID (web client id)

const [p8Path, keyId] = process.argv.slice(2);
if (!p8Path || !keyId) {
  console.error('Usage: node gen-apple-secret.mjs <AuthKey_XXXX.p8> <KEY_ID>');
  process.exit(1);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
const payload = b64url(JSON.stringify({
  iss: TEAM_ID,
  iat: now,
  exp: now + 180 * 24 * 3600, // 180 days (Apple max is ~6 months)
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
}));
const key = createPrivateKey(readFileSync(p8Path, 'utf8'));
// JWT ES256 needs the raw r||s signature form, not DER
const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
const jwt = `${header}.${payload}.${b64url(sig)}`;

console.log('\nApple client secret (paste into Supabase -> Auth -> Providers -> Apple -> Secret Key):\n');
console.log(jwt);
const expires = new Date((now + 180 * 24 * 3600) * 1000);
console.log(`\nExpires: ${expires.toDateString()} - set a reminder to regenerate before then.\n`);
