// Build the served index.html from the readable source app.src.html.
// Safe minification: removes comments + whitespace from the inline JS/CSS but does
// NOT mangle or compress — the app references global function names as strings
// inside onclick="fn()" template literals, so renaming identifiers would break it.
import { minify } from 'html-minifier-terser';
import { readFile, writeFile } from 'node:fs/promises';

const src = await readFile(new URL('../app.src.html', import.meta.url), 'utf8');

const out = await minify(src, {
  collapseWhitespace: true,
  conservativeCollapse: true, // keep a single space where text nodes need it (layout-safe)
  removeComments: true, // HTML comments
  minifyCSS: true, // inline <style>
  minifyJS: {
    // terser options: strip comments + whitespace only; preserve all names + logic
    compress: false,
    mangle: false,
    format: { comments: false },
  },
  // leave attribute quoting / structure alone to avoid any behavioural surprises
  keepClosingSlash: true,
  removeAttributeQuotes: false,
});

const banner = '<!-- Generated from app.src.html — do not edit directly; run: npm run build:html -->\n';
await writeFile(new URL('../index.html', import.meta.url), banner + out);
console.log(`built index.html: ${src.length} -> ${(banner + out).length} bytes`);
