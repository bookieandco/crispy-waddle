import { describe, expect, it } from 'vitest';
import { InMemoryComputeExecutionRepository } from './execution-repository.js';
import type { ComputeExecutionResultReceipt } from './execution-contract.js';
import {
  KubernetesApiJobTransport,
  type FetchLike,
  type FetchResponseLike,
} from './kubernetes-api-transport.js';

function response(status:number,body:unknown):FetchResponseLike{
  return {
    ok:status>=200&&status<300,
    status,
    async json(){return body;},
    async text(){return typeof body==='string'?body:JSON.stringify(body);},
  };
}

describe('durable compute execution repository',()=>{
  it('deduplicates the same WorkSession/task/idempotency receipt and rejects drift',async()=>{
    const repo=new InMemoryComputeExecutionRepository();
    const receipt={
      submissionId:'k8s:ns:job',
      actionRequestId:'action-1',
      userId:'owner-1',
      workloadId:'work-1',
      workSessionId:'ws-1',
      taskId:'task-1',
      idempotencyKey:'idem-1',
      target:'kubernetes-job' as const,
      provider:'kubernetes' as const,
      namespace:'ns',
      queueName:'creative',
      resourceName:'job',
      plannedNodeId:'gpu-1',
      primaryStorageBackendId:'ceph',
      submittedAt:'2026-09-27T06:00:00Z',
      manifestFingerprint:'fp1',
    };
    await repo.saveSubmission(receipt);
    await expect(repo.saveSubmission(receipt)).resolves.toBeUndefined();
    await expect(repo.saveSubmission({...receipt,manifestFingerprint:'fp2'})).rejects.toThrow('COMPUTE_EXECUTION_IDEMPOTENCY_CONFLICT');
  });

  it('binds terminal result to the original submission and rejects conflicting terminal truth',async()=>{
    const repo=new InMemoryComputeExecutionRepository();
    await repo.saveSubmission({
      submissionId:'shadow:ws:task',actionRequestId:'a',userId:'owner-1',workloadId:'w',
      workSessionId:'ws',taskId:'task',idempotencyKey:'idem',target:'kubernetes-job',
      provider:'shadow',namespace:'shadow',queueName:'creative',resourceName:'task',
      plannedNodeId:'gpu',primaryStorageBackendId:'ceph',submittedAt:'2026-09-27T06:00:00Z',
      manifestFingerprint:'fp',
    });
    const result:ComputeExecutionResultReceipt={
      submissionId:'shadow:ws:task',workloadId:'w',status:'succeeded',
      startedAt:'2026-09-27T06:00:01Z',completedAt:'2026-09-27T06:00:02Z',
      outputRefs:['asset:1'],
    };
    await repo.saveResult(result,'2026-09-27T06:00:02Z');
    await expect(repo.saveResult(result,'2026-09-27T06:00:03Z')).resolves.toBeUndefined();
    await expect(repo.saveResult({...result,status:'failed'},'2026-09-27T06:00:04Z')).rejects.toThrow('COMPUTE_EXECUTION_RESULT_CONFLICT');
  });
});

