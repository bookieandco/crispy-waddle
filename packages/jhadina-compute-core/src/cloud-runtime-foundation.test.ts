import { describe, expect, it } from 'vitest';
import { planBatchAdmission } from './admission-planner.js';
import { planCacheEvictions, planCacheWarm } from './cache-manager.js';
import {
  assertComputeExecutionAuthorized,
  type ComputeExecutionBundle,
  type ComputeExecutionPermit,
} from './execution-contract.js';
import { computeNodeFromHardwareTruth } from './hardware-truth-adapter.js';
import {
  buildKueueJobManifest,
  ShadowComputeSubmitter,
  type KubernetesSubmissionConfig,
} from './kueue-submission.js';
import { decideComputeRecovery, checkpointRestartSafe } from './recovery.js';
import type { ComputeNode, ComputeWorkload } from './resource-contract.js';
import { resolveComputeWorker } from './worker-catalog.js';

const node:ComputeNode={
  id:'gpu-node-1',
  provider:'homebase',
  zone:'home',
  status:'ready',
  cpuCoresFree:32,
  ramGiBFree:128,
  scratchGiBFree:1000,
  networkFabrics:[{fabric:'storage',bandwidthMbpsAvailable:100000,status:'ready'}],
  accelerators:[{
    vendor:'nvidia',
    model:'Test GPU',
    count:1,
    vramGiBPerDevice:48,
    vramGiBFreePerDevice:48,
  }],
};

function workload(
  id:string,
  queue:ComputeWorkload['queue'],
  priority:number,
  kind:ComputeWorkload['kind']='video-generation',
):ComputeWorkload{
  return {
    id,
    source:kind==='llm-interactive'?'jllm':'director',
    kind,
    queue,
    priority,
    authority:{system:'jhadina-one-runtime',jobId:id,idempotencyKey:`idem-${id}`,projectId:'ws-1'},
    resourceProfileId:`profile-${id}`,
    resources:{
      cpuCores:4,
      ramGiB:16,
      scratchGiB:20,
      gpu:{vendor:'nvidia',count:1,minVramGiBPerDevice:16},
      networkMbps:1000,
      networkFabric:'storage',
      sensitiveData:true,
    },
    createdAt:'2026-09-27T04:00:00.000Z',
  };
}

const bundle:ComputeExecutionBundle={
  workload:workload('task-1','creative',700),
  storageIntent:{
    id:'storage-1',
    authority:{system:'jhadina-one-runtime',jobId:'task-1',idempotencyKey:'idem-task-1',projectId:'ws-1'},
    stage:'media-edit',
    accessPattern:'range-stream',
    durability:'durable',
    sensitiveData:true,
    createdAt:'2026-09-27T04:00:00.000Z',
  },
  storagePlan:{
    intentId:'storage-1',
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
    workloadId:'task-1',
    selectedNodeId:'gpu-node-1',
    candidates:[{nodeId:'gpu-node-1',score:100,reasons:['homebase-local']}],
    rejected:[],
  },
  target:'kubernetes-job',
  worker:{image:'registry.local/video',imageDigest:'sha256:abc'},
  mode:'shadow',
};

const permit:ComputeExecutionPermit={
  actionRequestId:'action-1',
  userId:'owner-1',
  authorizedAt:'2026-09-27T04:00:01.000Z',
  expiresAt:'2026-09-27T04:01:01.000Z',
  runtime:{
    workSessionId:'ws-1',
    taskId:'task-1',
    correlationId:'corr-1',
    idempotencyKey:'idem-task-1',
  },
};

