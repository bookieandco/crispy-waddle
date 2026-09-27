import { describe, expect, it } from 'vitest';
import type { ComputeSubmissionReceipt } from '@jhadina/compute-core';
import {
  SupabaseComputeExecutionRepository,
  type ComputeReceiptRpcClient,
} from './supabase-compute-execution-repository';

function submissionRow(overrides:Record<string,unknown>={}):Record<string,unknown>{
  return {
    submission_id:'k8s:jhadina-compute:job-1',
    action_request_id:'action-1',
    owner_user_id:'11111111-1111-1111-1111-111111111111',
    workload_id:'workload-1',
    work_session_id:'ws-1',
    task_id:'task-1',
    idempotency_key:'idem-1',
    target:'kubernetes-job',
    provider:'kubernetes',
    namespace:'jhadina-compute',
    queue_name:'jhadina-creative',
    resource_name:'job-1',
    planned_node_id:'gpu-a',
    actual_node_id:null,
    primary_storage_backend_id:'cephfs-hot',
    cache_storage_backend_id:'nvme-a',
    manifest_fingerprint:'fp-1',
    submitted_at:'2026-09-27T06:00:00Z',
    result_status:null,
    result_started_at:null,
    result_completed_at:null,
    output_refs:[],
    telemetry_ref:null,
    error_code:null,
    retryable:null,
    updated_at:'2026-09-27T06:00:00Z',
    ...overrides,
  };
}

describe('Supabase compute execution receipt repository',()=>{
  it('owner-scopes receipt recovery and parses canonical submission evidence',async()=>{
    const calls:Array<{fn:string;args:Record<string,unknown>}>=[]; 
    const client:ComputeReceiptRpcClient={
      async rpc(fn,args){
        calls.push({fn,args});
        return {data:[submissionRow()],error:null};
      },
    };
    const repo=new SupabaseComputeExecutionRepository(client);
    const record=await repo.getByIdempotency(
      '11111111-1111-1111-1111-111111111111',
      'ws-1','task-1','idem-1',
    );
    expect(record?.submission).toMatchObject({
      userId:'11111111-1111-1111-1111-111111111111',
      workSessionId:'ws-1',
      taskId:'task-1',
      idempotencyKey:'idem-1',
      plannedNodeId:'gpu-a',
    });
    expect(calls[0]).toEqual({
      fn:'jhadina_get_compute_execution',
      args:{
        p_owner_user_id:'11111111-1111-1111-1111-111111111111',
        p_work_session_id:'ws-1',
        p_task_id:'task-1',
        p_idempotency_key:'idem-1',
      },
    });
  });

  it('writes the complete submission lineage through the bounded RPC',async()=>{
    let captured:{fn:string;args:Record<string,unknown>}|undefined;
    const client:ComputeReceiptRpcClient={
      async rpc(fn,args){
        captured={fn,args};
        return {data:submissionRow(),error:null};
      },
    };
    const repo=new SupabaseComputeExecutionRepository(client);
    const receipt:ComputeSubmissionReceipt={
      submissionId:'k8s:jhadina-compute:job-1',
      actionRequestId:'action-1',
      userId:'11111111-1111-1111-1111-111111111111',
      workloadId:'workload-1',
      workSessionId:'ws-1',
      taskId:'task-1',
      idempotencyKey:'idem-1',
      target:'kubernetes-job',
      provider:'kubernetes',
      namespace:'jhadina-compute',
      queueName:'jhadina-creative',
      resourceName:'job-1',
      plannedNodeId:'gpu-a',
      primaryStorageBackendId:'cephfs-hot',
      cacheStorageBackendId:'nvme-a',
      submittedAt:'2026-09-27T06:00:00Z',
      manifestFingerprint:'fp-1',
    };
    await repo.saveSubmission(receipt);
    expect(captured?.fn).toBe('jhadina_record_compute_submission');
    expect(captured?.args).toMatchObject({
      p_owner_user_id:receipt.userId,
      p_work_session_id:'ws-1',
      p_task_id:'task-1',
      p_idempotency_key:'idem-1',
      p_manifest_fingerprint:'fp-1',
    });
  });

  it('parses terminal result truth including observed node',async()=>{
    const client:ComputeReceiptRpcClient={
      async rpc(){
        return {data:[submissionRow({
          result_status:'succeeded',
          result_started_at:'2026-09-27T06:00:01Z',
          result_completed_at:'2026-09-27T06:00:10Z',
          output_refs:['asset:1'],
          actual_node_id:'gpu-b',
        })],error:null};
      },
    };
    const repo=new SupabaseComputeExecutionRepository(client);
    const record=await repo.getByIdempotency(
      '11111111-1111-1111-1111-111111111111',
      'ws-1','task-1','idem-1',
    );
    expect(record?.result).toMatchObject({
      status:'succeeded',
      actualNodeId:'gpu-b',
      outputRefs:['asset:1'],
    });
  });

  it('fails closed on RPC errors',async()=>{
    const client:ComputeReceiptRpcClient={
      async rpc(){return {data:null,error:{message:'db unavailable'}};},
    };
    const repo=new SupabaseComputeExecutionRepository(client);
    await expect(repo.getByIdempotency(
      '11111111-1111-1111-1111-111111111111',
      'ws-1','task-1','idem-1',
    )).rejects.toThrow('COMPUTE_RECEIPT_READ_FAILED:db unavailable');
  });
});
