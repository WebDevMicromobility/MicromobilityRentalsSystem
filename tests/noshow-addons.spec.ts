import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// No-show restocks a rider's add-ons; undoing the no-show must re-reserve them, or inventory
// leaks upward (shows more stock than really exists).
test('undoing a no-show re-reserves the rider add-on stock (no leak)', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    inventory: [{ id: 'gel', name: 'Gel', category: 'EnergyGels', qty: 5, price: 8, low_threshold: 1 }],
    queue_entries: [{ id: 'q1', name: 'Rider', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:00:00Z', addons: JSON.stringify([{ id: 'gel', qty: 2 }]) }],
  });
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const r = await page.evaluate(`(async()=>{
    // count inventory writes triggered specifically by the UNDO (before the fix it issued none)
    let phase='noshow'; const writes={noshow:[],undo:[]};
    const realFrom=sb.from.bind(sb);
    sb.from=(t)=>{ const q=realFrom(t);
      if(t==='inventory'){ const u=q.update.bind(q); q.update=(patch)=>{ writes[phase].push(patch.qty); return u(patch); }; }
      return q;
    };
    await doNoShow('q1');                          // restock +2 (5 -> 7)
    phase='undo';
    await S.undoStack[S.undoStack.length-1].fn();  // undo -> must re-reserve (a decrement write)
    return { noshowWrites: writes.noshow, undoWrites: writes.undo };
  })()`) as { noshowWrites: number[]; undoWrites: number[] };

  expect(r.noshowWrites).toContain(7);          // no-show restocked to 7
  expect(r.undoWrites.length).toBeGreaterThan(0); // undo re-reserved (before the fix: 0 writes = the leak)
});
