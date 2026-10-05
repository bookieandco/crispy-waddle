import {describe,expect,it} from 'vitest';
import type {ComputeSubmissionReceipt} from './execution-contract.js';
import {
  HomebaseComputeGateway,
  type DirectorPostGatewaySubmission,
  type HomebaseComputeAdmissionRuntime,
} from './homebase-compute-gateway.js';

const NOW='2026-10-05T03:00:00.000Z';

function input():DirectorPostGatewaySubmission{
  return {
    projectId:'director-project-1',
    ownerUserId:'owner-1',
    task:{
      id:'task-1',
      workSessionId:'work-1',
      domain:'director',
      capability:'director.audio.foley',
      idempotencyKey:'idem-1',
      status:'running',
      leaseOwner:'director-post-autopilot',
      leaseToken:'lease-1',
      leaseExpiresAt:'2026-10-05T03:05:00.000Z',
      createdAt:'2026-10-05T02:59:00.000Z',
      updatedAt:'2026-10-05T03:00:00.000Z',
    },
    descriptor:{
      taskId:'task-1',
      capability:'director.audio.foley',
      workerProfileId:'creative.foley',
      computeBinding:{
        source:'director',
        kind:'foley-generation',
        resourceProfileId:'director.foley.default',
        queue:'creative',
        constraints:{sensitiveData:true,allowCloudBurst:false},
        dataLocalityKeys:['director-project:director-project-1'],
      },
    },
  };
}

function receipt():ComputeSubmissionReceipt{
  return {
    submissionId:'k8s:jhadina-compute:director-foley-1',
    actionRequestId:'action-1',
    userId:'owner-1',
    workloadId:'one-runtime:work-1:task-1',
    workSessionId:'work-1',
    taskId:'task-1',
    idempotencyKey:'idem-1',
    target:'kubernetes-job',
    provider:'kubernetes',
    namespace:'jhadina-compute',
    queueName:'jhadina-creative',
    resourceName:'director-foley-1',
    plannedNodeId:'homebase-gpu-01',
    primaryStorageBackendId:'homebase-media',
    submittedAt:NOW,
    manifestFingerprint:'sha256:manifest',
  };
}

function runtime(ready=true):HomebaseComputeAdmissionRuntime{
  return {
    async readiness(){
      return {ready,reasons:ready?[]:['HOMEBASE_GPU_NOT_READY']};
    },
    async submit(){
      return receipt();
    },
  };
}

describe('Homebase compute gateway',()=>{
  it('reports canonical authority and refuses to claim readiness without a live runtime',async()=>{
    const gateway=new HomebaseComputeGateway('homebase',runtime(false),()=>NOW);
    await expect(gateway.health()).resolves.toEqual({
      productionReady:false,
      authority:'CANONICAL_COMPUTE_SUBMISSION',
      trustDomain:'homebase',
      reasons:['HOMEBASE_GPU_NOT_READY'],
    });
  });

  it('admits a leased sensitive Director post task and returns a Kubernetes receipt',async()=>{
    const gateway=new HomebaseComputeGateway('homebase',runtime(true),()=>NOW);
    await expect(gateway.submit(input())).resolves.toEqual(receipt());
  });

  it('rejects public-cloud burst for sensitive Director post work',async()=>{
    const gateway=new HomebaseComputeGateway('homebase',runtime(true),()=>NOW);
    const value=input();
    const invalid={
      ...value,
      descriptor:{
        ...value.descriptor,
        computeBinding:{
          ...value.descriptor.computeBinding,
          constraints:{sensitiveData:true,allowCloudBurst:true},
        },
      },
    };
    await expect(gateway.submit(invalid)).rejects.toThrow(
      'HOMEBASE_COMPUTE_DIRECTOR_PUBLIC_CLOUD_BURST_FORBIDDEN',
    );
  });

  it('requires the claimed ONE-RUNTIME lease to still be active',async()=>{
    const gateway=new HomebaseComputeGateway('homebase',runtime(true),()=>NOW);
    const value=input();
    const invalid={
      ...value,
      task:{...value.task,leaseExpiresAt:'2026-10-05T02:59:59.000Z'},
    };
    await expect(gateway.submit(invalid)).rejects.toThrow(
      'HOMEBASE_COMPUTE_ACTIVE_LEASE_REQUIRED',
    );
  });

  it('exposes the exact Director HTTP contract while remaining fail-closed',async()=>{
    const gateway=new HomebaseComputeGateway('remote-homebase',runtime(true),()=>NOW);
    const health=await gateway.handle({method:'GET',path:'/health'});
    expect(health).toMatchObject({
      status:200,
      body:{
        productionReady:true,
        authority:'CANONICAL_COMPUTE_SUBMISSION',
        trustDomain:'remote-homebase',
      },
    });

    const accepted=await gateway.handle({
      method:'POST',
      path:'/v1/director/post-submissions',
      body:input(),
    });
    expect(accepted).toEqual({status:202,body:{receipt:receipt()}});

    const blocked=new HomebaseComputeGateway('homebase',runtime(false),()=>NOW);
    const unavailable=await blocked.handle({
      method:'POST',
      path:'/v1/director/post-submissions',
      body:input(),
    });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toMatchObject({
      error:'HOMEBASE_COMPUTE_NOT_PRODUCTION_READY:HOMEBASE_GPU_NOT_READY',
    });
  });

  it('rejects mismatched compute receipts rather than trusting a worker response',async()=>{
    const bad:HomebaseComputeAdmissionRuntime={
      async readiness(){return {ready:true,reasons:[]};},
      async submit(){return {...receipt(),taskId:'other-task'};},
    };
    const gateway=new HomebaseComputeGateway('homebase',bad,()=>NOW);
    await expect(gateway.submit(input())).rejects.toThrow(
      'HOMEBASE_COMPUTE_RECEIPT_TASK_MISMATCH',
    );
  });
});
