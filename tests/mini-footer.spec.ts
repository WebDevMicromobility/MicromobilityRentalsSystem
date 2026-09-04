import { test, expect } from '@playwright/test';
import { stubSupabase, waitForSb } from './helpers/supabase';

// The rentals pages carry a mini footer: brand + tagline, three ways to reach the booth,
// where and when it is, three policy links, four socials, the legal line with the VAT number.
// Dark on the light site by design. No newsletter, no shop columns, no payment logos.

test.beforeEach(async ({ page }) => {
  await stubSupabase(page, { sessions: [], queue_entries: [], bikes: [] });
  await page.goto('/');
  await waitForSb(page);
});

test('carries exactly the spec content, and nothing of the full footer', async ({ page }) => {
  const f = page.locator('#app-footer');
  await expect(f).toContainText('Power your path');
  await expect(f).toContainText('+(966) 56 666 8818');
  await expect(f).toContainText('info@micromobility.sa');
  await expect(f).toContainText('Thu Al-Nurayn St, Al Sharafeyah, Jeddah 23218');
  await expect(f).toContainText('Sat–Thu 14:00–22:00 · Fri 17:00–21:00');
  await expect(f).toContainText('Help Center');
  await expect(f).toContainText('Privacy Policy');
  await expect(f).toContainText('Terms & Conditions');
  await expect(f).toContainText('© 2026 MicroMobility. All Rights Reserved');
  await expect(f).toContainText('VAT No. 312555068900003');
  const txt = await f.innerText();
  expect(txt).not.toMatch(/newsletter|subscribe/i);           // full-footer things stay out
});

test('the four socials, as 40px circles inside 44px touch targets', async ({ page }) => {
  const links = page.locator('.mf-social a');
  await expect(links).toHaveCount(4);
  const hrefs = await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.join('|')).toContain('instagram.com/micromobilitysa');
  expect(hrefs.join('|')).toContain('x.com/micromobilitysa');
  expect(hrefs.join('|')).toContain('tiktok.com/@micromobilitysa');
  expect(hrefs.join('|')).toContain('wa.me/966566668818');
  const sizes = await page.evaluate(`[...document.querySelectorAll('.mf-social a')].map(a=>{
    const r=a.getBoundingClientRect(),c=a.querySelector('.mf-circle').getBoundingClientRect();
    return {tap:Math.round(Math.min(r.width,r.height)),circle:Math.round(c.width)};})`) as { tap: number; circle: number }[];
  for (const s of sizes) { expect(s.tap).toBeGreaterThanOrEqual(44); expect(s.circle).toBe(40); }
});

test('dark surface with the locked palette, on the light site', async ({ page }) => {
  const bg = await page.evaluate(`getComputedStyle(document.getElementById('app-footer')).backgroundColor`);
  expect(bg).toBe('rgb(17, 21, 17)');                          // #111511
});

test('arabic: full translation, phone and VAT stay LTR', async ({ page }) => {
  await page.evaluate(`setLang('ar')`);
  await page.waitForTimeout(600);
  const f = page.locator('#app-footer');
  await expect(f).toContainText('شارع ذي النورين، الشرفية، جدة 23218');
  await expect(f).toContainText('السبت–الخميس 14:00–22:00');
  await expect(f).toContainText('مركز المساعدة');
  await expect(f).toContainText('الشروط والأحكام');
  await expect(f).toContainText('جميع الحقوق محفوظة');
  await expect(f).toContainText('الرقم الضريبي: 312555068900003');
  const dirs = await page.evaluate(`[...document.querySelectorAll('#app-footer .mf-ltr')].map(e=>getComputedStyle(e).direction)`) as string[];
  expect(dirs.length).toBeGreaterThanOrEqual(2);
  for (const d of dirs) expect(d).toBe('ltr');                 // digits hold their direction in RTL
});

test('the spec integration event works: mm-lang flips the language', async ({ page }) => {
  await page.evaluate(`localStorage.setItem('mm_lang','ar');window.dispatchEvent(new Event('mm-lang'))`);
  await page.waitForTimeout(600);
  await expect(page.locator('#app-footer')).toContainText('مركز المساعدة');
});
