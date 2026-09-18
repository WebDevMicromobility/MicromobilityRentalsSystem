import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// Staff ring and message riders all evening from the desk phone. The accounts list holds the
// name, the number and the rest already; one button hands the phone a card it understands,
// so the next call comes from a name instead of a number.

const customers = [
  {
    id: 'c1', name: 'Amal Al Rashid', email: 'amal@example.test', phone: '+966500000001',
    height: 168, type_preference: 'Road', gender: 'female', birth_date: '1994-03-14',
    city: 'Jeddah', country: 'Saudi Arabia', nationality: 'Jordan',
    socials: { instagram: 'amal.rides' }, created_at: '2026-01-05T10:00:00Z',
  },
  { id: 'c2', name: 'No Contact', email: null, phone: null, created_at: '2026-01-06T10:00:00Z' },
];
const tags = [{ id: 'tag_saturday', name: 'Saturday', slug: 'saturday', color: '#077A4B', locked: true }];
const customer_tags = [{ customer_id: 'c1', tag_id: 'tag_saturday', starts_at: null, expires_at: null }];

async function accounts(page: import('@playwright/test').Page) {
  await stubSupabase(page, { sessions: [], queue_entries: [], bikes: [], customers, tags, customer_tags });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  await page.waitForFunction('(S.customers||[]).length>0');
  await page.evaluate(`setStaffTab('community');S.communityTab='accounts';renderCommunity()`);
  await expect(page.locator('.am-vcard')).toHaveCount(2);
}


test('the card carries what staff would otherwise come back for', async ({ page }) => {
  await accounts(page);
  const vcf = await page.evaluate(`_vcardFor((S.customers||[]).find(c=>c.id==='c1'))`) as string;
  expect(vcf.startsWith('BEGIN:VCARD')).toBe(true);
  expect(vcf.trim().endsWith('END:VCARD')).toBe(true);
  expect(vcf).toContain('FN:Amal Al Rashid');
  expect(vcf).toContain('N:Rashid;Amal Al;;;');            // family name last, the rest given
  expect(vcf).toContain('TEL;TYPE=CELL:+966500000001');
  expect(vcf).toContain('EMAIL;TYPE=INTERNET:amal@example.test');
  expect(vcf).toContain('BDAY:1994-03-14');
  expect(vcf).toContain('ORG:MicroMobility');
  expect(vcf).toContain('Jeddah');
  expect(vcf).toContain('instagram.com/amal.rides');
  expect(vcf).toMatch(/NOTE:.*168/);                        // height
  expect(vcf).toMatch(/NOTE:.*Saturday/);                   // the tag they hold
  expect(vcf.split('\r\n').length).toBeGreaterThan(8);      // vCard lines end CRLF
});

test('the button is on every row and downloads a .vcf named for the rider', async ({ page }) => {
  await accounts(page);
  // The list is newest first, so pick the button by the id its handler carries.
  const btn = page.locator(`.am-vcard[onclick*="c1"]`);
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('aria-label', 'Save contact');
  const [file] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  expect(file.suggestedFilename()).toBe('Amal Al Rashid.vcf');
  await expect(page.locator('.toast')).toContainText('saved as a contact');
});

test('an account with no phone and no email says so instead of handing over an empty card', async ({ page }) => {
  await accounts(page);
  await page.evaluate(`saveCustomerContact('c2')`);
  await expect(page.locator('.toast')).toContainText('no phone or email');
});

test('a name with no surname still makes a valid card', async ({ page }) => {
  await accounts(page);
  const vcf = await page.evaluate(`_vcardFor({id:'x',name:'Mononym',phone:'+966500000009'})`) as string;
  expect(vcf).toContain('FN:Mononym');
  expect(vcf).toContain('N:;Mononym;;;');
});
