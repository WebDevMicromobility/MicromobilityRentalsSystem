import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, mkdirSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

// Phase 1 of REBUILD-PLAN.md: index.html is the Vite entry. The app's JS is
// still one inline classic script (extracted module-by-module in Phase 2), so
// Vite passes it through untouched; the win today is `npm run build` producing
// a dist/ with a generated, auto-versioned service worker — no more manual
// mmcq-vNN cache bumps once deploys switch to dist (see .github/workflows/ci.yml).
//
// The repo root stays directly servable (Cloudflare Pages Git integration
// deploys it as-is today), so runtime-referenced assets live at the root and
// are copied verbatim into dist by the plugin below.

const RUNTIME_ASSETS = [
  'styles.css', 'manifest.json', 'logo.png', 'brand.png', 'hero.png',
  'icon-192.png', 'icon-512.png', '_redirects',
];

function copyRuntimeAssets(): Plugin {
  return {
    name: 'copy-runtime-assets',
    closeBundle() {
      const out = resolve(__dirname, 'dist');
      mkdirSync(out, { recursive: true });
      for (const f of RUNTIME_ASSETS) {
        try { copyFileSync(resolve(__dirname, f), resolve(out, f)); } catch { /* optional file */ }
      }
      try { cpSync(resolve(__dirname, 'staff'), resolve(out, 'staff'), { recursive: true }); } catch { /* optional */ }
    },
  };
}

export default defineConfig({
  publicDir: false, // assets live at the repo root (kept raw-servable); copied by the plugin above
  build: { outDir: 'dist' },
  plugins: [
    copyRuntimeAssets(),
    VitePWA({
      // The app registers './service-worker.js' itself — keep that contract.
      filename: 'service-worker.js',
      injectRegister: null,
      manifest: false, // manifest.json is hand-maintained and copied verbatim
      workbox: {
        globPatterns: ['**/*.{html,css,js,json,png}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // same policy as the hand-written worker: CDN libs cached after first use
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//,
            handler: 'CacheFirst',
            options: { cacheName: 'cdn', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
});
