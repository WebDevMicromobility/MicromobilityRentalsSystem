import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubSupabase } from './helpers/supabase';

// Accessibility audit — REPORT-ONLY for now. It prints axe-core violations to the
// CI log (visible in the job output) but does not fail the build, so it can't
// block deploys while the backlog is worked down. Once the log is clean for the
// landing page, flip STRICT to true to lock it in as a regression gate, then
// extend to more views.
const STRICT = false;

async function audit(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  if (results.violations.length === 0) {
    console.log(`[a11y] ${label}: clean`);
    return 0;
  }
  console.log(`[a11y] ${label}: ${results.violations.length} violation type(s)`);
  for (const v of results.violations) {
    console.log(`  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
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
});
