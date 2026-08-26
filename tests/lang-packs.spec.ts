import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stubSupabase, waitForSb } from './helpers/supabase';

/** The built pack itself is the expected value — hardcoding a word here would just be a
 *  second, staler copy of the translation. */
const AR = JSON.parse(readFileSync(resolve(__dirname, '../lang/ar.json'), 'utf8')) as Record<string, string>;

// Translations used to ship inline in all three languages — ~190 KB of the page for a
// visitor who reads one of them. English still ships inline, because t() falls through to
// it and the app must render before any network call; Arabic is a file the
// build extracts and the app fetches when they are actually chosen.
//
// The risk this trades for the bytes is a silent fallback: if a pack fails to arrive, every
// string quietly reverts to English. So these pin both halves — the pack loads and paints,
// and a missing pack degrades to English instead of blanks or key names.

const fixtures = { sessions: [], bikes: [], queue_entries: [] };

/** Language-pack requests the page made. */
function watchPacks(page: import('@playwright/test').Page) {
  const urls: string[] = [];
  page.on('request', (r) => { if (/\/lang\/[a-z]+\.json/.test(r.url())) urls.push(r.url()); });
  return urls;
}

test('an English visitor fetches no pack at all', async ({ page }) => {
  const packs = watchPacks(page);
  await stubSupabase(page, fixtures);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForTimeout(500);
  expect(packs).toEqual([]);
  expect(await page.evaluate(`t('tabReserve')`)).toBe('Reserve');
});

test('choosing Arabic fetches its pack, once, and paints in Arabic', async ({ page }) => {
  const packs = watchPacks(page);
  await stubSupabase(page, fixtures);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setLang('ar')`);
  await expect.poll(() => page.evaluate(`_langLoaded('ar')`)).toBe(true);

  expect(packs.filter((u) => u.includes('/ar.json')).length).toBe(1);
  expect(packs[0]).toMatch(/\?v=[a-f0-9]{10}$/);           // content-versioned, so a change busts it
  expect(await page.evaluate(`t('tabReserve')`)).toBe(AR.tabReserve);
  expect(await page.evaluate(`document.documentElement.dir`)).toBe('rtl');

  // switching away and back does not fetch again
  await page.evaluate(`setLang('en')`);
  await page.evaluate(`setLang('ar')`);
  await page.waitForTimeout(300);
  expect(packs.filter((u) => u.includes('/ar.json')).length).toBe(1);
});

test('a returning Arabic reader has the pack before the first paint', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await page.addInitScript(() => localStorage.setItem('cq_lang', 'ar'));
  await page.goto('/');
  await waitForSb(page);
  // no flash to correct: by the time the app is up, Arabic is what it renders
  await expect.poll(() => page.evaluate(`t('tabReserve')`)).toBe(AR.tabReserve);
  expect(await page.evaluate(`S.lang`)).toBe('ar');
});

test('a pack that never arrives leaves English, not blanks', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await page.route(/\/lang\/ar\.json/, (r) => r.abort());
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`setLang('ar')`);
  await page.waitForTimeout(600);
  expect(await page.evaluate(`t('tabReserve')`)).toBe('Reserve'); // the fallback, not '' or the key
  expect(await page.evaluate(`document.documentElement.lang`)).toBe('ar'); // still their choice
});

test('every key survives the round trip — the packs are the same data, not a subset', async ({ page }) => {
  await stubSupabase(page, fixtures);
  await page.goto('/');
  await waitForSb(page);
  await page.evaluate(`(async()=>{await loadLangPack('ar');})()`);
  await expect.poll(() => page.evaluate(`_langLoaded('ar')`)).toBe(true);
  const counts = await page.evaluate(`({en:Object.keys(LANG.en).length,ar:Object.keys(LANG.ar).length})`) as Record<string, number>;
  expect(counts.ar).toBe(counts.en);
});
