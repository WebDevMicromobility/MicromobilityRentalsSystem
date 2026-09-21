// Builds assets/phone-rules.json: for every calling code, the countries that use it and the
// shape of a valid MOBILE number there. The staff "Looks off" check reads it to tell a phone
// number that cannot exist (a digit short, a code that does not exist) from a real one.
//
// Source: Google's libphonenumber, as packaged by libphonenumber-js (metadata.mobile.json).
// It is not part of build:html - run it by hand when the rules need refreshing:
//
//   V=1.12.x   # the libphonenumber-js version to take
//   curl -sL -o /tmp/lpn.json "https://cdn.jsdelivr.net/npm/libphonenumber-js@$V/metadata.mobile.json"
//   node scripts/build-phone-rules.mjs /tmp/lpn.json $V
//
// then set PHONE_RULES_V in app.src.html to the same version, so a cached copy is replaced.
//
// Output: {"v":"<version>","codes":{"966":[["SA","<mobile pattern>",[9]]], ...}}. A pattern is
// the national number without the calling code, matched whole; lengths are its allowed digit
// counts (the country's own when the mobile entry has none).
import { readFileSync, writeFileSync } from 'node:fs';

const [src, version] = process.argv.slice(2);
if (!src || !version) {
  console.error('usage: node scripts/build-phone-rules.mjs <metadata.mobile.json> <libphonenumber-js version>');
  process.exit(1);
}
const meta = JSON.parse(readFileSync(src, 'utf8'));
if (meta.version !== 4) throw new Error(`unexpected metadata format ${meta.version} (this reader knows 4)`);
const codes = {};
for (const [iso, c] of Object.entries(meta.countries)) {
  const mobile = c[11] && c[11][1];
  if (!mobile) continue; // a territory with no mobile numbers of its own
  (codes[c[0]] ||= []).push([iso, mobile[0], mobile[1] || c[3]]);
}
const out = JSON.stringify({ v: version, codes });
writeFileSync(new URL('../assets/phone-rules.json', import.meta.url), out + '\n');
console.log(`phone-rules.json: ${Object.keys(codes).length} calling codes, ${out.length} bytes, libphonenumber-js ${version}`);
