import {describe,expect,it} from 'vitest';
import {
  createWorkSessionTask,
  evolveWorkSessionTask,
  listReadyWorkSessionTasks,
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
