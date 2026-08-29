import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Deleting a session is a SOFT delete, so staff can restore it — but a session's id IS its
// date, so the deleted row goes on holding that date's primary key. Creating a session for
// the same date came back as a duplicate key, which the UI reported as "a session for that
// date already exists": staff deleted a Saturday ride, tried to put a new one on the same
// date, and were told the date was taken by a session they could no longer see.

const HEAD = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
type Row = Record<string, unknown>;

/** A tiny sessions table that actually enforces the primary key, which is the whole point:
 *  the stub's "every write succeeds" default cannot reproduce a duplicate-key clash. */
async function sessionsTable(page: Page, rows: Row[]) {
  const table = rows.map((r) => ({ ...r }));
  await page.route(/\/rest\/v1\/sessions/, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const idEq = url.searchParams.get('id');
    const id = idEq && idEq.startsWith('eq.') ? idEq.slice(3) : null;
    const ok = (status: number, body: unknown) =>
      route.fulfill({ status, headers: HEAD, body: JSON.stringify(body) });

    if (req.method() === 'GET') return ok(200, id ? table.filter((r) => r.id === id) : table);
    if (req.method() === 'POST') {
      const sent = req.postDataJSON() as Row | Row[];
      const incoming = Array.isArray(sent) ? sent : [sent];
      for (const r of incoming) {
        if (table.some((x) => x.id === r.id)) {
          return ok(409, { code: '23505', message: 'duplicate key value violates unique constraint "sessions_pkey"' });
        }
      }
      incoming.forEach((r) => table.push({ ...r }));
      return ok(201, incoming);
    }
    if (req.method() === 'PATCH') {
      const patch = req.postDataJSON() as Row;
      table.filter((r) => !id || r.id === id).forEach((r) => Object.assign(r, patch));
      return ok(200, table.filter((r) => !id || r.id === id));
    }
    if (req.method() === 'DELETE') {
      for (let i = table.length - 1; i >= 0; i--) if (!id || table[i].id === id) table.splice(i, 1);
      return ok(200, []);
    }
    return ok(200, []);
  });
  return table;
}

async function bootStaff(page: Page) {
  await stubSupabase(page, { bikes: [] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
}

/** Fill in the "add session" form for a plain circuit session on `date` and submit it. */
async function addSessionOn(page: Page, date: string) {
  await page.evaluate(`
    S.queueView='sessions'; renderStaffQueue();
    S.showAddSession=true; S.newSessEvent='jcc'; S.newSessMode='total'; S.newSessTotal='8';
    renderSessions();
    document.getElementById('ns-date').value=${JSON.stringify(date)};
    document.getElementById('ns-total').value='8';
    addSession();`);
}

const deleted = {
  id: '2099-09-05', day: 'Saturday', session_date: '2099-09-05', capacity: 20, status: 'deleted',
  created_at: 1, event_kind: 'community', ride_kind: 'saturday', paid_ride: false,
  needs_approval: true, hide_queue: true, spots: 20, title: 'Saturday Social Ride',
};

test('a new session can take the date of one that was deleted', async ({ page }) => {
  await bootStaff(page);
  const table = await sessionsTable(page, [deleted]);

  await addSessionOn(page, '2099-09-05');

  await expect(page.locator('#toast-container')).toContainText('5 Sept 2099'); // the "ready" toast, not an error
  await expect(page.locator('#toast-container')).not.toContainText('already exists');
  await expect.poll(() => table.length).toBe(1);
  expect(table[0]).toMatchObject({ id: '2099-09-05', session_date: '2099-09-05', status: 'closed', capacity: 8 });
});

test('a session that is still live keeps its date', async ({ page }) => {
  await bootStaff(page);
  const table = await sessionsTable(page, [{ ...deleted, status: 'open' }]);

  await addSessionOn(page, '2099-09-05');

  await expect(page.locator('#toast-container')).toContainText('already exists');
  expect(table).toHaveLength(1);
  expect(table[0]).toMatchObject({ status: 'open', capacity: 20 }); // untouched
});

test('a session can be moved onto the date of a deleted one', async ({ page }) => {
  await bootStaff(page);
  const live = {
    id: '2099-09-06', day: 'Sunday', session_date: '2099-09-06', capacity: 12, status: 'open',
    created_at: 1, bike_slots: JSON.stringify({ _time: '21:00 - 23:00', _total: 12 }),
  };
  const table = await sessionsTable(page, [deleted, live]);
  await page.evaluate('loadData()');
  await page.waitForFunction(`S.sessions.some(s=>s.id==='2099-09-06')`);

  await page.evaluate(`
    S.queueView='sessions'; renderStaffQueue();
    S.editSessionId='2099-09-06'; S.editSessDate='2099-09-05';
    S.editSessMode='total'; S.editSessTotal='12'; S.editSessStatus='open';
    saveSessionEdit();`);

  await expect(page.locator('#toast-container')).not.toContainText('already exists');
  await expect.poll(() => table.map((r) => r.id)).toEqual(['2099-09-05']);
  expect(table[0]).toMatchObject({ session_date: '2099-09-05', day: 'Saturday', status: 'open' });
});
