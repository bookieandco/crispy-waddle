import {describe,expect,it} from 'vitest';
import {createWorkSessionTask,evolveWorkSessionTask} from './work-session.js';
import {buildRuntimeAttentionProjection} from './runtime-attention.js';

function base(id:string){
  return createWorkSessionTask({
    id,workSessionId:'ws-attn',ownerUserId:'u1',domain:'runtime',capability:`runtime.${id}`,
    authorityRef:'context-only',idempotencyKey:`idem-${id}`,correlationId:'corr-attn',
    createdAt:'2026-09-26T00:00:00.000Z',maxAttempts:2,
  });
}

function running(id:string,attempt=1){
  return evolveWorkSessionTask(evolveWorkSessionTask(base(id),{status:'ready',updatedAt:'2026-09-26T00:00:01.000Z'}),{
    status:'running',attempt,updatedAt:'2026-09-26T00:00:02.000Z',
  });
}

describe('runtime attention projection',()=>{
  it('surfaces only work that needs a human',()=>{
    const approval=evolveWorkSessionTask(running('approval'),{status:'waiting-approval',updatedAt:'2026-09-26T00:00:03.000Z'});
    const blocked=evolveWorkSessionTask(running('blocked'),{status:'blocked',blockedReason:'provider credential missing',updatedAt:'2026-09-26T00:00:04.000Z'});
    const complete=evolveWorkSessionTask(running('done'),{status:'completed',updatedAt:'2026-09-26T00:00:05.000Z'});
    const projection=buildRuntimeAttentionProjection([approval,blocked,complete]);
    expect(projection.needsHuman).toBe(true);
    expect(projection.items.map(x=>x.taskId)).toEqual(['blocked','approval']);
    expect(projection.approvalCount).toBe(1);
    expect(projection.blockerCount).toBe(1);
  });

  it('makes exhausted failures critical and ordinary pauses medium',()=>{
    const exhausted=evolveWorkSessionTask(running('failed',2),{status:'failed',updatedAt:'2026-09-26T00:00:05.000Z'});
    const paused=evolveWorkSessionTask(running('paused'),{status:'paused',updatedAt:'2026-09-26T00:00:06.000Z'});
    const projection=buildRuntimeAttentionProjection([paused,exhausted]);
    expect(projection.items[0]).toMatchObject({taskId:'failed',severity:'critical',action:'REVIEW_FAILURE'});
    expect(projection.items[1]).toMatchObject({taskId:'paused',severity:'medium',action:'RESUME_OR_CANCEL'});
  });

  it('reports no human work when everything can continue automatically',()=>{
    const tasks=[base('queued'),evolveWorkSessionTask(running('done'),{status:'completed'})];
    const projection=buildRuntimeAttentionProjection(tasks);
    expect(projection.needsHuman).toBe(false);
    expect(projection.items).toEqual([]);
  });
});