describe('CLOUD.4 execution boundary',()=>{
  it('accepts only a current Action-authorized matching execution bundle',()=>{
    expect(()=>assertComputeExecutionAuthorized(bundle,permit,'2026-09-27T04:00:30.000Z')).not.toThrow();
    expect(()=>assertComputeExecutionAuthorized(bundle,permit,'2026-09-27T04:02:00.000Z')).toThrow('COMPUTE_EXECUTION_NOT_AUTHORIZED:COMPUTE_PERMIT_EXPIRED');
  });

  it('keeps shadow submission idempotent',async()=>{
    const submitter=new ShadowComputeSubmitter();
    const first=await submitter.submit(bundle,permit);
    const second=await submitter.submit(bundle,permit);
    expect(second).toEqual(first);
  });

  it('builds a Kueue-managed Job without hard-pinning the planned hostname',()=>{
    const config:KubernetesSubmissionConfig={
      namespace:'jhadina-compute',
      queueNames:{
        interactive:'jhadina-interactive',
        creative:'jhadina-creative',
        render:'jhadina-render',
        background:'jhadina-background',
        maintenance:'jhadina-maintenance',
      },
      priorityClassNames:{
        interactive:'jhadina-interactive',
        creative:'jhadina-creative',
        render:'jhadina-render',
        background:'jhadina-background',
        maintenance:'jhadina-maintenance',
      },
    };
    const live={...bundle,mode:'live' as const};
    const manifest=buildKueueJobManifest(live,permit,config);
    expect(manifest.metadata.labels['kueue.x-k8s.io/queue-name']).toBe('jhadina-creative');
    expect(manifest.metadata.annotations['jhadina.ai/planned-node-id']).toBe('gpu-node-1');
    expect(manifest.spec.template.spec.nodeSelector['kubernetes.io/hostname']).toBeUndefined();
    expect(manifest.spec.template.spec.nodeSelector['jhadina.ai/fabric']).toBe('storage');
    expect(manifest.spec.template.spec.containers[0]?.image).toContain('@sha256:abc');
  });
});

describe('CLOUD.5 hardware truth',()=>{
  const report={
    scanner:'hardware-truth-scanner',
    generatedAt:'2026-09-27T04:00:00.000Z',
    host:'homebase-win',
    os:'Windows',
    summary:{overallStatus:'ok' as const},
    components:[
      {
        id:'cpu',category:'CPU',name:'CPU',status:'ok' as const,confidence:'medium' as const,
        evidence:{LogicalProcessors:'16'},
      },
      {
        id:'mem',category:'Memory Pressure',name:'RAM',status:'ok' as const,confidence:'medium' as const,
        evidence:{AvailableMemoryMB:65536},
      },
      {
        id:'gpu',category:'GPU',name:'NVIDIA Test GPU',status:'ok' as const,confidence:'medium' as const,
        evidence:{NvidiaMemoryTotalGB:24,NvidiaMemoryFreeGB:20,NvidiaUtilizationPercent:10,NvidiaTemperatureC:50},
      },
      {
        id:'net',category:'Network',name:'Storage NIC',status:'ok' as const,confidence:'medium' as const,
        evidence:{SpeedMbps:100000},
      },
    ],
    diagnostics:[{name:'physical inspection',status:'limited' as const,evidence:'not software-visible',nextStep:'inspect'}],
    coverageLimits:['PSU load not proven'],
  };

  it('converts fresh scanner evidence into schedulable node truth while retaining proof gaps',()=>{
    const evidence=computeNodeFromHardwareTruth(report,{
      nodeId:'homebase-win',
      provider:'homebase',
      zone:'home',
      maxEvidenceAgeMs:60_000,
      scratchGiBFree:500,
      reservedCpuCores:2,
      fabricMappings:[{fabric:'storage',adapterNameIncludes:'Storage NIC'}],
    },'2026-09-27T04:00:30.000Z');
    expect(evidence.node.status).toBe('ready');
    expect(evidence.node.cpuCoresFree).toBe(14);
    expect(evidence.node.ramGiBFree).toBe(64);
    expect(evidence.node.accelerators[0]?.vramGiBFreePerDevice).toBe(20);
    expect(evidence.node.networkFabrics?.[0]?.bandwidthMbpsAvailable).toBe(100000);
    expect(evidence.coverageLimits).toContain('PSU load not proven');
    expect(evidence.confidence).toBe('medium');
  });

  it('fails stale hardware evidence closed',()=>{
    const evidence=computeNodeFromHardwareTruth(report,{
      nodeId:'homebase-win',provider:'homebase',zone:'home',maxEvidenceAgeMs:10_000,scratchGiBFree:500,
    },'2026-09-27T04:01:00.000Z');
    expect(evidence.node.status).toBe('offline');
  });
});

