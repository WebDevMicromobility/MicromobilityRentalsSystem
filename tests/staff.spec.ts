import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, staffReady, goStaffTab } from './helpers/supabase';

test('visiting ?staff locked shows the staff email/password gate (no PIN pad)', async ({ page }) => {
  await stubSupabase(page);
  await page.goto('/?staff');
  await expect(page.locator('#staff-auth-email')).toBeVisible();
  await expect(page.locator('#staff-auth-pwd')).toBeVisible();
  await expect(page.locator('.pin-key')).toHaveCount(0); // the 4-digit PIN must never resurface
});

test('the staff link always opens the staff panel, even after browsing as a customer', async ({ page }) => {
  await stubSupabase(page);
  // Previously-unlocked staffer whose last view was the customer page + a customer session.
  await page.addInitScript(() => {
    localStorage.setItem('cq_staff', '1');
    localStorage.setItem('cq_session', JSON.stringify({ id: 'c1', name: 'Rider', email: 'r@x.com' }));
    sessionStorage.setItem('cq_nav', JSON.stringify({ view: 'customer' }));
  });
  await page.goto('/?staff');
  await staffReady(page); // staff panel, NOT the customer page
});

test('wrong staff credentials are rejected with an error', async ({ page }) => {
  await stubSupabase(page); // stub answers auth/token with invalid_grant by default
  await page.goto('/?staff');
  await page.fill('#staff-auth-email', 'nobody@example.com');
  await page.fill('#staff-auth-pwd', 'wrong-password');
  await page.locator('#pin-modal .btn-primary').click();
  await expect(page.locator('#staff-auth-err')).not.toBeEmpty();
});

test.describe('unlocked staff panel', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page);
    await unlockStaff(page);
    await page.goto('/');
  });

  test('staff view loads with the staff app name', async ({ page }) => {
    await expect(page).toHaveTitle('MicroMobility Rental and Inventory System');
    await staffReady(page);
  });

  test('bookings tab has the QR scan button and the scanner degrades gracefully without a camera', async ({ page }) => {
    const scanBtn = page.locator('#tab-queue button', { hasText: 'Scan ticket' }).filter({ visible: true }); // the filter-row copy on desktop, the floating one on phones
    await expect(scanBtn).toBeVisible();
    await scanBtn.click();
    await expect(page.locator('#scan-modal .pin-title')).toHaveText('Scan booking QR');
    // headless browser grants no camera: the modal must show a clear error, not break.
    // getUserMedia rejects asynchronously and can be slow under parallel load — give it room.
    await expect(page.locator('#scan-msg')).toContainText(/camera/i, { timeout: 15000 });
    await page.locator('#scan-modal .pin-cancel').click();
    await expect(page.locator('#scan-modal')).toBeHidden();
  });

  test('scanning a valid ticket payload opens check-in for that booking', async ({ page }) => {
    // inject a fake waiting booking and feed the scanner its QR payload directly
    await page.evaluate(`
      S.queue.push({ id: 'abc123de-0000-4000-8000-000000000001', queueNum: 7, name: 'Scan Test', status: 'waiting', sessionId: 's1', typePreference: 'Any', size: 'M', paid: false });
      _onScanPayload('MMC-7-abc123');
    `);
    await expect(page.locator('#checkin-modal')).toContainText('Scan Test'); // quick check-in modal (payment + bike type)
  });

  test('scanning a waitlisted ticket opens check-in, not "no booking matches"', async ({ page }) => {
    // A waitlisted rider carries the same QR as anyone else, and checking them in is how
    // they leave the waitlist. The scanner used to accept only 'waiting' and told the desk
    // the code matched nothing.
    await page.evaluate(`
      S.queue.push({ id: 'wl9876ab-0000-4000-8000-000000000002', queueNum: 9, waitlistNum: 3, name: 'Waitlist Rider', status: 'waitlist', sessionId: 's1', typePreference: 'Any', size: 'M', paid: false });
      _onScanPayload('MMC-9-wl9876');
    `);
    await expect(page.locator('#checkin-modal')).toContainText('Waitlist Rider');
    await expect(page.locator('#scan-modal')).toBeHidden(); // a match closes the scanner; it never sat there saying nothing matched
  });

  test('a waitlisted scan is announced by its W position, not a queue number', async ({ page }) => {
    await page.evaluate(`
      S.queue.push({ id: 'wl5432cd-0000-4000-8000-000000000003', queueNum: 11, waitlistNum: 4, name: 'W Rider', status: 'waitlist', sessionId: 's1', typePreference: 'Any', size: 'M', paid: false });
      _onScanPayload('MMC-11-wl5432');
    `);
    await expect(page.locator('.toast')).toContainText('W4 W Rider');
  });

  test('a code whose queue number has since moved still finds its booking', async ({ page }) => {
    // The rider was W2 when the Wallet pass was issued and is #21 now. The id prefix is the
    // key; treating the stale number as a filter is what made the desk see "no booking
    // matches this code" for a rider standing in front of them.
    await page.evaluate(`
      S.queue.push({ id: 'movd1234-0000-4000-8000-000000000004', queueNum: 21, name: 'Renumbered Rider', status: 'waiting', sessionId: 's1', typePreference: 'Any', size: 'M', paid: false });
      _onScanPayload('MMC-2-movd12');
    `);
    await expect(page.locator('#checkin-modal')).toContainText('Renumbered Rider');
  });

  test('the number still settles which booking an id prefix means', async ({ page }) => {
    await page.evaluate(`
      S.queue.push({ id: 'dupe5678-0000-4000-8000-000000000005', queueNum: 30, name: 'Prefix One', status: 'waiting', sessionId: 's1', typePreference: 'Any', size: 'M', paid: false });
      S.queue.push({ id: 'dupe5678-1111-4000-8000-000000000006', queueNum: 31, name: 'Prefix Two', status: 'waiting', sessionId: 's1', typePreference: 'Any', size: 'M', paid: false });
      _onScanPayload('MMC-31-dupe56');
    `);
    await expect(page.locator('#checkin-modal')).toContainText('Prefix Two');
  });
});

