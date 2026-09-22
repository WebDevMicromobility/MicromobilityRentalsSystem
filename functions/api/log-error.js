// Forwards a client-side error to a Discord webhook so the operator is alerted
// proactively (errors are always logged to the DB regardless; this is just the ping).
// Activates only when DISCORD_WEBHOOK is set as a Cloudflare Pages env var; until then
// it's a no-op so calling it is always safe.
//
// Best-effort abuse guard: the endpoint is public, so
//   • only the site's own pages are forwarded (a browser always sends Origin on a POST);
//   • payloads are hard-truncated, and nothing in them can ping anyone or break out of the
//     code blocks: backticks and @ are neutralised, and allowed_mentions turns mentions off;
//   • the throttle is per sender (~1 per 30 s per IP), not one timestamp for everybody. A single
//     global slot let anyone who posted junk every 30 s swallow every real alert behind it.
//     A small shared budget per minute still caps the channel if many senders pile in.
// All per isolate; Discord's own webhook rate-limit (429) is the backstop, and all failures
// are swallowed.
const PER_SENDER_MS = 30000;
const BUDGET_PER_MIN = 6;
const _lastBySender = new Map();
let _window = 0, _spent = 0;

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DISCORD_WEBHOOK) return json({ ok: false, skipped: 'not configured' });

  const self = new URL(request.url).origin;
  if (request.headers.get('origin') !== self) return json({ ok: false, skipped: 'foreign origin' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad body' }, 400); }
  const msg = clean(body && body.msg, 400);
  const src = clean(body && body.src, 200);
  const ua = clean(body && body.ua, 160);
  if (!msg) return json({ ok: false, error: 'no message' }, 400);

  const now = Date.now();
  const who = request.headers.get('cf-connecting-ip') || 'unknown';
  if (now - (_lastBySender.get(who) || 0) < PER_SENDER_MS) return json({ ok: false, skipped: 'throttled' });
  if (now - _window >= 60000) { _window = now; _spent = 0; }
  if (_spent >= BUDGET_PER_MIN) return json({ ok: false, skipped: 'throttled' });
  _spent++;
  _lastBySender.set(who, now);
  if (_lastBySender.size > 500) {
    for (const [k, t] of _lastBySender) if (now - t >= PER_SENDER_MS) _lastBySender.delete(k);
  }

  const content =
    `🚨 **MicroMobility error**\n\`\`\`\n${msg}\n\`\`\`` +
    (src ? `\n**at:** \`${src}\`` : '') +
    (ua ? `\n**ua:** \`${ua}\`` : '');

  try {
    await fetch(env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1900), username: 'MicroMobility', allowed_mentions: { parse: [] } }),
    });
  } catch { /* swallow — alerting must never break the app */ }
  return json({ ok: true });
}

// Truncated, with the two characters that carry Discord markup neutralised: a backtick could
// close the code block around the text, and @everyone / <@id> would ping the channel. A zero-width
// space after @ keeps an email address readable while breaking any mention.
function clean(v, max) {
  return String(v || '').slice(0, max).replace(/`/g, "'").replace(/@/g, '@​');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
