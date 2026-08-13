// Checks EN/AR/ES translation key parity in app.src.html.
// The house rule is that every user-visible string exists in all three languages;
// this makes the rule enforceable in CI instead of relying on discipline.
//
// Usage: node scripts/check-i18n.mjs   (exit 1 on any missing key)
import { readFileSync } from 'node:fs';

const SRC = new URL('../app.src.html', import.meta.url);
const html = readFileSync(SRC, 'utf8');

const marker = 'const LANG={';
const start = html.indexOf(marker);
if (start === -1) {
  console.error('check-i18n: could not find `const LANG={` in app.src.html');
  process.exit(1);
}

// Scan from the opening brace to its matching close brace, ignoring braces
// inside string literals (placeholders like '{0}' appear in values).
let i = html.indexOf('{', start);
const objStart = i;
let depth = 0;
let quote = null; // ', ", or ` when inside a string
for (; i < html.length; i++) {
  const c = html[i];
  if (quote) {
    if (c === '\\') { i++; continue; } // skip escaped char
    if (c === quote) quote = null;
    continue;
  }
  if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
  if (c === '{') depth++;
  else if (c === '}') {
    depth--;
    if (depth === 0) break;
  }
}
if (depth !== 0) {
  console.error('check-i18n: unbalanced braces while scanning LANG object');
  process.exit(1);
}
const objText = html.slice(objStart, i + 1);

let LANG;
try {
  LANG = new Function(`return (${objText});`)();
} catch (e) {
  console.error('check-i18n: failed to evaluate LANG object:', e.message);
  process.exit(1);
}

const langs = Object.keys(LANG);
const expected = ['en', 'ar', 'es'];
for (const l of expected) {
  if (!langs.includes(l)) {
    console.error(`check-i18n: language "${l}" missing from LANG`);
    process.exit(1);
  }
}

const keySets = Object.fromEntries(langs.map((l) => [l, new Set(Object.keys(LANG[l]))]));
const all = new Set(langs.flatMap((l) => [...keySets[l]]));

let failed = false;
for (const l of expected) {
  const missing = [...all].filter((k) => !keySets[l].has(k)).sort();
  if (missing.length) {
    failed = true;
    console.error(`check-i18n: ${l} is missing ${missing.length} key(s): ${missing.join(', ')}`);
  }
}

if (failed) process.exit(1);
console.log(`check-i18n: OK — ${all.size} keys, parity across ${expected.join('/')}`);
