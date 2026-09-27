import {describe,expect,it} from 'vitest';
import {createWorkSessionTask,evolveWorkSessionTask} from '@jhadina/core-spine';
import {assertComputeDraftBoundToTask,workSessionTaskComputeDraft} from './work-session-compute';

function readyTask(){
  const task=createWorkSessionTask({
    id:'render-1',workSessionId:'ws-compute',ownerUserId:'u1',domain:'director',capability:'director.render',
    authorityRef:'director-job:1',idempotencyKey:'idem-render-1',correlationId:'corr-1',
    inputRefs:['asset:scene-1'],createdAt:'2026-09-26T00:00:00.000Z',
  });
  return evolveWorkSessionTask(task,{status:'ready',updatedAt:'2026-09-26T00:00:01.000Z'});
}

describe('WorkSession -> Compute bridge',()=>{
  it('preserves task lineage and locality without executing anything',()=>{
    const task=readyTask();
    const draft=workSessionTaskComputeDraft(task,{
      source:'director',kind:'render',resourceProfileId:'director.render.local',
      constraints:{sensitiveData:true,allowCloudBurst:false},
      dataLocalityKeys:['asset:scene-1'],
      createdAt:'2026-09-26T00:00:02.000Z',
    });
    expect(draft.authority).toEqual({
      system:'jhadina-work-session-task',
      jobId:'ws-compute:render-1',
      idempotencyKey:'idem-render-1',
    });
    expect(draft.dataLocalityKeys).toEqual([
      'work-session:ws-compute',
      'task:render-1',
      'input:asset:scene-1',
      'asset:scene-1',
    ]);
    expect(draft.constraints?.sensitiveData).toBe(true);
    assertComputeDraftBoundToTask(task,draft);
  });

  it('allows cloud-burst eligibility metadata without treating it as Action Core authority',()=>{
    const draft=workSessionTaskComputeDraft(readyTask(),{
      source:'director',kind:'render',resourceProfileId:'director.render.cloud-eligible',
      constraints:{allowCloudBurst:true,sensitiveData:false,maxCostUsdPerHour:2},
    });
    expect(draft.constraints?.allowCloudBurst).toBe(true);
    expect(draft.authority.system).toBe('jhadina-work-session-task');
  });

  it('rejects tasks that are not ready or retrying',()=>{
    const queued=createWorkSessionTask({
      id:'q',workSessionId:'ws-compute',ownerUserId:'u1',domain:'sam',capability:'sam.refresh',
      authorityRef:'sam-job:q',idempotencyKey:'q',correlationId:'corr-q',
    });
    expect(()=>workSessionTaskComputeDraft(queued,{
      source:'other',kind:'batch-analysis',resourceProfileId:'background.small',
    })).toThrow(/TASK_NOT_DISPATCHABLE:queued/);
  });

  it('detects mutated compute lineage before submission',()=>{
    const task=readyTask();
    const draft=workSessionTaskComputeDraft(task,{
      source:'director',kind:'render',resourceProfileId:'director.render.local',
    });
    expect(()=>assertComputeDraftBoundToTask(task,{
      ...draft,
      authority:{...draft.authority,idempotencyKey:'tampered'},
    })).toThrow(/IDEMPOTENCY_MISMATCH/);
  });
});
