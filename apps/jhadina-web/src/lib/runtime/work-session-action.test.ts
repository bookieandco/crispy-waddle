import {describe,expect,it} from 'vitest';
import type {ActionRequest} from '@jhadina/action-core';
import {createWorkSessionTask,evolveWorkSessionTask} from '@jhadina/core-spine';
import {assertActionRequestBoundToWorkSessionTask,bindActionRequestToWorkSessionTask} from './work-session-action';

function runningTask(){
  const created=createWorkSessionTask({
    id:'publish-1',workSessionId:'ws-action',ownerUserId:'u1',domain:'social',capability:'social.publish',
    authorityRef:'social-proposal:1',idempotencyKey:'idem-publish-1',correlationId:'corr-action',causationId:'task-parent',
    createdAt:'2026-09-26T00:00:00.000Z',
  });
  const ready=evolveWorkSessionTask(created,{status:'ready',updatedAt:'2026-09-26T00:00:01.000Z'});
  return evolveWorkSessionTask(ready,{status:'running',attempt:1,updatedAt:'2026-09-26T00:00:02.000Z'});
}

function request():ActionRequest<{postId:string}>{
  return {
    id:'action-1',userId:'u1',type:'social.publish',action:{postId:'post-1'},
    requestedAt:'2026-09-26T00:00:03.000Z',
  };
}

describe('WorkSession -> Action Core bridge',()=>{
  it('binds canonical task lineage without changing the requested action',()=>{
    const task=runningTask();
    const bound=bindActionRequestToWorkSessionTask(request(),task);
    expect(bound.action).toEqual({postId:'post-1'});
    expect(bound.type).toBe('social.publish');
    expect(bound.runtimeContext).toEqual({
      workSessionId:'ws-action',taskId:'publish-1',correlationId:'corr-action',causationId:'task-parent',
      domain:'social',capability:'social.publish',idempotencyKey:'idem-publish-1',
    });
    assertActionRequestBoundToWorkSessionTask(bound,task);
  });

  it('rejects owner mismatch before Action Core sees the request',()=>{
    expect(()=>bindActionRequestToWorkSessionTask({...request(),userId:'other'},runningTask())).toThrow(/OWNER_MISMATCH/);
  });

  it('rejects caller-supplied lineage that disagrees with the task',()=>{
    const req:ActionRequest<{postId:string}>={
      ...request(),
      runtimeContext:{
        workSessionId:'other',taskId:'publish-1',correlationId:'corr-action',domain:'social',
        capability:'social.publish',idempotencyKey:'idem-publish-1',
      },
    };
    expect(()=>bindActionRequestToWorkSessionTask(req,runningTask())).toThrow(/LINEAGE_MISMATCH:workSessionId/);
  });

  it('allows approval-waiting retries but rejects tasks that were never started',()=>{
    const task=runningTask();
    const approval=evolveWorkSessionTask(task,{status:'waiting-approval',updatedAt:'2026-09-26T00:00:04.000Z'});
    expect(()=>bindActionRequestToWorkSessionTask(request(),approval)).not.toThrow();

    const queued=createWorkSessionTask({
      id:'q',workSessionId:'ws-action',ownerUserId:'u1',domain:'money',capability:'money.execute',
      authorityRef:'proposal:q',idempotencyKey:'q',correlationId:'corr-q',
    });
    expect(()=>bindActionRequestToWorkSessionTask(request(),queued)).toThrow(/TASK_NOT_EXECUTABLE:queued/);
  });
});
