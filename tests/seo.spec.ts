import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stubSupabase, waitForSb } from './helpers/supabase';

// The built page is almost entirely JavaScript. These pin the parts a crawler can actually
// see, and the language addressing that makes the Arabic site reachable at all.

test.describe('crawlable surface', () => {
  test('the built page carries static prose about the business in both languages', async () => {
    const html = await readFile(resolve(__dirname, '../index.html'), 'utf8');
    const noscript = html.match(/<noscript>[\s\S]*?<\/noscript>/)?.[0] ?? '';
    expect(noscript).toContain('Jeddah Corniche Circuit');
    expect(noscript).toContain('Road carbon');
    expect(noscript).toContain('Saturday Social Ride');
    expect(noscript).toContain('حلبة كورنيش جدة'); // the Arabic half
    // Enough words to describe a business, not the 48 the page used to expose.
    const words = noscript.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
    expect(words).toBeGreaterThan(150);
  });

  test('every language has an address, declared with hreflang', async () => {
    const html = await readFile(resolve(__dirname, '../index.html'), 'utf8');
    for (const lang of ['en', 'ar']) {
      expect(html).toMatch(new RegExp(`hreflang="${lang}"[^>]*\\?lang=${lang}`));
    }
    expect(html).toContain('hreflang="x-default"');
  });

  test('the structured data names the phone, the map and the socials', async () => {
    const html = await readFile(resolve(__dirname, '../index.html'), 'utf8');
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
    const data = JSON.parse(ld);
    expect(data['@type']).toBe('LocalBusiness');
    expect(data.telephone).toBe('+966566668818');
    expect(data.hasMap).toContain('maps.app.goo.gl');
    expect(data.sameAs).toContain('https://www.instagram.com/MicroMobilitySA/');
    expect(data.address.addressLocality).toBe('Jeddah');
    expect(data.makesOffer.priceCurrency).toBe('SAR');
  });

  test('no build-time placeholder survives into the served page', async () => {
    const html = await readFile(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).not.toContain('__SITE_ORIGIN__');
  });

  test('the sitemap lists each language and cross-links the alternates', async () => {
    const xml = await readFile(resolve(__dirname, '../sitemap.xml'), 'utf8');
    for (const code of ['ar', 'fr', 'es', 'pt', 'ur', 'hi', 'tl', 'ne', 'bn']) expect(xml).toContain(`?lang=${code}</loc>`);
    expect(xml).toContain('hreflang="x-default"');
  });

  test('robots keeps the staff stub and the design bundle out of the index', async () => {
    const txt = await readFile(resolve(__dirname, '../robots.txt'), 'utf8');
    expect(txt).toContain('Disallow: /staff/');
    expect(txt).toContain('Disallow: /design_handoff_erp_reskin/');
  });
});

test.describe('?lang addressing', () => {
  test('a lang parameter picks the language and sets direction, whatever this device used', async ({ page }) => {
    await stubSupabase(page, {});
    await page.addInitScript(() => localStorage.setItem('cq_lang', 'en'));
    await page.goto('/?lang=ar');
    await waitForSb(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('an unknown lang falls back to the remembered choice', async ({ page }) => {
    await stubSupabase(page, {});
    await page.addInitScript(() => localStorage.setItem('cq_lang', 'ar'));
    await page.goto('/?lang=zz');
    await waitForSb(page);
    expect(await page.evaluate('S.lang')).toBe('ar');
  });

  // A remembered code the app does not carry (here a made-up one) lands on English rather
  // than on nothing — the boot only accepts a remembered code that is still in LANGS.
  test('a device that remembers an unknown language falls back to English', async ({ page }) => {
    await stubSupabase(page, {});
    await page.addInitScript(() => localStorage.setItem('cq_lang', 'xx'));
    await page.goto('/');
    await waitForSb(page);
    expect(await page.evaluate('S.lang')).toBe('en');
  });

  test('every language has an address: ?lang=es opens Spanish', async ({ page }) => {
    await stubSupabase(page, {});
    await page.goto('/?lang=es');
    await waitForSb(page);
    expect(await page.evaluate('S.lang')).toBe('es');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('switching language writes it back into the URL so the page stays shareable', async ({ page }) => {
    await stubSupabase(page, {});
    await page.goto('/');
    await waitForSb(page);
    await page.evaluate(`setLang('ar')`);
    expect(new URL(page.url()).searchParams.get('lang')).toBe('ar');
  });
});

// One mark on every tab. The app pointed at logo.png - the wordmark lockup, 241x256 - so the
// tab squashed it and the word under the mark was a smudge at 16 px, while the partner form
// and the new site carried no icon at all and fell back to whatever the origin answered.
// favicon.png is the mark alone, square, and the same bytes on every Micromobility site.
test.describe('the tab icon', () => {
  test('every page this site serves points at the shared square mark', async ({ page }) => {
    for (const [file, href] of [['../index.html', 'favicon.png'], ['../404.html', '/favicon.png'], ['../staff/index.html', '/favicon.png']] as const) {
      const html = await readFile(resolve(__dirname, file), 'utf8');
      expect(html, file).toContain(`<link rel="icon" type="image/png" href="${href}">`);
    }
    // It is served, it is a PNG, and it is square: a tab stretches whatever shape it is given.
    const res = await page.request.get('/favicon.png');
    expect(res.status()).toBe(200);
    const png = Buffer.from(await res.body());
    expect(png.subarray(0, 4).toString('latin1')).toBe('\x89PNG');
    expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20)); // IHDR width === height
  });

  test('it is the file the dist build ships', async () => {
    const dist = await readFile(resolve(__dirname, '../scripts/assemble-dist.mjs'), 'utf8');
    expect(dist).toContain("'favicon.png'"); // left out, the tab 404s in production only
  });
});
