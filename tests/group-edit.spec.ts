import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Edit-group modal: one place to change the group's name/contact/main phone and each
// member's details. Members on the old main phone follow the new one; a member's own
// phone wins; group_name/group_contact are stamped on every row.
test('group edit modal updates group info and every member', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const row = (id: string, qn: number, name: string): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name,
    phone: '0512345678', customer_id: null, type_preference: 'Road', status: 'waiting', paid: false,
    price: 30, registered_at: '2099-01-01T10:00:00Z', group_id: 'g1', group_name: 'Tamer Group',
  });
  const queue_entries = [row('e1', 1, 'Tamer Group 1'), row('e2', 2, 'Tamer Group 2')];
  await stubSupabase(page, { sessions, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    showGroupEditModal('e1');
  });

  const modal = page.locator('#group-edit-modal');
  await expect(modal.locator('#ge-gname')).toHaveValue('Tamer Group');
  await modal.locator('#ge-gname').fill('Falcons');
  await modal.locator('#ge-cname').fill('Tamer');
  await modal.locator('#ge-phone').fill('0599999999'); // new main phone: members on the old one follow
  await modal.locator('#ge-r-name-1').fill('Ali');
  await modal.locator('#ge-r-ph-1').fill('0577777777'); // own phone wins over the main phone

  const patches: Record<string, Record<string, unknown>> = {};
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) {
      const id = (r.url().match(/id=eq\.([^&]+)/) || [])[1];
      if (id) patches[id] = r.postDataJSON();
    }
  });
  await modal.getByRole('button', { name: /Save/ }).click();
  await expect(modal).toBeHidden();

  // Request events reach Node asynchronously — poll instead of asserting immediately.
  await expect.poll(() => Object.keys(patches).sort()).toEqual(['e1', 'e2']);
  expect(patches.e1.group_name).toBe('Falcons');
  expect(patches.e2.group_name).toBe('Falcons');
  expect(patches.e1.group_contact).toBe('Tamer');
  expect(patches.e1.phone).toBe('0599999999'); // followed the new main phone
  expect(patches.e2.phone).toBe('0577777777'); // kept their own number
  expect(patches.e2.name).toBe('Ali');
  expect(patches.e1.name).toBe('Tamer Group 1'); // untouched fields stay as they were
});

// The group editor can also GROW the party. Riders added here join the same group_id, name,
// contact and main phone, so they render inside the group instead of as a separate booking.
test('group edit modal adds a rider to the existing group', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const customers = [{ id: 'c9', name: 'Known Rider', email: 'k@x.com', phone: '0599999999', height: 175 }];
  const row = (id: string, qn: number, name: string): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name,
    phone: '0512345678', customer_id: null, type_preference: 'Road', status: 'waiting', paid: false,
    price: 30, registered_at: '2099-01-01T10:00:00Z', group_id: 'g1', group_name: 'Tamer Group',
  });
  const queue_entries = [row('e1', 1, 'Tamer Group 1'), row('e2', 2, 'Tamer Group 2')];
  await stubSupabase(page, { sessions, customers, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    showGroupEditModal('e1');
  });

  const modal = page.locator('#group-edit-modal');
  await modal.getByRole('button', { name: /\+ Add rider/ }).click();
  await modal.locator('#ge-nr-name-0').fill('Known Rider'); // matches the saved customer
  await modal.locator('#ge-nr-h-0').fill('170');
  await modal.getByRole('button', { name: /\+ Add rider/ }).click(); // a second row, left empty on purpose

  const posts: Record<string, unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/queue_entries')) {
      const sent = r.postDataJSON();
      posts.push(...(Array.isArray(sent) ? sent : [sent]));
    }
  });
  await modal.getByRole('button', { name: /Save/ }).click();
  await expect(modal).toBeHidden();

  await expect.poll(() => posts.length).toBe(1); // the untouched row is dropped, not booked
  expect(posts[0].name).toBe('Known Rider');
  expect(posts[0].group_id).toBe('g1'); // same party as the two members
  expect(posts[0].group_name).toBe('Tamer Group');
  expect(posts[0].session_id).toBe('s0');
  expect(posts[0].status).toBe('waiting');
  expect(posts[0].queue_num).toBe(3); // on the end of the session's numbers
  expect(posts[0].height).toBe(170);
  expect(posts[0].phone).toBe('0512345678'); // falls back to the group's main phone
  expect(posts[0].customer_id).toBe('c9'); // name-matched account gets linked, like "Add group"
  expect(posts[0].walk_in).toBe(false);
  expect(posts[0].paid).toBe(false);
});

// A party held together only by a shared customer account has no group_id, so an added rider
// would be keyed apart from it. Saving mints one and stamps it on the existing rows too.
test('adding a rider to an account-only party mints a shared group id', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const row = (id: string, qn: number, name: string): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name,
    phone: '0512345678', customer_id: 'c1', type_preference: 'Road', status: 'waiting', paid: false,
    price: 30, registered_at: '2099-01-01T10:00:00Z', group_id: null, group_name: null,
  });
  const queue_entries = [row('e1', 1, 'Tamer'), row('e2', 2, 'Tamer 2')];
  await stubSupabase(page, { sessions, queue_entries });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals
    showGroupEditModal('e1');
  });

  const modal = page.locator('#group-edit-modal');
  await modal.locator('#ge-gname').fill('Falcons');
  await modal.getByRole('button', { name: /\+ Add rider/ }).click();
  await modal.locator('#ge-nr-h-0').fill('165'); // no name: takes the group's name and its place

  const posts: Record<string, unknown>[] = [];
  const patches: Record<string, Record<string, unknown>> = {};
  page.on('request', (r) => {
    if (!r.url().includes('/rest/v1/queue_entries')) return;
    if (r.method() === 'POST') posts.push(...(() => { const s = r.postDataJSON(); return Array.isArray(s) ? s : [s]; })());
    if (r.method() === 'PATCH') {
      const id = (r.url().match(/id=eq\.([^&]+)/) || [])[1];
      if (id) patches[id] = r.postDataJSON();
    }
  });
  await modal.getByRole('button', { name: /Save/ }).click();
  await expect(modal).toBeHidden();

  await expect.poll(() => posts.length).toBe(1);
  const gid = posts[0].group_id as string;
  expect(gid).toBeTruthy();
  expect(patches.e1.group_id).toBe(gid); // the members are stamped with it, so the party stays one
  expect(patches.e2.group_id).toBe(gid);
  expect(posts[0].name).toBe('Falcons 3'); // group name + place in the party
  expect(posts[0].group_name).toBe('Falcons');
  expect(posts[0].height).toBe(165);
});
