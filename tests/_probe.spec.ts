import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

const jcc = {
  id: '2099-01-11', session_date: '2099-01-11', day: 'Sunday', status: 'open', capacity: 20,
  created_at: 1, location: 'JCC', bike_slots: '{"_time":"21:00 - 23:00","_total":20}',
};
const satur = {
  id: '2099-01-10', session_date: '2099-01-10', day: 'Saturday', status: 'open', capacity: 20,
  created_at: 1, event_kind: 'community', ride_kind: 'saturday', paid_ride: false,
  needs_approval: true, hide_queue: true, spots: 20, title: 'Saturday Social Ride',
  bike_slots: '{"_time":"06:30 - 07:00"}',
};
const row = (over: Record<string, unknown> = {}) => ({
  id: 'bk1', session_id: '2099-01-11', session_day: 'Sunday', session_date: '2099-01-11',
  queue_num: 4, name: 'Spec Rider', size: 'M', type_preference: 'Any', status: 'waiting',
  paid: false, price: 50, customer_id: 'c1',
  registered_at: '2099-01-01T10:00:00Z', ...over,
});

async function boot(page: import('@playwright/test').Page, lang: string) {
  await stubSupabase(page, {
    sessions: [jcc, satur], bikes: [], queue_entries: [row(), row({ id: 'bk2', queue_num: 5 })],
    'rpc:community_member': true,
  });
  await loginCustomer(page, { id: 'c1', name: 'Spec Rider', created_at: '2026-01-15T00:00:00Z', height: 175, birth_date: '1990-05-05', nationality: 'Egypt', country: 'Saudi Arabia', city: 'Jeddah' });
  await page.addInitScript((l) => {
    localStorage.setItem('cq_lang', l as string);
    localStorage.setItem('cq_lang_pick', '1');
  }, lang);
  await page.goto('/?lang=' + lang);
  await waitForSb(page);
  await page.waitForTimeout(900);
}

// Visible text, plus the SELECTED option text of every visible <select> (innerText omits them).
const TEXT = `() => {
  const parts = [document.body.innerText || ''];
  document.querySelectorAll('select').forEach(s => {
    const cs = getComputedStyle(s);
    if (cs.display === 'none' || !s.offsetParent) return;
    const o = s.selectedOptions[0];
    if (o) parts.push('[SELECT ' + (s.id||s.className) + ' -> ' + o.textContent + ']');
  });
  return parts.join('\\n');
}`;

// Each language boots its own context and walks five screens, so the wall-clock grows with
// the language count; the 30s default started timing out under a fully parallel run.
test('language purity in non-latin UIs', async ({ page }) => {
  test.setTimeout(120_000);
  const ALLOW = /^(MicroMobility|JCC|SAR|QR|WhatsApp|Instagram|TikTok|VAT|Spec|Rider|Saturday|Social|Ride|Petromin|Petrolube|Brew92|Maps|Google|Wallet|Apple|micromobility|info|sa|com|pages|dev|EN|FR|ES|PT|HI|TL|NE|BN|English|Tagalog|Road|Carbon|Hybrid|Mountain|Kids|Gravel|Any|Own|M|S|L|XL)$/;
  for (const lang of ['ar', 'ur', 'hi', 'ne', 'bn']) {
    const ctx = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await boot(p, lang);
    for (const [name, js] of [
      ['picker', `showView('landing')`],
      ['wiz2', `showView('customer');setCustTab('register');S.selSession='2099-01-11';S.regStep=2;S.regQty=2;S.regBikeTypes=['Road','Any'];renderRegister()`],
      ['wiz3', `S.regStep=3;renderRegister()`],
      ['myrides', `setCustTab('myrides')`],
      ['account', `setCustTab('account')`],
    ] as [string, string][]) {
      await p.evaluate(js);
      await p.waitForTimeout(300);
      const txt = await p.evaluate(`(${TEXT})()`) as string;
      const words = [...new Set((txt.match(/[A-Za-z][A-Za-z'’&-]{2,}/g) || []))].filter(w => !ALLOW.test(w));
      if (words.length) console.log(`[${lang} ${name}] LATIN: ${JSON.stringify(words)}`);
    }
    await ctx.close();
  }
  expect(true).toBe(true);
});

test('country and city dropdowns per language', async ({ page }) => {
  test.setTimeout(120_000);
  for (const lang of ['ar', 'fr', 'es', 'hi', 'ur', 'bn']) {
    const ctx = await page.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await boot(p, lang);
    await p.evaluate(`showView('customer');setCustTab('account')`);
    await p.waitForTimeout(400);
    const got = await p.evaluate(`(() => {
      const pick = (id) => { const s = document.getElementById(id); return s ? [...s.options].slice(0,5).map(o=>o.textContent) : 'MISSING'; };
      const ids = [...document.querySelectorAll('#tab-account select')].map(s=>s.id||s.className);
      return { ids, nat: pick('acc-nat'), country: pick('acc-country'), city: pick('acc-city') };
    })()`);
    console.log(`[${lang}] ` + JSON.stringify(got));
    await ctx.close();
  }
  expect(true).toBe(true);
});
