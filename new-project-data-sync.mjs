// MicroMobility — one-time data sync: OLD Supabase project → NEW project.
// Run AFTER new-project-setup.sql has been applied in the new project:
//   node new-project-data-sync.mjs
// Idempotent (upserts by id; storage objects upserted; URL rewrite skips done
// rows), so it is safe to re-run until everything reports ok.
// Uses only the public anon keys (both already ship in the app / git history).

const OLD = {
  name: 'OLD',
  url: 'https://ariyvnxeywozmwxmylhb.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyaXl2bnhleXdvem13eG15bGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDUzMTcsImV4cCI6MjA5NjE4MTMxN30.zi-0_k0M1xgSlrZKJ2QdKMLB3BnTi4nSecQutQnnNo4',
};
const NEW = {
  name: 'NEW',
  url: 'https://amyqxovbnlreassrqihr.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXF4b3ZibmxyZWFzc3JxaWhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTk0NzUsImV4cCI6MjA5ODY3NTQ3NX0.NzlLzOqZfTqx2TyeyNeqXwDPfvcPV2q4DHqPrlS8Tjk',
};

// FK order: bikes+customers before queue_entries.
const TABLES = ['customers', 'bikes', 'sessions', 'queue_entries', 'inventory', 'promo_codes', 'cashier_sales'];
const BATCH = { customers: 20, default: 100 }; // customers may carry data-URL photos
const PHOTO_TABLES = ['customers', 'bikes', 'inventory'];

const hdrs = (p, extra = {}) => ({ apikey: p.key, Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json', ...extra });
let failures = 0;
const fail = (msg) => { failures++; console.log('  ❌ ' + msg); };

async function fetchAll(p, table, select = '*') {
  const rows = [];
  const page = 100;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${p.url}/rest/v1/${table}?select=${select}&order=id`, {
      headers: hdrs(p, { Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }),
    });
    if (!res.ok && res.status !== 206) throw new Error(`${p.name} ${table} fetch ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < page) return rows;
  }
}

