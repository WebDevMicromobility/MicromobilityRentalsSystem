import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// The My Rides ticket has ONE Cancel button that speaks for the whole booking — it must
// cancel every rider of the group, not just rider 1 (the co-riders were being left
// 'waiting' in the DB to become no-shows while the customer read "Booking cancelled").
test('cancelling a multi-rider booking cancels every rider of the group', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const row = (id: string, qn: number, name: string): Record<string, unknown> => ({
    id, session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: qn, name,
    phone: '0500000001', customer_id: 'c1', type_preference: 'Road', status: 'waiting', paid: false,
    price: 75, registered_at: '2099-01-01T10:00:00Z',
  });
  const queue_entries = [row('e1', 5, 'Spec Rider'), row('e2', 6, 'Friend One'), row('e3', 7, 'Friend Two')];
  await stubSupabase(page, { queue_entries, sessions, 'rpc:list_sessions': sessions, 'rpc:customer_booking_update': true });
  await loginCustomer(page);
  await page.goto('/');
  await waitForSb(page);

  // Customer row writes go through the token RPC door (customer_booking_update), not PATCH.
  const cancelled: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/rest/v1/rpc/customer_booking_update')) {
      const body = r.postDataJSON();
      if (body && body.p_patch && body.p_patch.status === 'cancelled') cancelled.push(body.p_entry_id);
    }
  });
  await page.evaluate(() => {
    // @ts-expect-error app globals
    cancelBooking('e1', 'Change of plans');
  });
  await expect.poll(() => cancelled.slice().sort().join(',')).toBe('e1,e2,e3');
});

// A capacity-coerced WAITLIST booking must still be editable: the Reserve tab's modify mode
// has to match waitlist rows, otherwise Edit lands in fresh-booking mode and loops forever
// on the "already booked" banner.
test('editing a waitlisted booking enters modify mode (no already-booked loop)', async ({ page }) => {
  const sessions = [{ id: 's0', day: 'Friday', session_date: '2099-02-10', capacity: 12, status: 'open', created_at: 1 }];
  const queue_entries = [{
    id: 'w1', session_id: 's0', session_day: 'Friday', session_date: '2099-02-10', queue_num: 9,
    name: 'Spec Rider', phone: '0500000001', customer_id: 'c1', type_preference: 'Road',
    status: 'waitlist', paid: false, price: 75, registered_at: '2099-01-01T10:00:00Z', waitlist_num: 1,
  }];
  await stubSupabase(page, { queue_entries, sessions, 'rpc:list_sessions': sessions });
  await loginCustomer(page);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(() => {
    // @ts-expect-error app globals — the My Rides Edit button's exact wiring
    S.lastTickets = []; S.selSession = 's0'; S.regStep = 2; setCustTab('register');
  });
  await expect.poll(() => page.evaluate('S.modifyEntryId')).toBe('w1'); // modify mode engaged on the waitlist row
});
