import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Clone used to carry only the time and the bike allocation; the kind, name, seats, meeting
// point, breakfast stop, add-ons and waitlist rule all had to be typed again. Now the form
// opens as the same session with only the date blank.
test('cloning a session fills every input of the form, date excepted', async ({ page }) => {
  const sessions = [{
    id: '2026-09-05', day: 'Saturday', session_date: '2026-09-05', capacity: 20, status: 'closed', created_at: 1,
    event_kind: 'community', ride_kind: 'workshop', needs_approval: true, open_to_all: true, spots: 25,
    title: 'Triathlon Workshop', meet_url: 'https://maps.example.test/meet', breakfast_name: 'Corner Cafe',
    breakfast_url: 'https://maps.example.test/cafe', addons: '["helmet","lock"]',
    bike_slots: '{"_time":"07:30 - 09:30","_total":25,"_wl":{"m":"pct","v":30}}',
  }];
  await stubSupabase(page, { sessions, inventory: [{ id: 'helmet', name: 'Helmet', category: 'Add-on', stock: 5, price: 10 }, { id: 'lock', name: 'Lock', category: 'Add-on', stock: 5, price: 5 }] });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('allSessions().length>0');
  await page.evaluate("setStaffTab('sessions'); cloneSession('2026-09-05')");
  const st = await page.evaluate(`({
    ev:S.newSessEvent, title:S.newSessTitle, spots:S.newSessSpots, map:S.newSessMapUrl, bf:S.newSessBfName, bfu:S.newSessBfUrl,
    addons:S.newSessAddons, wlm:S.newSessWlMode, wlv:S.newSessWlVal, start:S.newSessStartTime, end:S.newSessEndTime,
    mode:S.newSessMode, total:S.newSessTotal, date:S.newSessDate, open:S.showAddSession
  })`);
  expect(st).toEqual({
    ev: 'workshop', title: 'Triathlon Workshop', spots: '25', map: 'https://maps.example.test/meet',
    bf: 'Corner Cafe', bfu: 'https://maps.example.test/cafe', addons: ['helmet', 'lock'], wlm: 'pct', wlv: '30',
    start: '07:30', end: '09:30', mode: 'total', total: 25, date: '', open: true,
  });
  // and the form on screen shows them
  await expect(page.locator('#ns-title')).toHaveValue('Triathlon Workshop');
  await expect(page.locator('#ns-map')).toHaveValue('https://maps.example.test/meet');
});

test('cloning a plain circuit session keeps it a circuit session', async ({ page }) => {
  const sessions = [{ id: '2026-09-08', day: 'Tuesday', session_date: '2026-09-08', capacity: 120, status: 'closed', created_at: 1,
    bike_slots: '{"_time":"21:00 - 23:00","_total":120,"_wl":{"m":"count","v":50}}' }];
  await stubSupabase(page, { sessions });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('allSessions().length>0');
  await page.evaluate("setStaffTab('sessions'); cloneSession('2026-09-08')");
  expect(await page.evaluate('[S.newSessEvent,S.newSessTotal,S.newSessWlMode,S.newSessWlVal,S.newSessTitle]')).toEqual(['jcc', 120, 'count', '50', '']);
});
