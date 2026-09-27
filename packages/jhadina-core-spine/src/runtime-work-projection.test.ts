import {describe,expect,it} from 'vitest';
import {createWorkSessionTask,evolveWorkSessionTask} from './work-session.js';
import {buildRuntimeWorkProjection} from './runtime-work-projection.js';

function base(id:string,domain='runtime'){
  return createWorkSessionTask({
    id,workSessionId:'ws-summary',ownerUserId:'u1',domain,capability:`${domain}.${id}`,
    authorityRef:'context-only',idempotencyKey:`idem-${id}`,correlationId:'corr-summary',
    createdAt:'2026-09-26T00:00:00.000Z',maxAttempts:2,
  });
}

function running(id:string,domain='runtime'){
  return evolveWorkSessionTask(evolveWorkSessionTask(base(id,domain),{status:'ready',updatedAt:'2026-09-26T00:00:01.000Z'}),{
    status:'running',attempt:1,updatedAt:'2026-09-26T00:00:02.000Z',
  });
}

describe('runtime work projection',()=>{
  it('summarizes automatic, human and terminal work without exposing task payloads',()=>{
    const active=running('render','director');
    const approval=evolveWorkSessionTask(running('publish','social'),{status:'waiting-approval',updatedAt:'2026-09-26T00:00:03.000Z'});
    const done=evolveWorkSessionTask(running('scan','sam'),{status:'completed',updatedAt:'2026-09-26T00:00:04.000Z'});
    const projection=buildRuntimeWorkProjection('ws-summary',[active,approval,done]);
    expect(projection.totalTasks).toBe(3);
    expect(projection.automaticInFlightCount).toBe(1);
    expect(projection.humanAttentionCount).toBe(1);
    expect(projection.terminalCount).toBe(1);
    expect(projection.countsByDomain).toEqual({director:1,sam:1,social:1});
    expect(projection.countsByStatus.running).toBe(1);
    expect(projection.recent.map(x=>x.id)).toEqual(['scan','publish','render']);
    expect(projection.recent[0]).not.toHaveProperty('authorityRef');
    expect(projection.recent[0]).not.toHaveProperty('inputRefs');
  });

  it('rejects cross-session data and invalid limits',()=>{
    expect(()=>buildRuntimeWorkProjection('other',[base('x')])).toThrow(/SCOPE_MISMATCH/);
    expect(()=>buildRuntimeWorkProjection('ws-summary',[],101)).toThrow(/RECENT_LIMIT_INVALID/);
  });
});
