import {describe,expect,it} from 'vitest';
import {createWorkSessionTask,InMemoryWorkSessionTaskRepository} from './work-session.js';
import {InMemoryWorkSessionTaskLeaseManager} from './work-session-lease.js';

function task(id:string,deps:string[]=[]){
  return createWorkSessionTask({
    id,workSessionId:'ws-lease',ownerUserId:'user-1',domain:'runtime',capability:`runtime.${id}`,
    authorityRef:'context-only',idempotencyKey:`idem-${id}`,correlationId:'corr-lease',
    dependencyIds:deps,createdAt:'2026-09-26T00:00:00.000Z',maxAttempts:2,
  });
}

describe('WorkSession task leases',()=>{
  it('claims dependency-ready work once and heartbeats the owning worker',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    await repo.create(task('a'));
    const leases=new InMemoryWorkSessionTaskLeaseManager(repo);

    const claim=await leases.claim({
      workSessionId:'ws-lease',ownerUserId:'user-1',workerId:'worker-1',leaseToken:'token-1',
      now:'2026-09-26T00:00:01.000Z',leaseDurationMs:10_000,
    });
    expect(claim?.task.status).toBe('running');
    expect(claim?.task.attempt).toBe(1);

    const second=await leases.claim({
      workSessionId:'ws-lease',ownerUserId:'user-1',workerId:'worker-2',leaseToken:'token-2',
      now:'2026-09-26T00:00:02.000Z',leaseDurationMs:10_000,
    });
    expect(second).toBeNull();

    const heartbeat=await leases.heartbeat({
      workSessionId:'ws-lease',taskId:'a',workerId:'worker-1',leaseToken:'token-1',
      now:'2026-09-26T00:00:05.000Z',leaseDurationMs:10_000,
    });
    expect(heartbeat.expiresAt).toBe('2026-09-26T00:00:15.000Z');
  });

  it('recovers expired work into retrying and lets another worker reclaim it',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    await repo.create(task('a'));
    const leases=new InMemoryWorkSessionTaskLeaseManager(repo);

    await leases.claim({
      workSessionId:'ws-lease',ownerUserId:'user-1',workerId:'worker-1',leaseToken:'token-1',
      now:'2026-09-26T00:00:01.000Z',leaseDurationMs:1_000,
    });
    const recovered=await leases.recoverExpired('ws-lease','2026-09-26T00:00:03.000Z');
    expect(recovered.map(x=>x.status)).toEqual(['retrying']);

    const reclaimed=await leases.claim({
      workSessionId:'ws-lease',ownerUserId:'user-1',workerId:'worker-2',leaseToken:'token-2',
      now:'2026-09-26T00:00:04.000Z',leaseDurationMs:10_000,
    });
    expect(reclaimed?.task.attempt).toBe(2);

    await leases.recoverExpired('ws-lease','2026-09-26T00:00:15.000Z');
    expect((await repo.get('ws-lease','a'))?.status).toBe('failed');
  });

  it('requires the active lease owner to finish work',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    await repo.create(task('a'));
    const leases=new InMemoryWorkSessionTaskLeaseManager(repo);
    await leases.claim({
      workSessionId:'ws-lease',ownerUserId:'user-1',workerId:'worker-1',leaseToken:'token-1',
      now:'2026-09-26T00:00:01.000Z',leaseDurationMs:10_000,
    });
    await expect(leases.finish({
      workSessionId:'ws-lease',taskId:'a',workerId:'worker-2',leaseToken:'bad',now:'2026-09-26T00:00:02.000Z',
      status:'completed',
    })).rejects.toThrow(/LEASE_OWNER_MISMATCH/);

    const done=await leases.finish({
      workSessionId:'ws-lease',taskId:'a',workerId:'worker-1',leaseToken:'token-1',now:'2026-09-26T00:00:02.000Z',
      status:'completed',outputRefs:['asset:1'],
    });
    expect(done.status).toBe('completed');
    expect(done.outputRefs).toEqual(['asset:1']);
  });

  it('respects capability filters so workers only claim compatible work',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    await repo.create(task('video'));
    await repo.create(task('sam'));
    const leases=new InMemoryWorkSessionTaskLeaseManager(repo);

    const claim=await leases.claim({
      workSessionId:'ws-lease',ownerUserId:'user-1',workerId:'sam-worker',leaseToken:'token-sam',
      now:'2026-09-26T00:00:01.000Z',leaseDurationMs:10_000,capabilityNames:['runtime.sam'],
    });
    expect(claim?.task.id).toBe('sam');
  });
});
