import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { AddressInfo } from 'node:net';

// Service workers are blocked suite-wide (playwright.config.ts), so the worker itself has
// never been exercised. This file is the exception: it runs a real one.
//
// Cloudflare Pages answers /index.html with a 308 to /. The worker precached './index.html'
// at install, which stored a response carrying redirect history — and such a response cannot
// back a navigation: Safari refuses it ("Response served by service worker has redirections")
// and Chrome fails the load with ERR_FAILED. Because the entry was written at INSTALL time,
// every visit after the worker installed died, permanently, for every customer.
// The plain test server never redirects, so nothing here caught it.
test.use({ serviceWorkers: 'allow' });

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};

/** A stand-in for Cloudflare Pages: serves the repo, and 308s /index.html to /. */
async function startPagesMimic(): Promise<{ url: string; close: () => Promise<void> }> {
  const root = process.cwd();
  const server: Server = createServer((req, res) => {
    let path: string;
    try { path = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (path === '/index.html') { res.writeHead(308, { location: '/' }); res.end(); return; }
    const file = join(root, path === '/' ? '/index.html' : path);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    // A stable ETag, as Cloudflare sends: without one the worker reports every shell as
    // changed and open pages reload themselves mid-navigation.
    Promise.all([readFile(file), stat(file)]).then(
      ([body, s]) => {
        res.writeHead(200, {
          'content-type': TYPES[extname(file)] || 'application/octet-stream',
          'cache-control': 'no-cache',
          etag: `"${s.size}-${Math.floor(s.mtimeMs)}"`,
        });
        res.end(body);
      },
      () => { res.writeHead(404); res.end('not found'); },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test('the site still opens on the second visit when /index.html redirects', async ({ page }) => {
  const site = await startPagesMimic();
  // Keep the suite off the network: this spec does not stub Supabase, it just blocks it.
  await page.route(/supabase\.co|open-meteo\.com|cloudflareinsights\.com/, (r) => r.abort());
  try {
    await page.goto(site.url, { waitUntil: 'load' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });

    // The visits that used to fail: answered by the worker, from its cached shell.
    for (const visit of [2, 3]) {
      const res = await page.goto(site.url, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `visit ${visit} must load`).toBe(200);
    }

    // The shell is never stored under the URL that redirects.
    const keys = await page.evaluate(async () => {
      const names = await caches.keys();
      const out: string[] = [];
      for (const n of names) {
        const c = await caches.open(n);
        for (const r of await c.keys()) out.push(new URL(r.url).pathname);
      }
      return out;
    });
    expect(keys).toContain('/');
    expect(keys).not.toContain('/index.html');
  } finally {
    await site.close();
  }
});
