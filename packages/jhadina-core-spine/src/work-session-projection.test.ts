import {describe,expect,it} from 'vitest';
import {
  createWorkSessionTask,
  evolveWorkSessionTask,
} from './work-session.js';
import {buildWorkSessionRuntimeProjection} from './work-session-projection.js';

function task(id:string,domain='runtime'){
  return createWorkSessionTask({
    id,
    workSessionId:'ws-1',
    ownerUserId:'user-1',
    domain,
    capability:`${domain}.${id}`,
    authorityRef:'context-only',
    idempotencyKey:`idem-${id}`,
    correlationId:'corr-1',
    createdAt:'2026-09-27T00:00:00Z',
  });
}

describe('WorkSession runtime projection',()=>{
  it('separates human gates from recoverable system work',()=>{
    const approval=evolveWorkSessionTask(
      evolveWorkSessionTask(task('approve','growth'),{status:'ready'}),
      {status:'waiting-approval'},
    );
    const blocked=evolveWorkSessionTask(
      evolveWorkSessionTask(task('blocked','sam'),{status:'ready'}),
      {status:'blocked',blockedReason:'credential required'},
    );
    const running=evolveWorkSessionTask(
      evolveWorkSessionTask(task('recover','director'),{status:'ready'}),
      {status:'running',attempt:1},
    );
    const expired={
      ...running,
      leaseOwner:'worker-a',
      leaseToken:'lease-a',
      leaseExpiresAt:'2026-09-27T00:01:00Z',
    };

    const projection=buildWorkSessionRuntimeProjection(
      [approval,blocked,expired],
      '2026-09-27T00:02:00Z',
    );

    expect(projection.humanAttention.map(item=>item.kind)).toEqual(['approval','blocked']);
    expect(projection.systemAttention.map(item=>item.kind)).toEqual(['lease-recovery']);
    expect(projection.countsByDomain).toEqual({growth:1,sam:1,director:1});
  });

  it('escalates exhausted retry budget instead of pretending recovery is automatic',()=>{
    const running=evolveWorkSessionTask(
      evolveWorkSessionTask(task('exhausted'),{status:'ready'}),
      {status:'running',attempt:3},
    );
    const expired={...running,leaseOwner:'worker-a',leaseToken:'lease-a',leaseExpiresAt:'2026-09-27T00:01:00Z'};
    const projection=buildWorkSessionRuntimeProjection([expired],'2026-09-27T00:02:00Z');
    expect(projection.humanAttention[0]).toMatchObject({kind:'retry-exhausted',requiresHuman:true});
    expect(projection.systemAttention).toHaveLength(0);
  });

  it('rejects mixed WorkSession projections',()=>{
    const other={...task('other'),workSessionId:'ws-2'};
    expect(()=>buildWorkSessionRuntimeProjection([task('one'),other],'2026-09-27T00:00:00Z'))
      .toThrow('WORK_SESSION_RUNTIME_SCOPE_MISMATCH');
  });
});
