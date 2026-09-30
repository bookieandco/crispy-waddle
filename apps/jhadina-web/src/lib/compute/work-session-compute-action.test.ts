import { describe, expect, it } from 'vitest';
import type { WorkSessionTask } from '@jhadina/core-spine';
import type { ComputeExecutionBundle } from '@jhadina/compute-core';
import { computeActionRequestFromWorkSessionTask } from './work-session-compute-action';

const task:WorkSessionTask={
  id:'task-1',
  workSessionId:'ws-1',
  ownerUserId:'11111111-1111-1111-1111-111111111111',
  domain:'director',
  capability:'director.render',
  status:'running',
  authorityRef:'director:render:1',
  idempotencyKey:'idem-1',
  correlationId:'corr-1',
  dependencyIds:[],
  inputRefs:['asset:source'],
  outputRefs:[],
  attempt:1,
  maxAttempts:3,
  version:2,
  leaseOwner:'worker-1',
  leaseToken:'lease-1',
  leaseExpiresAt:'2026-09-27T07:01:00Z',
  createdAt:'2026-09-27T07:00:00Z',
  updatedAt:'2026-09-27T07:00:00Z',
};

const bundle:ComputeExecutionBundle={
  workload:{
    id:'compute-task-1',
    source:'director',
    kind:'render',
    queue:'render',
    priority:500,
    authority:{
      system:'jhadina-one-runtime',
      jobId:'task-1',
      idempotencyKey:'idem-1',
      projectId:'ws-1',
    },
    resourceProfileId:'director.render',
    resources:{cpuCores:8,ramGiB:32,scratchGiB:100},
    createdAt:'2026-09-27T07:00:00Z',
  },
  storageIntent:{
    id:'storage-1',
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
    createdAt:'2026-09-27T07:00:00Z',
  },
  storagePlan:{
    intentId:'storage-1',
    admissible:true,
    blockingReasons:[],
    primaryBackendId:'cephfs-hot',
    primaryCandidates:[],
    cacheCandidates:[],
    rejectedPrimary:[],
    rejectedCache:[],
    strategy:['range-stream'],
  },
  placement:{
    workloadId:'compute-task-1',
    selectedNodeId:'cpu-render-1',
    candidates:[{nodeId:'cpu-render-1',score:100,reasons:['homebase-local']}],
    rejected:[],
  },
  target:'kubernetes-job',
  worker:{image:'registry.local/render',imageDigest:'sha256:abc'},
  mode:'shadow',
};

describe('WorkSession -> compute ActionRequest bridge',()=>{
  it('preserves owner, task, capability and idempotency lineage without granting authority',()=>{
    const request=computeActionRequestFromWorkSessionTask(task,bundle,{
      actionRequestId:'action-1',
      requestedAt:'2026-09-27T07:00:30Z',
    });
    expect(request.type).toBe('compute.submit');
    expect(request.userId).toBe(task.ownerUserId);
    expect(request.runtimeContext).toEqual({
      workSessionId:'ws-1',
      taskId:'task-1',
      correlationId:'corr-1',
      causationId:undefined,
      domain:'director',
      capability:'director.render',
      idempotencyKey:'idem-1',
    });
  });

  it('requires a running task with a live worker lease',()=>{
    expect(()=>computeActionRequestFromWorkSessionTask({...task,status:'ready'},bundle,{
      actionRequestId:'action-1',requestedAt:'2026-09-27T07:00:30Z',
    })).toThrow('COMPUTE_TASK_NOT_RUNNING:ready');
    expect(()=>computeActionRequestFromWorkSessionTask({...task,leaseToken:undefined},bundle,{
      actionRequestId:'action-1',requestedAt:'2026-09-27T07:00:30Z',
    })).toThrow('COMPUTE_TASK_ACTIVE_LEASE_REQUIRED');
    expect(()=>computeActionRequestFromWorkSessionTask(task,bundle,{
      actionRequestId:'action-1',requestedAt:'2026-09-27T07:02:00Z',
    })).toThrow('COMPUTE_TASK_LEASE_EXPIRED');
  });

  it('rejects any compute bundle whose ONE-RUNTIME lineage drifts from the claimed task',()=>{
    expect(()=>computeActionRequestFromWorkSessionTask(task,{
      ...bundle,
      workload:{
        ...bundle.workload,
        authority:{...bundle.workload.authority,jobId:'task-2'},
      },
    },{
      actionRequestId:'action-1',requestedAt:'2026-09-27T07:00:30Z',
    })).toThrow('COMPUTE_TASK_WORKLOAD_TASK_MISMATCH');
  });
});
