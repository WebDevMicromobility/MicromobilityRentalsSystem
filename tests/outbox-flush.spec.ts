import { test, expect } from '@playwright/test';
import { stubSupabase, loginCustomer, waitForSb } from './helpers/supabase';

// An offline booking whose client-assigned queue_num collides with another device's booking must
// re-number and sync — not get stuck retrying the same rejected number forever.
test('outbox flush re-numbers a colliding booking instead of getting stuck', async ({ page }) => {
  await stubSupabase(page, {
    sessions: [{ id: 's1', day: 'Friday', session_date: '2099-01-09', capacity: 12, status: 'open', created_at: 1 }],
    // session already has #1 and #2 taken (synced from another device), so nextQNum => 3
    queue_entries: [
      { id: 'other1', name: 'A', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 1, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:00:00Z' },
      { id: 'other2', name: 'B', session_id: 's1', session_day: 'Friday', session_date: '2099-01-09', queue_num: 2, status: 'waiting', paid: false, price: 30, registered_at: '2099-01-09T10:01:00Z' },
    ],
  });
  await loginCustomer(page, { id: 'c1' });
  await page.goto('/');
  await waitForSb(page);

  const result = await page.evaluate(`(async()=>{
    // queue a stuck offline booking that collided on queue_num=2
    const row={ id:'mine', name:'Mine', session_id:'s1', session_day:'Friday', session_date:'2099-01-09', queue_num:2, status:'waiting', paid:false, price:30, registered_at:'2099-01-09T10:02:00Z' };
    localStorage.setItem('cq_book_outbox', JSON.stringify([row]));
    S.queue.push(entryFromDB(row));

    let attempt=0; const upserts=[];
    const realFrom=sb.from.bind(sb);
    sb.from=(t)=>{ const q=realFrom(t);
      if(t==='queue_entries'){ const realUp=q.upsert.bind(q);
        q.upsert=(r)=>{ upserts.push(JSON.parse(JSON.stringify(r))); attempt++;
          // first upsert of the colliding #2 fails with 23505; the re-numbered one succeeds
          if(r.queue_num===2){ return Promise.resolve({ error:{ code:'23505', message:'duplicate key value violates unique constraint "queue_entries_session_qnum_uniq"' } }); }
          return Promise.resolve({ error:null, data:[r] });
        };
      }
      return q;
    };
    await _bookOutboxFlush();
    return { attempts: attempt, upserts, outboxLeft: JSON.parse(localStorage.getItem('cq_book_outbox')||'[]'), liveNum: (S.queue.find(e=>e.id==='mine')||{}).queueNum };
  })()`) as { attempts: number; upserts: Array<{ queue_num: number }>; outboxLeft: unknown[]; liveNum: number };

  expect(result.attempts).toBe(2);              // collided once, retried once
  expect(result.upserts[1].queue_num).toBe(3);  // re-numbered to the next free slot
  expect(result.outboxLeft.length).toBe(0);     // synced → cleared, not stuck
  expect(result.liveNum).toBe(3);               // the on-screen booking reflects the new number
});
