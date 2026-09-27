import { describe, expect, it } from 'vitest';
import {
  ActionExecutor,
  AllowAllActionPolicy,
  InMemoryActionLedger,
  type ActionRequest,
} from '@jhadina/action-core';
import {
  ShadowComputeSubmitter,
  type ComputeExecutionBundle,
} from '@jhadina/compute-core';
import {
  COMPUTE_SUBMIT_ACTION,
  ComputeSubmitActionHandler,
} from './compute-action-handler';

const bundle:ComputeExecutionBundle={
  workload:{
    id:'one-runtime:ws-1:task-1',
    source:'director',
    kind:'video-generation',
    queue:'creative',
    priority:700,
    authority:{
      system:'jhadina-one-runtime',
      jobId:'task-1',
      idempotencyKey:'idem-1',
      projectId:'ws-1',
    },
    resourceProfileId:'director.video.default',
    resources:{cpuCores:8,ramGiB:32,scratchGiB:100,gpu:{vendor:'nvidia',count:1,minVramGiBPerDevice:16}},
    createdAt:'2026-09-27T03:00:00.000Z',
  },
  storageIntent:{
    id:'storage-task-1',
    authority:{
      system:'jhadina-one-runtime',
      jobId:'task-1',
      idempotencyKey:'idem-1',
      projectId:'ws-1',
    },
    stage:'media-edit',
    accessPattern:'range-stream',
    durability:'durable',
    sensitiveData:true,
    createdAt:'2026-09-27T03:00:00.000Z',
  },
  storagePlan:{
    intentId:'storage-task-1',
    admissible:true,
    blockingReasons:[],
    primaryBackendId:'cephfs-hot',
    cacheBackendId:'nvme-1',
    primaryCandidates:[],
    cacheCandidates:[],
    rejectedPrimary:[],
    rejectedCache:[],
    strategy:['range-stream','read-through-cache'],
  },
  placement:{
    workloadId:'one-runtime:ws-1:task-1',
    selectedNodeId:'gpu-1',
    candidates:[{nodeId:'gpu-1',score:100,reasons:['homebase-local']}],
    rejected:[],
  },
  target:'kubernetes-job',
  worker:{image:'registry.local/jhadina/video-worker',imageDigest:'sha256:abc'},
  mode:'shadow',
};

function request():ActionRequest<ComputeExecutionBundle>{
  return {
    id:'action-1',
    userId:'owner-1',
    type:COMPUTE_SUBMIT_ACTION,
    action:bundle,
    requestedAt:'2026-09-27T03:00:00.000Z',
    runtimeContext:{
      workSessionId:'ws-1',
      taskId:'task-1',
      correlationId:'corr-1',
      domain:'director',
      capability:'director.render',
      idempotencyKey:'idem-1',
    },
  };
}

describe('compute Action Core submission bridge',()=>{
  it('submits only after ActionExecutor policy evaluation and preserves runtime lineage',async()=>{
    const ledger=new InMemoryActionLedger();
    const handler=new ComputeSubmitActionHandler(
      new ShadowComputeSubmitter(),
      ()=>'2026-09-27T03:00:01.000Z',
    );
    const executor=new ActionExecutor(
      new AllowAllActionPolicy<ComputeExecutionBundle>(),
      ledger,
      [handler],
    );
    const receipt=await executor.execute(request());
    expect(receipt.provider).toBe('shadow');
    expect(receipt.workSessionId).toBe('ws-1');
    expect(receipt.taskId).toBe('task-1');
    expect(receipt.idempotencyKey).toBe('idem-1');
    expect(ledger.list().map(event=>event.status)).toEqual(['started','completed']);
  });

  it('rejects task lineage mismatch even after policy allows the action',async()=>{
    const handler=new ComputeSubmitActionHandler(
      new ShadowComputeSubmitter(),
      ()=>'2026-09-27T03:00:01.000Z',
    );
    const executor=new ActionExecutor(
      new AllowAllActionPolicy<ComputeExecutionBundle>(),
      new InMemoryActionLedger(),
      [handler],
    );
    const bad={
      ...request(),
      runtimeContext:{...request().runtimeContext!,taskId:'task-other'},
    };
    await expect(executor.execute(bad)).rejects.toThrow('COMPUTE_ACTION_TASK_MISMATCH');
  });
});
