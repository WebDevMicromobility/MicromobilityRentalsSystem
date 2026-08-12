import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Ride definition with the 2026-08-12 cutover: before it, PAID = completed ride (check-ins
// weren't recorded consistently); from it on, only CHECKED-IN riders count. Riding minutes
// come from the server check-in/out stamps (fallback: device-recorded duration), never estimated.
test('ride counting honors the paid-history / checked-in-future cutover', async ({ page }) => {
  await stubSupabase(page, {});
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const r = await page.evaluate(() => {
    const mk = (o: Record<string, unknown>) => ({ status: 'waiting', paid: false, ...o });
    // @ts-expect-error app globals
    const ride = (o: Record<string, unknown>) => _isRide(mk(o));
    // @ts-expect-error app globals
    const mins = (o: Record<string, unknown>) => _rideMinutes(mk(o));
    return {
      legacyPaidWaiting: ride({ sessionDate: '2026-07-01', paid: true }), // old habit: paid but never checked in
      legacyUnpaidDone: ride({ sessionDate: '2026-07-01', status: 'done' }), // rode but unpaid: not counted per the rule
      legacyPaidNoshow: ride({ sessionDate: '2026-07-01', paid: true, status: 'noshow' }), // explicit no-show stays out
      newPaidWaiting: ride({ sessionDate: '2099-01-01', paid: true }), // paid alone is no longer a ride
      newCheckedIn: ride({ sessionDate: '2099-01-01', status: 'active', checkedInAt: '2099-01-01T10:00:00Z' }),
      newDoneUnpaid: ride({ sessionDate: '2099-01-01', status: 'done' }),
      cancelled: ride({ sessionDate: '2026-07-01', paid: true, status: 'cancelled' }),
      stampedMinutes: mins({ checkedInAt: '2099-01-01T10:00:00Z', checkedOutAt: '2099-01-01T10:47:00Z', rideDuration: 5 }), // stamps win over device duration
      deviceMinutes: mins({ rideDuration: 33 }),
      unmeasured: mins({}), // never estimated
    };
  });
  expect(r).toEqual({
    legacyPaidWaiting: true,
    legacyUnpaidDone: false,
    legacyPaidNoshow: false,
    newPaidWaiting: false,
    newCheckedIn: true,
    newDoneUnpaid: true,
    cancelled: false,
    stampedMinutes: 47,
    deviceMinutes: 33,
    unmeasured: 0,
  });
});
