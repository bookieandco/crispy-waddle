import {describe,expect,it} from 'vitest';
import {
  createWorkSessionTask,
  InMemoryWorkSessionTaskRepository,
  evolveWorkSessionTask,
  listReadyWorkSessionTasks,
  reconcileWorkSessionTaskReadiness,
  claimNextReadyWorkSessionTask,
  validateWorkSessionTaskGraph,
} from './work-session.js';

function task(id:string,deps:string[]=[]){
  return createWorkSessionTask({
    id,
    workSessionId:'ws-1',
    ownerUserId:'user-1',
    domain:'runtime',
    capability:`runtime.${id}`,
    authorityRef:'context-only',
    idempotencyKey:`idem-${id}`,
    correlationId:'corr-1',
    dependencyIds:deps,
    createdAt:'2026-09-26T00:00:00.000Z',
  });
}

describe('WorkSession task graph',()=>{
  it('creates dependency-aware tasks without granting execution authority',()=>{
    const parent=task('parent');
    const child=task('child',['parent']);
    expect(parent.status).toBe('queued');
    expect(child.status).toBe('waiting-dependency');
    expect(child.authorityRef).toBe('context-only');
    expect(child.version).toBe(1);
  });

  it('rejects cycles and missing dependencies',()=>{
    const a=task('a',['b']);
    const b=task('b',['a']);
    expect(()=>validateWorkSessionTaskGraph([a,b])).toThrow(/WORK_SESSION_TASK_CYCLE/);
    expect(()=>validateWorkSessionTaskGraph([task('orphan',['missing'])])).toThrow(/DEPENDENCY_MISSING/);
  });

  it('only exposes tasks whose dependencies are completed',()=>{
    const parent=evolveWorkSessionTask(
      evolveWorkSessionTask(task('parent'),{status:'ready',updatedAt:'2026-09-26T00:00:01.000Z'}),
      {status:'running',updatedAt:'2026-09-26T00:00:02.000Z'},
    );
    const child=task('child',['parent']);
    expect(listReadyWorkSessionTasks([parent,child])).toHaveLength(0);
    const done=evolveWorkSessionTask(parent,{status:'completed',updatedAt:'2026-09-26T00:00:03.000Z'});
    expect(listReadyWorkSessionTasks([done,child]).map(t=>t.id)).toEqual(['child']);
  });

  it('enforces legal state transitions, attempts and block reasons',()=>{
    const queued=task('x');
    expect(()=>evolveWorkSessionTask(queued,{status:'completed'})).toThrow(/TRANSITION_INVALID/);
    const ready=evolveWorkSessionTask(queued,{status:'ready'});
    const running=evolveWorkSessionTask(ready,{status:'running',attempt:1});
    expect(running.version).toBe(3);
    expect(()=>evolveWorkSessionTask(running,{status:'blocked'})).toThrow(/BLOCK_REASON_REQUIRED/);
    const blocked=evolveWorkSessionTask(running,{status:'blocked',blockedReason:'provider unavailable'});
    expect(blocked.blockedReason).toBe('provider unavailable');
  });
});


describe('WorkSession task repository',()=>{
  it('enforces idempotency and optimistic versioning',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    const original=task('persisted');
    await repo.create(original);
    await expect(repo.create(task('duplicate'))).resolves.toBeUndefined();

    const conflicting=createWorkSessionTask({
      id:'another-id',workSessionId:'ws-1',ownerUserId:'user-1',domain:'runtime',capability:'runtime.other',
      authorityRef:'context-only',idempotencyKey:'idem-persisted',correlationId:'corr-1',
      createdAt:'2026-09-26T00:00:00.000Z',
    });
    await expect(repo.create(conflicting)).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);

    const ready=evolveWorkSessionTask(original,{status:'ready',updatedAt:'2026-09-26T00:00:01.000Z'});
    await repo.update(ready,1);
    await expect(repo.update(evolveWorkSessionTask(ready,{status:'running'}),1)).rejects.toThrow(/VERSION_CONFLICT/);
    expect((await repo.get('ws-1','persisted'))?.status).toBe('ready');
  });
});


describe('WorkSession task leases',()=>{
  it('prevents double claims and supports heartbeat/release',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    const queued=task('lease');
    const ready=evolveWorkSessionTask(queued,{status:'ready',updatedAt:'2026-09-26T00:00:01.000Z'});
    await repo.create(ready);

    const first=await repo.claimReady('ws-1','lease','worker-a',60_000);
    expect(first?.status).toBe('running');
    expect(first?.attempt).toBe(1);
    expect(first?.leaseOwner).toBe('worker-a');
    expect(first?.leaseToken).toBeTruthy();

    await expect(repo.claimReady('ws-1','lease','worker-b',60_000)).resolves.toBeNull();
    await expect(repo.renewLease('ws-1','lease','worker-b',first!.leaseToken!,60_000)).resolves.toBeNull();

    const renewed=await repo.renewLease('ws-1','lease','worker-a',first!.leaseToken!,60_000);
    expect(renewed?.leaseExpiresAt).toBeTruthy();
    expect(renewed?.version).toBeGreaterThan(first!.version);

    const released=await repo.releaseLease('ws-1','lease','worker-a',renewed!.leaseToken!,'completed');
    expect(released?.status).toBe('completed');
    expect(released?.leaseOwner).toBeUndefined();
    expect(released?.leaseToken).toBeUndefined();
  });
});


describe('WorkSession readiness and crash recovery',()=>{
  it('promotes dependency-satisfied tasks without granting execution authority',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    const queued=task('ready-now');
    await repo.create(queued);
    const promoted=await reconcileWorkSessionTaskReadiness(repo,'ws-1','2026-09-27T00:00:01.000Z');
    expect(promoted.map(item=>item.id)).toEqual(['ready-now']);
    expect((await repo.get('ws-1','ready-now'))?.status).toBe('ready');
    expect((await repo.get('ws-1','ready-now'))?.authorityRef).toBe('context-only');
  });

  it('reclaims an expired running lease after worker loss',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    const ready=evolveWorkSessionTask(task('recover'),{status:'ready'});
    await repo.create(ready);
    const first=await repo.claimReady('ws-1','recover','worker-a',1);
    expect(first?.attempt).toBe(1);
    await new Promise(resolve=>setTimeout(resolve,5));
    const recovered=await repo.claimReady('ws-1','recover','worker-b',60_000);
    expect(recovered?.leaseOwner).toBe('worker-b');
    expect(recovered?.attempt).toBe(2);
  });
});


describe('WorkSession worker selection',()=>{
  it('claims only capability-compatible work in deterministic order',async()=>{
    const repo=new InMemoryWorkSessionTaskRepository();
    await repo.create(task('alpha'));
    await repo.create(createWorkSessionTask({
      id:'render',workSessionId:'ws-1',ownerUserId:'user-1',domain:'director',capability:'director.render',
      authorityRef:'context-only',idempotencyKey:'idem-render',correlationId:'corr-1',createdAt:'2026-09-26T00:00:01.000Z',
    }));
    const claimed=await claimNextReadyWorkSessionTask(repo,{
      workSessionId:'ws-1',workerId:'director-worker',leaseMs:60_000,
      ownerUserId:'user-1',capabilityNames:['director.render'],
    });
    expect(claimed?.id).toBe('render');
    expect(claimed?.status).toBe('running');
    expect((await repo.get('ws-1','alpha'))?.status).toBe('ready');
  });
});
