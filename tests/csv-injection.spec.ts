import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// CSV/formula injection: a cell beginning with = + - @ (or tab/CR) must be neutralized so it
// can't execute when a staffer opens an exported report in Excel/Google Sheets.
test('_csvCell neutralizes formula-injection payloads and still quotes correctly', async ({ page }) => {
  await stubSupabase(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);
  const out = await page.evaluate(`({
    hyperlink: _csvCell('=HYPERLINK("http://evil","x")'),
    plus:      _csvCell('+1+1'),
    at:        _csvCell('@SUM(A1:A9)'),
    minus:     _csvCell('-2+3'),
    tab:       _csvCell('\\t=cmd'),
    normal:    _csvCell('Faisal Babalghoum'),
    comma:     _csvCell('Ali, the rider'),
    quote:     _csvCell('He said "hi"'),
    formulaWithComma: _csvCell('=A1,evil'),
    empty:     _csvCell(null),
    number:    _csvCell(57.5),
  })`);
  // dangerous leads get a literal-text quote prefix
  expect(out.hyperlink).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`); // prefixed AND quoted (has commas)
  expect(out.plus.startsWith("'+")).toBe(true);
  expect(out.at.startsWith("'@")).toBe(true);
  expect(out.minus.startsWith("'-")).toBe(true);
  expect(out.tab.startsWith("'")).toBe(true);
  // normal values are untouched (except needed quoting)
  expect(out.normal).toBe('Faisal Babalghoum');
  expect(out.comma).toBe('"Ali, the rider"');
  expect(out.quote).toBe('"He said ""hi"""');
  // a formula that also contains a comma must be BOTH prefixed and quoted
  expect(out.formulaWithComma).toBe(`"'=A1,evil"`);
  expect(out.empty).toBe('');
  expect(out.number).toBe('57.5');
});