async function rowCount(p, table) {
  const res = await fetch(`${p.url}/rest/v1/${table}?select=id`, {
    method: 'HEAD',
    headers: hdrs(p, { Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' }),
  });
  const cr = res.headers.get('content-range');
  return cr ? Number(cr.split('/')[1]) : NaN;
}

async function upsert(p, table, rows) {
  const size = BATCH[table] || BATCH.default;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const res = await fetch(`${p.url}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers: hdrs(p, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(batch),
    });
    if (res.status !== 201 && res.status !== 200)
      throw new Error(`${table} upsert batch ${i / size}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

// ── 0. Preflight: setup SQL must be applied ──────────────────────────────────
console.log('== 0. Preflight ==');
{
  const res = await fetch(`${NEW.url}/rest/v1/sessions?select=id&limit=0`, { headers: hdrs(NEW) });
  if (!res.ok) {
    console.log(`  NEW project not readable (${res.status}): ${(await res.text()).slice(0, 150)}`);
    console.log('  → Run new-project-setup.sql in the NEW project SQL editor first, then re-run this.');
    process.exit(1);
  }
  console.log('  NEW project readable — grants are in place.');
}

// ── 1. Copy tables ───────────────────────────────────────────────────────────
console.log('\n== 1. Copy tables (upsert by id) ==');
for (const table of TABLES) {
  const rows = await fetchAll(OLD, table);
  if (rows.length) await upsert(NEW, table, rows);
  console.log(`  ${table}: ${rows.length} rows`);
}

// staff_actions: identity pk (ids regenerate) → copy only into an empty table.
{
  const n = await rowCount(NEW, 'staff_actions');
  if (n === 0) {
    const rows = (await fetchAll(OLD, 'staff_actions')).map(({ id, ...r }) => r);
    if (rows.length) await upsert(NEW, 'staff_actions', rows.sort((a, b) => (a.at || '').localeCompare(b.at || '')));
    console.log(`  staff_actions: ${rows.length} rows (fresh ids)`);
  } else {
    console.log(`  staff_actions: skipped, target already has ${n} rows`);
  }
}

// ── 2. Migrate storage photos + rewrite URLs ─────────────────────────────────
console.log('\n== 2. Storage photos (old bucket → new bucket, rewrite row URLs) ==');
const OLD_PREFIX = `${OLD.url}/storage/v1/object/public/photos/`;
const NEW_PREFIX = `${NEW.url}/storage/v1/object/public/photos/`;
for (const table of PHOTO_TABLES) {
  const res = await fetch(`${NEW.url}/rest/v1/${table}?select=id,photo&photo=like.*${new URL(OLD.url).hostname.split('.')[0]}*`, { headers: hdrs(NEW) });
  const rows = await res.json();
  let done = 0;
  for (const row of rows) {
    if (!row.photo || !row.photo.startsWith(OLD_PREFIX)) { fail(`${table} ${row.id}: unexpected old-URL format, left as-is`); continue; }
    const path = row.photo.slice(OLD_PREFIX.length).split('?')[0];
    const obj = await fetch(OLD_PREFIX + path);
    if (!obj.ok) { fail(`${table} ${row.id}: old object ${path} fetch ${obj.status}`); continue; }
    const blob = await obj.arrayBuffer();
    // Plain insert (no x-upsert): the new bucket's RLS allows anon INSERT but not
    // UPDATE, and upsert mode requires both. On "Duplicate" (object already in the
    // new bucket) verify it is byte-identical to the old one before trusting it.
    const up = await fetch(`${NEW.url}/storage/v1/object/photos/${path}`, {
      method: 'POST',
      headers: { apikey: NEW.key, Authorization: `Bearer ${NEW.key}`, 'Content-Type': obj.headers.get('content-type') || 'image/jpeg' },
      body: blob,
    });
    if (!up.ok) {
      const body = await up.text();
      if (!/Duplicate|already exists/i.test(body)) { fail(`${table} ${row.id}: upload ${path} ${up.status} ${body.slice(0, 120)}`); continue; }
      const existing = await fetch(NEW_PREFIX + path);
      if (!existing.ok) { fail(`${table} ${row.id}: duplicate ${path} but new URL serves ${existing.status}`); continue; }
      const { createHash } = await import('node:crypto');
      const h = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');
      if (h(await existing.arrayBuffer()) !== h(blob)) { fail(`${table} ${row.id}: ${path} exists in new bucket but content DIFFERS from old`); continue; }
    }
    const patch = await fetch(`${NEW.url}/rest/v1/${table}?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: hdrs(NEW, { Prefer: 'return=minimal' }),
      body: JSON.stringify({ photo: NEW_PREFIX + path }),
    });
    if (patch.status !== 204 && patch.status !== 200) { fail(`${table} ${row.id}: URL rewrite ${patch.status}`); continue; }
    done++;
  }
  console.log(`  ${table}: ${done}/${rows.length} photos migrated`);
}

// ── 3. Verify ────────────────────────────────────────────────────────────────
console.log('\n== 3. Verification ==');
console.log(`  ${'table'.padEnd(15)} ${'OLD'.padStart(6)} ${'NEW'.padStart(6)}`);
for (const table of TABLES.concat(['staff_actions'])) {
  const [o, n] = await Promise.all([rowCount(OLD, table), rowCount(NEW, table)]);
  if (o !== n) fail(`${table} count mismatch: old=${o} new=${n}`);
  else console.log(`  ${table.padEnd(15)} ${String(o).padStart(6)} ${String(n).padStart(6)}  ok`);
}

// Deep-compare sample rows (first/middle/last by id) on every synced table.
for (const table of TABLES) {
  const old = await fetchAll(OLD, table);
  if (!old.length) continue;
  const picks = [old[0], old[Math.floor(old.length / 2)], old[old.length - 1]];
  for (const o of picks) {
    const res = await fetch(`${NEW.url}/rest/v1/${table}?id=eq.${encodeURIComponent(o.id)}`, { headers: hdrs(NEW) });
    const [n] = await res.json();
    if (!n) { fail(`${table} ${o.id}: missing on NEW`); continue; }
    for (const k of Object.keys(o)) {
      const a = JSON.stringify(o[k]), b = JSON.stringify(n[k]);
      if (k === 'photo' && typeof o[k] === 'string' && o[k].startsWith(OLD_PREFIX)) {
        if (n[k] !== NEW_PREFIX + o[k].slice(OLD_PREFIX.length)) fail(`${table} ${o.id}.photo not rewritten to NEW url`);
      } else if (a !== b) fail(`${table} ${o.id}.${k}: old=${(a || '').slice(0, 60)} new=${(b || '').slice(0, 60)}`);
    }
  }
  console.log(`  ${table}: 3-row deep compare ok`);
}

// No row on NEW may still reference the old project's storage.
for (const table of PHOTO_TABLES) {
  const res = await fetch(`${NEW.url}/rest/v1/${table}?select=id&photo=like.*ariyvnxeywozmwxmylhb*`, { headers: hdrs(NEW) });
  const left = await res.json();
  if (left.length) fail(`${table}: ${left.length} rows still point at OLD storage`);
}

// Every migrated photo URL must actually serve.
for (const table of PHOTO_TABLES) {
  const res = await fetch(`${NEW.url}/rest/v1/${table}?select=id,photo&photo=like.*amyqxovbnlreassrqihr*`, { headers: hdrs(NEW) });
  for (const row of await res.json()) {
    const head = await fetch(row.photo, { method: 'HEAD' });
    if (!head.ok) fail(`${table} ${row.id}: migrated photo URL returns ${head.status}`);
  }
}

console.log(failures ? `\nRESULT: ${failures} FAILURE(S) — see ❌ lines above.` : '\nRESULT: ALL CHECKS PASSED — data is in full sync.');
process.exit(failures ? 1 : 0);