describe('CLOUD.7 worker catalog',()=>{
  it('requires digest-pinned live workers and correct workload kind',()=>{
    const catalog={
      video:{
        id:'video',
        allowedKinds:['video-generation'] as const,
        target:'kubernetes-job' as const,
        worker:{image:'registry.local/video',imageDigest:'sha256:abc'},
      },
    };
    expect(resolveComputeWorker(bundle.workload,'video',catalog,'live').worker.imageDigest).toBe('sha256:abc');
    expect(()=>resolveComputeWorker({...bundle.workload,kind:'image-generation'},'video',catalog,'live')).toThrow('COMPUTE_WORKER_KIND_MISMATCH:image-generation');
  });
});

describe('CLOUD.8 admission and cache efficiency',()=>{
  it('admits interactive JLLM ahead of lower-priority GPU work when capacity is constrained',()=>{
    const background=workload('train','background',300,'training');
    const interactive=workload('chat','interactive',1000,'llm-interactive');
    const plan=planBatchAdmission([node],[background,interactive]);
    expect(plan.admissions[0]).toMatchObject({workloadId:'chat',admitted:true,nodeId:'gpu-node-1'});
    expect(plan.admissions[1]).toMatchObject({workloadId:'train',admitted:false});
  });

  it('never evicts active/pinned assets or an undurable checkpoint',()=>{
    const plan=planCacheEvictions([
      {id:'active-model',kind:'model',sizeGiB:20,priority:100,lastAccessedAt:'2026-09-27T03:00:00Z',activeReferences:1},
      {id:'checkpoint-new',kind:'checkpoint',sizeGiB:10,priority:10,lastAccessedAt:'2026-09-27T02:00:00Z'},
      {id:'old-proxy',kind:'proxy',sizeGiB:30,priority:1,lastAccessedAt:'2026-09-26T01:00:00Z',durableReceiptRef:'ceph:proxy'},
    ],25,0);
    expect(plan.evictIds).toEqual(['old-proxy']);
    expect(plan.blockingEntries).toEqual(expect.arrayContaining(['active-model','checkpoint-new']));
    expect(plan.admissible).toBe(true);
  });

  it('deduplicates warm requests by digest before allocating NVMe',()=>{
    const plan=planCacheWarm('gpu-node-1',[
      {id:'model-a',kind:'model',sizeGiB:10,priority:100,localityKey:'model:a',digest:'sha:a'},
      {id:'model-a-copy',kind:'model',sizeGiB:10,priority:50,localityKey:'model:a',digest:'sha:a'},
    ],[],20);
    expect(plan.requests).toHaveLength(1);
    expect(plan.totalGiB).toBe(10);
  });
});

describe('CLOUD.11 recovery',()=>{
  it('retries transient worker/node failures within WorkSession retry budget',()=>{
    expect(decideComputeRecovery({
      submissionId:'s1',workloadId:'w1',status:'failed',
      startedAt:'2026-09-27T04:00:00Z',completedAt:'2026-09-27T04:00:01Z',
      outputRefs:[],errorCode:'WORKER_PROCESS_EXIT',
    },1,3)).toMatchObject({disposition:'retry',failureClass:'worker-crash'});
  });

  it('does not retry invalid input and only trusts durably flushed checkpoints',()=>{
    expect(decideComputeRecovery({
      submissionId:'s1',workloadId:'w1',status:'failed',
      startedAt:'2026-09-27T04:00:00Z',completedAt:'2026-09-27T04:00:01Z',
      outputRefs:[],errorCode:'INPUT_VALIDATION_FAILED',
    },1,3).disposition).toBe('fail');
    expect(checkpointRestartSafe({
      checkpointId:'cp1',workloadId:'w1',
      localWrittenAt:'2026-09-27T04:00:00Z',localPathRef:'nvme:cp1',
    })).toBe(false);
    expect(checkpointRestartSafe({
      checkpointId:'cp1',workloadId:'w1',
      localWrittenAt:'2026-09-27T04:00:00Z',localPathRef:'nvme:cp1',
      durableWrittenAt:'2026-09-27T04:00:02Z',durableObjectRef:'ceph:cp1',digest:'sha256:abc',
    })).toBe(true);
  });
});
