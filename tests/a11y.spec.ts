import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubSupabase } from './helpers/supabase';

// Accessibility audit — REPORT-ONLY for now. It prints axe-core violations to the
// CI log (visible in the job output) but does not fail the build, so it can't
// block deploys while the backlog is worked down. Once the log is clean for the
// landing page, flip STRICT to true to lock it in as a regression gate, then
// extend to more views.
const STRICT = false;

// The audit used to run the instant page.goto() resolved — while #loading-screen was still
// up — so axe was inspecting a spinner and reported "clean". Wait for the app to actually
// paint before looking at it.
async function settle(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const ld = document.getElementById('loading-screen');
      return !ld || getComputedStyle(ld).display === 'none' || ld.getClientRects().length === 0;
    },
    null,
    { timeout: 15000 },
  ).catch(() => {});
  await page.waitForTimeout(400);
}

async function audit(page: import('@playwright/test').Page, label: string) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  // axe files anything it could not decide (notably colour-contrast over gradients/opacity)
  // under `incomplete`. Reading only `violations` is how a real contrast defect stayed hidden.
  const incomplete = results.incomplete ?? [];
  if (results.violations.length === 0 && incomplete.length === 0) {
    console.log(`[a11y] ${label}: clean`);
    return 0;
  }
  console.log(`[a11y] ${label}: ${results.violations.length} violation type(s), ${incomplete.length} needing review`);
  for (const v of results.violations) {
    console.log(`  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}`);
  }
  for (const v of incomplete) {
    console.log(`  ? [review] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}`);
  }
  return results.violations.length;
}

test.describe('accessibility audit (report-only)', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page);
  });

  test('landing page (EN, dark)', async ({ page }) => {
    await page.goto('/');
    const count = await audit(page, 'landing EN dark');
    if (STRICT && count > 0) throw new Error(`${count} a11y violation type(s)`);
  });

  test('landing page (AR, RTL)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#lang-btn').click();
    await page.locator('.pay-menu-popup button', { hasText: 'العربية' }).click();
    await page.locator('html[dir="rtl"]').waitFor();
    const count = await audit(page, 'landing AR rtl');
    if (STRICT && count > 0) throw new Error(`${count} a11y violation type(s)`);
  });

  // The staff back office is the app's actual product and was entirely unaudited —
  // two landing snapshots covered a few percent of the surface.
  for (const tab of ['queue', 'cashier', 'inventory', 'analytics', 'history', 'notes'] as const) {
    test(`staff: ${tab}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('cq_staff', '1');
        localStorage.setItem('cq_op_name', 'A11y Spec');
      });
      await page.goto('/');
      await page.locator('#staff-tab-nav').waitFor();
      await page.evaluate((t) => (window as unknown as { setStaffTab: (x: string) => void }).setStaffTab(t), tab);
      const count = await audit(page, `staff ${tab}`);
      if (STRICT && count > 0) throw new Error(`${count} a11y violation type(s)`);
    });
  }
});
