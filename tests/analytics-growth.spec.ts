import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The new Growth analytics view: funnel, demand heatmap, retail attach, run-rate forecast, RFM.
// The maths live in pure helpers so they're unit-testable without the full render.

test.describe('analytics growth', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page);
    await unlockStaff(page);
    await page.goto('/');
    await waitForSb(page);
  });

  test('pure helpers compute funnel / attach / forecast / RFM / wa digits', async ({ page }) => {
    const out = await page.evaluate(() => {
      const entries = [
        { status: 'done', checkedInAt: '2099-01-09T10:00:00Z', paid: true, price: 30 },
        { status: 'done', checkedInAt: '2099-01-09T11:00:00Z', paid: false, price: 30 },
        { status: 'active', checkedInAt: '2099-01-09T12:00:00Z' },
        { status: 'waiting' },
        { status: 'noshow' },
      ];
      return {
        // @ts-expect-error app globals
        funnel: _anFunnelCounts(entries),
        // @ts-expect-error app globals
        heatHours: _anHeatGrid(entries).hours,
        // @ts-expect-error app globals
        attach: _anAttachStats(entries.filter((e) => e.status === 'done')),
        // @ts-expect-error app globals
        rfmChamp: _anRFMSegment(5, 4),
        // @ts-expect-error app globals
        rfmAtRisk: _anRFMSegment(45, 3),
        // @ts-expect-error app globals
        rfmLost: _anRFMSegment(120, 2),
        // @ts-expect-error app globals
        rfmNew: _anRFMSegment(3, 1),
        // @ts-expect-error app globals
        wa: _waDigits('+966 56 123 4567'),
      };
    });
    expect(out.funnel).toEqual({ booked: 5, checkedIn: 3, completed: 2 }); // active counts as checked-in
    expect(out.heatHours.length).toBeGreaterThan(0);
    expect(out.attach.attachPct).toBe(0); // stub returns no add-ons
    expect(out.rfmChamp).toBe('champions');
    expect(out.rfmAtRisk).toBe('atrisk');
    expect(out.rfmLost).toBe('lost');
    expect(out.rfmNew).toBe('newbie');
    expect(out.wa).toBe('966561234567');
  });

  test('the month forecast projects from pace so far', async ({ page }) => {
    const out = await page.evaluate(() => {
      const now = new Date();
      const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`; // mid-month, tz-safe
      const sess = [{ id: 's1', session_date: iso }];
      const q = [
        { sessionId: 's1', status: 'done', paid: true, price: 30 },
        { sessionId: 's1', status: 'done', paid: true, price: 30 },
      ];
      // @ts-expect-error app globals
      return _anMonthForecast(sess, q, now);
    });
    expect(out.rides).toBe(2);
    expect(out.rev).toBe(60);
    expect(out.projRides).toBeGreaterThanOrEqual(out.rides); // projection never below actual
    expect(out.days).toBeGreaterThanOrEqual(28);
  });

  test('the Growth view renders with no console errors', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.evaluate(() => {
      // @ts-expect-error app globals
      S.view = 'staff'; S.staffTab = 'analytics'; renderAnalytics();
      // @ts-expect-error app globals
      setAnView('growth');
    });
    const html = await page.locator('#tab-analytics').innerHTML();
    expect(html).toContain('data-anview="growth"');
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