test.describe('inventory sections derive from the data, not this device', () => {
  // Custom categories (Drinks, Protein Cookies) were created on another device, so
  // this browser's localStorage has no cq_inv_cats_supp entry for them. Their items
  // carry supplements-only fields (flavour/volume/nutrition), which must be enough
  // to place them in Supplements & Beverages.
  const fixtures = {
    inventory: [
      { id: 'i1', name: 'Recover Vitamin Water', brand: 'Vitamin Well', category: 'Drinks', qty: 10, low_threshold: 2, flavour: 'Berry', volume_ml: 500 },
      { id: 'i2', name: 'Choc Chip Protein Cookies', brand: 'Quest', category: 'Protein Cookies', qty: 5, low_threshold: 2, flavour: 'Chocolate Chip' },
      { id: 'i3', name: 'Road Helmet', brand: 'Trek', category: 'Helmet', qty: 3, low_threshold: 1 },
    ],
  };

  test.beforeEach(async ({ page }) => {
    await stubSupabase(page, fixtures);
    await unlockStaff(page);
    await page.goto('/');
    await goStaffTab(page, 'inventory');
  });

  test('custom supplement categories land in Supplements & Beverages on a fresh device', async ({ page }) => {
    await page.locator('.inv-navbtn', { hasText: 'Supplements' }).click();
    const inv = page.locator('#tab-inventory');
    await expect(inv.getByText('Recover Vitamin Water').first()).toBeVisible();
    await expect(inv.getByText('Choc Chip Protein Cookies').first()).toBeVisible();
    await expect(inv.getByText('Road Helmet')).toHaveCount(0);
  });

  test('equipment shows only equipment items', async ({ page }) => {
    await page.locator('.inv-navbtn', { hasText: 'Equipment' }).click();
    const inv = page.locator('#tab-inventory');
    await expect(inv.getByText('Road Helmet').first()).toBeVisible();
    await expect(inv.getByText('Recover Vitamin Water')).toHaveCount(0);
    await expect(inv.getByText('Choc Chip Protein Cookies')).toHaveCount(0);
  });
});
