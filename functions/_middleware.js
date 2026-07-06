// Cloudflare Pages middleware — runs before static assets, so unlike _redirects it
// CAN stop internal files from being served. Cloudflare Pages serves the whole repo
// root; this blocks source, SQL, docs, configs, tests, dotfiles from the public.
// App assets (.html/.css/.js/.png + manifest.json) pass through to next().
export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;

  const blocked =
    /\.(sql|md|ts|mjs|lock|yml|yaml|toml|map)$/i.test(path) || // source / config / docs / data
    (/\.json$/i.test(path) && path !== '/manifest.json') ||    // configs, but keep the PWA manifest
    path === '/app.src' || /\/app\.src\.html$/.test(path) ||   // the readable app source
    path.startsWith('/tests/') ||
    path.startsWith('/scripts/') ||
    path.startsWith('/.github/') ||
    path.startsWith('/.claude/') ||
    /(^|\/)\.[^/]+$/.test(path);                                // dotfiles (.gitignore, .prettierrc, …)

  if (blocked) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  return context.next();
}
