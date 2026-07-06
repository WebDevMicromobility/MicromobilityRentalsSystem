// Cloudflare Pages middleware — runs before static assets, so unlike _redirects it
// CAN stop internal files from being served. Cloudflare Pages serves the whole repo
// root; this blocks source, SQL, docs, configs, tests, dotfiles from the public.
// App assets (.html/.css/.js/.png + manifest.json) pass through to next().
export async function onRequest(context) {
  const raw = new URL(context.request.url).pathname;

  // Match on the DECODED path: Cloudflare decodes percent-encoding before serving a
  // static file, so a raw regex would miss "security-migration%2Esql" (%2E = '.').
  // Decode fully (handle double-encoding), lowercase, and normalise backslashes.
  let path = raw;
  try {
    let prev;
    do { prev = path; path = decodeURIComponent(path); } while (path !== prev && path.length < 4096);
  } catch {
    return notFound(); // malformed encoding — refuse
  }
  path = path.replace(/\\/g, '/').toLowerCase();

  const blocked =
    /\.(sql|md|ts|mjs|lock|yml|yaml|toml|map|cjs|env|sh)$/.test(path) || // source / config / docs / data
    (/\.json$/.test(path) && path !== '/manifest.json') ||              // configs, but keep the PWA manifest
    path === '/app.src' || /\/app\.src\.html$/.test(path) ||            // the readable app source
    path.startsWith('/tests/') ||
    path.startsWith('/scripts/') ||
    path.startsWith('/functions/') ||
    path.startsWith('/.github/') ||
    path.startsWith('/.claude/') ||
    /(^|\/)\.[^/]+$/.test(path);                                        // dotfiles (.gitignore, .prettierrc, …)

  return blocked ? notFound() : context.next();
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
