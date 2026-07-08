import { test, expect } from '@playwright/test';
import { stubSupabase, unlockStaff, waitForSb } from './helpers/supabase';

// A queued offline sale/booking must survive a full localStorage: the disposable snapshot cache
// is evicted to make room instead of silently dropping the write.
test('critical outbox write evicts the snapshot and succeeds when quota is full', async ({ page }) => {
  await stubSupabase(page);
  await unlockStaff(page);
  await page.goto('/');
  await waitForSb(page);

  const result = await page.evaluate(`(()=>{
    localStorage.setItem('cq_snapshot', 'BIG-DISPOSABLE-CACHE');
    const real=Storage.prototype.setItem;
    let firstTry=true;
    // First setItem for the outbox throws quota; after cq_snapshot is removed, allow it.
    Storage.prototype.setItem=function(k,v){
      if(k==='cq_sales_outbox' && firstTry && localStorage.getItem('cq_snapshot')!==null){
        throw new DOMException('quota','QuotaExceededError');
      }
      return real.call(this,k,v);
    };
    let toasted='';
    const realToast=window.toast; window.toast=(m)=>{toasted=m;};
    const ok=_lsSetCritical('cq_sales_outbox', JSON.stringify([{oid:'x',kind:'upsert',id:'s1'}]));
    Storage.prototype.setItem=real; window.toast=realToast;
    return { ok, saved: localStorage.getItem('cq_sales_outbox'), snapshotGone: localStorage.getItem('cq_snapshot')===null, toasted };
  })()`) as { ok: boolean; saved: string | null; snapshotGone: boolean; toasted: string };

  expect(result.ok).toBe(true);                    // the write ultimately succeeded
  expect(result.saved).toContain('upsert');        // the sale IS persisted
  expect(result.snapshotGone).toBe(true);          // the disposable cache was evicted
  expect(result.toasted).toBe('');                 // no error toast — it recovered silently
});
