import { test, expect } from '@playwright/test';
import { stubSupabase } from './helpers/supabase';

// Regression: if supabase-js can't load from the CDN (ad-blocker, privacy extension,
// blocked/slow network), boot must NOT hang forever on a blank header/footer. The
// _sbReady timeout lets boot continue in degraded mode and a view always activates.

test('boot still shows the app when supabase-js fails to load', async ({ page }) => {
  await stubSupabase(page);
  await page.route('**/vendor/supabase-js-*.js', (r) => r.abort()); // self-hosted lib blocked
  await page.goto('/');

  // A view must eventually become active (waits past the _sbReady timeout).
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          ['view-landing', 'view-customer', 'view-staff'].some((id) =>
            document.getElementById(id)?.classList.contains('active'),
          ),
        ),
      { timeout: 12000 },
    )
    .toBe(true);

  // The loading screen must be dismissed, not stuck.
  const lsHidden = await page.evaluate(() => {
    const ls = document.getElementById('loading-screen');
    return !ls || ls.style.display === 'none';
  });
  expect(lsHidden).toBe(true);
});
