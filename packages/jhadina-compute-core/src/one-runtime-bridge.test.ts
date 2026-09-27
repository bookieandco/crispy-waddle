import {describe,expect,it} from 'vitest';
import {describeComputeWorkloadForTask} from './one-runtime-bridge.js';

const profiles={
  'video-small':{
    id:'video-small',
    allowedKinds:['video-generation'] as const,
    resources:{cpuCores:4,ramGiB:16,scratchGiB:20,gpu:{count:1,minVramGiBPerDevice:8}},
  },
};

describe('ONE-RUNTIME compute bridge',()=>{
  it('preserves WorkSession authority lineage without becoming task authority',()=>{
    const workload=describeComputeWorkloadForTask({
      id:'task-1',
      workSessionId:'ws-1',
      domain:'director',
      capability:'director.render',
      idempotencyKey:'idem-1',
      status:'running',
      leaseOwner:'worker-a',
      leaseToken:'lease-a',
      leaseExpiresAt:'2026-09-27T00:10:00Z',
      createdAt:'2026-09-27T00:00:00Z',
      updatedAt:'2026-09-27T00:00:01Z',
    },{
      source:'director',
      kind:'video-generation',
      resourceProfileId:'video-small',
      constraints:{sensitiveData:true,allowCloudBurst:false},
    },profiles,'2026-09-27T00:05:00Z');
    expect(workload.authority).toEqual({
      system:'jhadina-one-runtime',
      jobId:'task-1',
      idempotencyKey:'idem-1',
      projectId:'ws-1',
    });
    expect(workload.resources.sensitiveData).toBe(true);
    expect(workload.resources.allowCloudBurst).toBe(false);
  });

  it('rejects unclaimed or expired task leases',()=>{
    expect(()=>describeComputeWorkloadForTask({
      id:'task-2',workSessionId:'ws-1',domain:'director',capability:'director.render',
      idempotencyKey:'idem-2',status:'ready',createdAt:'2026-09-27T00:00:00Z',
    },{
      source:'director',kind:'video-generation',resourceProfileId:'video-small',
    },profiles,'2026-09-27T00:05:00Z')).toThrow(/COMPUTE_TASK_ACTIVE_LEASE_REQUIRED/);

    expect(()=>describeComputeWorkloadForTask({
      id:'task-3',workSessionId:'ws-1',domain:'director',capability:'director.render',
      idempotencyKey:'idem-3',status:'running',leaseOwner:'worker-a',leaseToken:'lease-a',
      leaseExpiresAt:'2026-09-27T00:04:00Z',createdAt:'2026-09-27T00:00:00Z',
    },{
      source:'director',kind:'video-generation',resourceProfileId:'video-small',
    },profiles,'2026-09-27T00:05:00Z')).toThrow(/COMPUTE_TASK_ACTIVE_LEASE_REQUIRED/);
  });
});
