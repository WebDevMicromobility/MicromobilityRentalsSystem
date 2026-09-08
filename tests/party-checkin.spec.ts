import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A party on the roster gets a one-tap "Check in (N)" next to its one-tap "Mark paid".
// On 2026-09-08 the card offered only "Mark paid" at party level: the desk paid six parties
// with it, handed out the bikes, and 17 riders rode as 'waiting' — the On Bike count read 66
// for a session of ~100. Solo rows keep their own per-rider Check In and get no party button.
test('a party row gets a one-tap Check in that activates every expected member', async ({ page }) => {
  const row = (id: string, qn: number, name: string, groupId: string | null, status = 'waiting'): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn,
    name, phone: '', customer_id: null, group_id: groupId, status, paid: false,
    price: 30, walk_in: true, registered_at: '2099-01-01T10:00:00Z',
  });
  const q = [
    row('e1', 1, 'Grouped One', 'g1'),
    row('e2', 2, 'Grouped Two', 'g1'),
    row('e3', 3, 'Grouped Three', 'g1', 'active'), // already riding: not taken again
    row('e4', 4, 'Solo Four', null),
  ];
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  await stubSupabase(page, { queue_entries: q, sessions });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  await page.evaluate(() => {
    // @ts-expect-error app globals
    S.staffTab = 'queue'; renderStaffQueue();
  });

  // Exactly one party button, counting only the two members still expected.
  const partyBtn = page.locator('#tab-queue').getByRole('button', { name: /^Check in \(2\)$/ }).filter({ visible: true });
  await expect(partyBtn).toHaveCount(1);

  const patched: Array<{ id: string; status?: string }> = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/rest/v1/queue_entries')) {
      const id = (r.url().match(/id=eq\.([^&]+)/) || [])[1];
      let status: string | undefined;
      try { status = r.postDataJSON()?.status; } catch { /* not JSON */ }
      if (id) patched.push({ id, status });
    }
  });
  await partyBtn.click();

  // Both expected members are written to 'active'; the rider already on a bike and the solo
  // row are left alone.
  await expect.poll(() => patched.filter((p) => p.status === 'active').map((p) => p.id).sort()).toEqual(['e1', 'e2']);
  expect(patched.some((p) => p.id === 'e3' || p.id === 'e4')).toBe(false);
});
