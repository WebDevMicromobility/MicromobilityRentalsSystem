// Forwards a client-side error to a Discord webhook so the operator is alerted
// proactively (errors are always logged to the DB regardless; this is just the ping).
// Activates only when DISCORD_WEBHOOK is set as a Cloudflare Pages env var; until then
// it's a no-op so calling it is always safe.
//
// Best-effort abuse guard: the endpoint is public, so payloads are hard-truncated and
// a module-scope timestamp throttles sends to ~1 per 30s per isolate. Discord's own
// webhook rate-limit (429) is the backstop; all failures are swallowed.
let _lastPing = 0;

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DISCORD_WEBHOOK) return json({ ok: false, skipped: 'not configured' });

  const now = Date.now();
  if (now - _lastPing < 30000) return json({ ok: false, skipped: 'throttled' });

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad body' }, 400); }
  const msg = String((body && body.msg) || '').slice(0, 400);
  const src = String((body && body.src) || '').slice(0, 200);
  const ua = String((body && body.ua) || '').slice(0, 160);
  if (!msg) return json({ ok: false, error: 'no message' }, 400);

  _lastPing = now;
  const content =
    `🚨 **MicroMobility error**\n\`\`\`\n${msg}\n\`\`\`` +
    (src ? `\n**at:** \`${src}\`` : '') +
    (ua ? `\n**ua:** ${ua}` : '');

  try {
    await fetch(env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1900), username: 'MicroMobility' }),
    });
  } catch { /* swallow — alerting must never break the app */ }
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
