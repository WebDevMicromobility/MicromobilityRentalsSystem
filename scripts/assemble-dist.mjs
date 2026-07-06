// Assembles dist/ as the exact set of files the production site serves, so the
// CI gated deploy (wrangler pages deploy dist) ships the SAME thing Cloudflare's
// git integration serves from the repo root — no more, no less.
//
// Run AFTER build:html (which regenerates index.html from app.src.html). Internal
// files (app.src.html, *.sql, *.md, tests/, scripts/, configs) are deliberately
// NOT copied, so the deployed artifact can't leak them even without the middleware.
import { rm, mkdir, copyFile, cp, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// Files copied verbatim from repo root.
const FILES = [
  'index.html', 'styles.css', 'service-worker.js', 'manifest.json', '404.html',
  '_headers', '_redirects',
  'brand.png', 'hero.webp', 'icon-192.png', 'icon-512.png', 'logo.png',
];
// Directories copied recursively (functions/ MUST be inside dist for Pages Functions;
// vendor/ holds the self-hosted supabase-js / qrcode / jsQR libraries).
const DIRS = ['functions', 'staff', 'vendor'];

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  for (const f of FILES) {
    const src = join(root, f);
    if (!(await exists(src))) { console.warn(`assemble-dist: skipping missing file ${f}`); continue; }
    await copyFile(src, join(dist, f));
  }
  for (const d of DIRS) {
    const src = join(root, d);
    if (!(await exists(src))) { console.warn(`assemble-dist: skipping missing dir ${d}/`); continue; }
    await cp(src, join(dist, d), { recursive: true });
  }
  console.log(`assemble-dist: wrote dist/ (${FILES.length} files + ${DIRS.length} dirs)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
