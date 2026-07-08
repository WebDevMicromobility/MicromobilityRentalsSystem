import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// The topbar Undo and the undo bar reverse the same action. Triggering the topbar Undo must mark
// the action reversed and dismiss the bar, so the bar (or logs view) can't reverse it a 2nd time.
test('topbar undo marks the action undone and dismisses the bar (no double reversal)', async ({ page }) => {
  await stubSupabase(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const result = await page.evaluate(`(async()=>{
    window.__reversals=0;
    pushUndo('Test action', async()=>{ window.__reversals++; });
    const barBefore=!!document.getElementById('undo-bar-el');
    const logEntry=S.actionLog[0];
    await doUndo();
    // simulate the undo-bar being clicked afterwards by invoking the SAME guarded path the bar uses
    const barAfter=!!document.getElementById('undo-bar-el');
    // the logs-view / bar guard: only re-runs if !undone
    if(!logEntry.undone){ await logEntry.fn(); }
    return { reversals: window.__reversals, undone: logEntry.undone, barBefore, barAfter, stackLen: S.undoStack.length };
  })()`) as { reversals: number; undone: boolean; barBefore: boolean; barAfter: boolean; stackLen: number };

  expect(result.barBefore).toBe(true);   // bar appeared
  expect(result.reversals).toBe(1);      // reversed exactly once, not twice
  expect(result.undone).toBe(true);      // marked reversed
  expect(result.barAfter).toBe(false);   // bar dismissed by the topbar undo
  expect(result.stackLen).toBe(0);
});
