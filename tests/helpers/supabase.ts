import type { Page } from '@playwright/test';

export type Fixtures = Record<string, unknown[]>;

// Intercepts every request to *.supabase.co so tests never touch the real
// database. GETs return the fixture rows for the table (default: empty),
// writes are echoed back as if they succeeded.
export async function stubSupabase(page: Page, fixtures: Fixtures = {}) {
  await page.route('**://*.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 200, headers: cors() });
    }

    const m = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = m ? m[1] : null;

    if (method === 'GET' || method === 'HEAD') {
      const rows = (table && fixtures[table]) || [];
      return route.fulfill({
        status: 200,
        headers: { ...cors(), 'content-type': 'application/json', 'content-range': `0-${rows.length}/${rows.length}` },
        body: JSON.stringify(rows),
      });
    }

    // POST/PATCH/DELETE: pretend it worked, echo the payload back.
    let body: unknown = [];
    try {
      const sent = req.postDataJSON();
      body = Array.isArray(sent) ? sent : [sent];
    } catch { /* non-JSON body */ }
    return route.fulfill({
      status: method === 'POST' ? 201 : 200,
      headers: { ...cors(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
  };
}

// Unlocks the staff panel locally, exactly like a successful PIN entry does.
export async function unlockStaff(page: Page) {
  await page.addInitScript(() => localStorage.setItem('cq_staff', '1'));
}
