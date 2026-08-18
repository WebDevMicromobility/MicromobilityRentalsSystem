// Build the served index.html from the readable source app.src.html.
// Safe minification: removes comments + whitespace from the inline JS/CSS but does
// NOT mangle or compress — the app references global function names as strings
// inside onclick="fn()" template literals, so renaming identifiers would break it.
import { minify } from 'html-minifier-terser';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Modularization foundation: logic can live in separate src/ files and be pulled in
// at build time via `<!--include:path/to/file.js-->` markers. Inlining (not ES-module
// importing) keeps the app's single global scope intact, so the onclick="fn()"
// name-by-string pattern in the templates keeps working — no runtime change, files
// just become editable in isolation. Extraction stays incremental and test-guarded
//. Only the built index.html is ever served, so the markers
// never reach a browser.
async function resolveIncludes(text) {
  const RE = /<!--\s*include:\s*([^\s]+?)\s*-->/g;
  const parts = [];
  let last = 0, m;
  while ((m = RE.exec(text))) {
    parts.push(text.slice(last, m.index));
    const body = await readFile(new URL('../' + m[1], import.meta.url), 'utf8');
    parts.push(body.replace(/^\s*\/\/\s*@ts-check\s*$/m, '')); // strip the dev-only type-check pragma
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts.join('');
}

const raw = await readFile(new URL('../app.src.html', import.meta.url), 'utf8');
const src = await resolveIncludes(raw);

// ── Fail loudly on a JavaScript syntax error ────────────────────────────────
// html-minifier-terser does NOT throw when terser cannot parse an inline <script>; it
// leaves that block unminified and reports success. The only outward sign is the output
// barely shrinking, which is easy to miss — a broken build shipped this way twice. Parse
// every inline script first, so a syntax error stops the build with a real message.
for (const m of src.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/type\s*=\s*["']?application\/(ld\+json|json)/i.test(m[1])) continue; // data, not code
  try {
    new Function(m[2]);
  } catch (e) {
    const line = src.slice(0, m.index).split('\n').length;
    throw new Error(`build: inline <script> starting at app.src.html:${line} has a syntax error — ${e.message}`);
  }
}

let out = await minify(src, {
  collapseWhitespace: true,
  conservativeCollapse: true, // keep a single space where text nodes need it (layout-safe)
  removeComments: true, // HTML comments
  minifyCSS: true, // inline <style>
  minifyJS: {
    // terser options: strip comments + whitespace. compress stays OFF (its dead-code
    // elimination would drop top-level functions that are only referenced by name inside
    // onclick="fn()" strings). mangle is scoped to LOCAL variables only — toplevel:false
    // preserves every global/function name the onclick-by-string pattern depends on, while
    // shortening in-function locals to shrink the parse.
    compress: false,
    mangle: { toplevel: false },
    format: { comments: false },
  },
  // leave attribute quoting / structure alone to avoid any behavioural surprises
  keepClosingSlash: true,
  removeAttributeQuotes: false,
});

// ── Cache busting, derived not hand-maintained ───────────────────────────────
// styles.css used to be pinned as `?v=NNN` in BOTH index.html and the service worker's
// precache list, bumped by hand. It drifted 78 commits once, and because the SW serves
// same-origin assets cache-first with no revalidation, returning users and installed
// PWAs kept an old stylesheet forever while the HTML updated around it — new markup,
// old CSS. The tag is now the stylesheet's own content hash, so it moves automatically
// whenever the file changes, and the SW cache name moves with it.
const cssUrl = new URL('../styles.css', import.meta.url);
const cssHash = createHash('sha256').update(await readFile(cssUrl)).digest('hex').slice(0, 10);
const beforeCss = out;
out = out.replace(/styles\.css\?v=[a-z0-9]+/g, `styles.css?v=${cssHash}`);
if (out === beforeCss && /styles\.css\?v=/.test(beforeCss)) {
  throw new Error('build: styles.css cache tag present but not rewritten');
}

// Keep the service worker's precache entry and cache name in lockstep with that hash.
const swUrl = new URL('../service-worker.js', import.meta.url);
let sw = await readFile(swUrl, 'utf8');
const swBefore = sw;
sw = sw
  .replace(/styles\.css\?v=[a-z0-9]+/g, `styles.css?v=${cssHash}`)
  .replace(/const CACHE = '[^']*';/, `const CACHE = 'mmcq-${cssHash}';`);
if (!/const CACHE = 'mmcq-/.test(sw)) throw new Error('build: could not rewrite the SW cache name');
if (sw !== swBefore) await writeFile(swUrl, sw);

// ── Public origin, from one place ────────────────────────────────────────────
// The pages.dev host used to be typed into the canonical link, the OG/Twitter images, the
// JSON-LD, the sitemap and robots.txt independently, so moving to the custom domain meant
// finding every copy. app.src.html carries __SITE_ORIGIN__ and the two SEO files are
// rewritten here, all from site.config.json.
const site = JSON.parse(await readFile(new URL('../site.config.json', import.meta.url), 'utf8'));
const origin = String(site.origin || '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/.test(origin)) {
  throw new Error(`build: site.config.json origin must be a bare origin, got ${JSON.stringify(site.origin)}`);
}
if (out.includes('__SITE_ORIGIN__')) out = out.split('__SITE_ORIGIN__').join(origin);
if (out.includes('__SITE_ORIGIN__')) throw new Error('build: site origin placeholder survived substitution');

// sitemap.xml: one entry per language, each declaring the others as alternates, so the
// Arabic and Spanish pages are discoverable rather than hidden behind localStorage.
const langs = Array.isArray(site.languages) && site.languages.length ? site.languages : ['en'];
const def = site.defaultLanguage || langs[0];
const alt = (l) => `      <xhtml:link rel="alternate" hreflang="${l}" href="${origin}/?lang=${l}"/>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${langs.map((l) => `  <url>
    <loc>${origin}/${l === def ? '' : `?lang=${l}`}</loc>
${langs.map(alt).join('\n')}
      <xhtml:link rel="alternate" hreflang="x-default" href="${origin}/"/>
    <changefreq>weekly</changefreq>
    <priority>${l === def ? '1.0' : '0.9'}</priority>
  </url>`).join('\n')}
</urlset>
`;
await writeFile(new URL('../sitemap.xml', import.meta.url), sitemap);

const robotsUrl = new URL('../robots.txt', import.meta.url);
let robots = await readFile(robotsUrl, 'utf8');
const robotsBefore = robots;
robots = robots.replace(/^Sitemap: .*$/m, `Sitemap: ${origin}/sitemap.xml`);
if (!/^Sitemap: /m.test(robots)) throw new Error('build: robots.txt has no Sitemap line to rewrite');
if (robots !== robotsBefore) await writeFile(robotsUrl, robots);

// No build/tooling banner in the shipped file — index.html is public (View Source),
// so the "edit app.src.html, not index.html" rule lives in AGENTS.md / CLAUDE.md instead.
// Second guard, in case a future parser quirk slips past the check above: a real minify
// pass removes ~18% of this file. Anything under 5% means terser bailed out silently.
const shrink = 1 - out.length / src.length;
if (shrink < 0.05) {
  throw new Error(`build: output shrank only ${(shrink * 100).toFixed(1)}% — terser almost certainly failed to parse an inline script`);
}

await writeFile(new URL('../index.html', import.meta.url), out);
console.log(`built index.html: ${src.length} -> ${out.length} bytes (${(shrink * 100).toFixed(1)}% smaller, assets v=${cssHash})`);
