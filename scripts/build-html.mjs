// Build the served index.html from the readable source app.src.html.
// Safe minification: removes comments + whitespace from the inline JS/CSS but does
// NOT mangle or compress — the app references global function names as strings
// inside onclick="fn()" template literals, so renaming identifiers would break it.
import { minify } from 'html-minifier-terser';
import { readFile, writeFile } from 'node:fs/promises';

// Modularization foundation: logic can live in separate src/ files and be pulled in
// at build time via `<!--include:path/to/file.js-->` markers. Inlining (not ES-module
// importing) keeps the app's single global scope intact, so the onclick="fn()"
// name-by-string pattern in the templates keeps working — no runtime change, files
// just become editable in isolation. Extraction stays incremental and test-guarded
// (see REBUILD-PLAN.md). Only the built index.html is ever served, so the markers
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

const out = await minify(src, {
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

// No build/tooling banner in the shipped file — index.html is public (View Source),
// so the "edit app.src.html, not index.html" rule lives in AGENTS.md / CLAUDE.md instead.
await writeFile(new URL('../index.html', import.meta.url), out);
console.log(`built index.html: ${src.length} -> ${out.length} bytes`);