describe('Kubernetes API transport',()=>{
  it('recovers an existing deterministic Job after POST conflict',async()=>{
    const calls:string[]=[];
    const fetchImpl:FetchLike=async(input,init)=>{
      calls.push(`${init?.method??'GET'} ${input}`);
      if(init?.method==='POST')return response(409,{message:'exists'});
      return response(200,{metadata:{
        name:'job-1',
        namespace:'jhadina-compute',
        creationTimestamp:'2026-09-27T06:00:00Z',
        annotations:{
          'jhadina.ai/workload-id':'workload-1',
          'jhadina.ai/work-session-id':'ws-1',
          'jhadina.ai/task-id':'task-1',
          'jhadina.ai/idempotency-key':'idem-1',
          'jhadina.ai/action-request-id':'action-1',
        },
      }});
    };
    const transport=new KubernetesApiJobTransport({
      baseUrl:'https://kubernetes.local',
      bearerToken:'token',
      fetchImpl,
    });
    const created=await transport.createJob({
      apiVersion:'batch/v1',
      kind:'Job',
      metadata:{name:'job-1',namespace:'jhadina-compute',labels:{},annotations:{
        'jhadina.ai/workload-id':'workload-1',
        'jhadina.ai/work-session-id':'ws-1',
        'jhadina.ai/task-id':'task-1',
        'jhadina.ai/idempotency-key':'idem-1',
        'jhadina.ai/action-request-id':'action-1',
      }},
      spec:{
        backoffLimit:0,ttlSecondsAfterFinished:3600,
        template:{
          metadata:{labels:{},annotations:{}},
          spec:{
            restartPolicy:'Never',priorityClassName:'jhadina-creative',nodeSelector:{},
            containers:[{name:'worker',image:'image@sha256:abc',env:[],resources:{requests:{cpu:'1',memory:'1Gi','ephemeral-storage':'1Gi'},limits:{cpu:'1',memory:'1Gi','ephemeral-storage':'1Gi'}}}],
          },
        },
      },
    });
    expect(created.createdAt).toBe('2026-09-27T06:00:00Z');
    expect(calls).toEqual([
      'POST https://kubernetes.local/apis/batch/v1/namespaces/jhadina-compute/jobs',
      'GET https://kubernetes.local/apis/batch/v1/namespaces/jhadina-compute/jobs/job-1',
    ]);
  });


  it('rejects an existing Job whose lineage does not match the retried submission',async()=>{
    const fetchImpl:FetchLike=async(_input,init)=>{
      if(init?.method==='POST')return response(409,{message:'exists'});
      return response(200,{metadata:{
        name:'job-1',namespace:'jhadina-compute',creationTimestamp:'2026-09-27T06:00:00Z',
        annotations:{
          'jhadina.ai/workload-id':'different-workload',
          'jhadina.ai/work-session-id':'ws-1',
          'jhadina.ai/task-id':'task-1',
          'jhadina.ai/idempotency-key':'idem-1',
          'jhadina.ai/action-request-id':'action-1',
        },
      }});
    };
    const transport=new KubernetesApiJobTransport({baseUrl:'https://kubernetes.local',bearerToken:'token',fetchImpl});
    await expect(transport.createJob({
      apiVersion:'batch/v1',kind:'Job',
      metadata:{name:'job-1',namespace:'jhadina-compute',labels:{},annotations:{
        'jhadina.ai/workload-id':'workload-1',
        'jhadina.ai/work-session-id':'ws-1',
        'jhadina.ai/task-id':'task-1',
        'jhadina.ai/idempotency-key':'idem-1',
        'jhadina.ai/action-request-id':'action-1',
      }},
      spec:{backoffLimit:0,ttlSecondsAfterFinished:3600,template:{metadata:{labels:{},annotations:{}},spec:{
        restartPolicy:'Never',priorityClassName:'jhadina-creative',nodeSelector:{},containers:[],
      }}},
    })).rejects.toThrow('KUBERNETES_JOB_IDEMPOTENCY_CONFLICT:jhadina.ai/workload-id');
  });

  it('observes the actual scheduled node and terminal status from Job + Pod truth',async()=>{
    const fetchImpl:FetchLike=async(input)=>{
      if(input.includes('/pods?'))return response(200,{items:[{spec:{nodeName:'gpu-node-2'},status:{phase:'Succeeded',startTime:'2026-09-27T06:00:01Z'}}]});
      return response(200,{status:{startTime:'2026-09-27T06:00:01Z',completionTime:'2026-09-27T06:00:10Z',conditions:[{type:'Complete',status:'True'}]}});
    };
    const transport=new KubernetesApiJobTransport({baseUrl:'https://kubernetes.local',bearerToken:'token',fetchImpl});
    const observed=await transport.observeJob('jhadina-compute','job-1');
    expect(observed).toMatchObject({
      phase:'succeeded',
      actualNodeId:'gpu-node-2',
      completedAt:'2026-09-27T06:00:10Z',
    });
  });

  it('treats deleting an already-absent Job as idempotent cancellation',async()=>{
    const fetchImpl:FetchLike=async()=>response(404,{message:'not found'});
    const transport=new KubernetesApiJobTransport({baseUrl:'https://kubernetes.local',bearerToken:'token',fetchImpl});
    await expect(transport.cancelJob('jhadina-compute','job-1')).resolves.toBeUndefined();
  });
});
