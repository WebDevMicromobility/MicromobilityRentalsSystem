// Checks that every language the site speaks carries every string, and nothing else.
// English and Arabic live inline in app.src.html (const LANG={...}); the other packs are
// i18n/<code>.json. The set of languages is read from LANGS in app.src.html, so adding a
// language there without a pack fails here, in CI, rather than falling back to English
// silently at runtime.
//
// Per language: no missing key, no extra key, no empty value, and the same {n}
// placeholders as English (a translation that drops {0} would print nothing where the
// number goes).
//
// Usage: node scripts/check-i18n.mjs   (exit 1 on any problem)
import { readFileSync, existsSync } from 'node:fs';

const SRC = new URL('../app.src.html', import.meta.url);
const html = readFileSync(SRC, 'utf8');

function objectAt(text, marker) {
  const start = text.indexOf(marker);
  if (start === -1) {
    console.error(`check-i18n: could not find \`${marker}\` in app.src.html`);
    process.exit(1);
  }
  // Scan from the opening bracket to its match, ignoring brackets inside string literals
  // (placeholders like '{0}' appear in values).
  const open = text[start + marker.length - 1];
  const close = open === '[' ? ']' : '}';
  let i = start + marker.length - 1;
  const objStart = i;
  let depth = 0;
  let quote = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) {
    console.error(`check-i18n: unbalanced brackets while scanning ${marker}`);
    process.exit(1);
  }
  try {
    return new Function(`return (${text.slice(objStart, i + 1)});`)();
  } catch (e) {
    console.error(`check-i18n: failed to evaluate ${marker}:`, e.message);
    process.exit(1);
  }
}

const LANG = objectAt(html, 'const LANG={');
const LANGS = objectAt(html, 'const LANGS=[');
const codes = LANGS.map((l) => l.code);

for (const code of codes) {
  if (LANG[code]) continue;
  const file = new URL(`../i18n/${code}.json`, import.meta.url);
  if (!existsSync(file)) {
    console.error(`check-i18n: language "${code}" is in LANGS but has neither an inline block nor i18n/${code}.json`);
    process.exit(1);
  }
  LANG[code] = JSON.parse(readFileSync(file, 'utf8'));
}

const en = LANG.en;
const enKeys = Object.keys(en);
const holes = (v) => (String(v).match(/\{\d+\}/g) || []).sort().join(' ');

let failed = false;
for (const code of codes) {
  if (code === 'en') continue;
  const pack = LANG[code];
  const missing = enKeys.filter((k) => !(k in pack));
  const extra = Object.keys(pack).filter((k) => !(k in en));
  const empty = enKeys.filter((k) => k in pack && String(pack[k]).trim() === '' && String(en[k]).trim() !== '');
  const badHoles = enKeys.filter((k) => k in pack && holes(pack[k]) !== holes(en[k]));
  const report = (label, list) => {
    if (!list.length) return;
    failed = true;
    console.error(`check-i18n: ${code} ${label} ${list.length} key(s): ${list.slice(0, 40).join(', ')}${list.length > 40 ? ', …' : ''}`);
  };
  report('is missing', missing);
  report('has extra', extra);
  report('has empty values for', empty);
  report('has different {n} placeholders from English in', badHoles);
}

if (failed) process.exit(1);
console.log(`check-i18n: OK — ${enKeys.length} keys, parity across ${codes.join('/')}`);
