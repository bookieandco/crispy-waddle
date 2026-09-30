import { describe, expect, it } from 'vitest';
import {
  CLOUD12_REQUIRED_SOURCES,
  certifyCloud12,
  type Cloud12RequiredSource,
  type Cloud12WorkItem,
} from './cloud12-certification.js';
import type { ComputeNode, ComputeQueueClass, ComputeWorkload, ComputeWorkloadKind } from './resource-contract.js';
import type { StorageBackend, StorageIntent, StorageLifecycleStage, StorageAccessPattern } from './storage-contract.js';

const gpuA:ComputeNode={
  id:'gpu-a',provider:'homebase',zone:'home',status:'ready',
  cpuCoresFree:64,ramGiBFree:256,scratchGiBFree:4000,
  accelerators:[{vendor:'nvidia',model:'GPU-A',count:4,vramGiBPerDevice:48,vramGiBFreePerDevice:48}],
};
const gpuB:ComputeNode={
  id:'gpu-b',provider:'homebase',zone:'home',status:'ready',
  cpuCoresFree:64,ramGiBFree:256,scratchGiBFree:4000,
  accelerators:[{vendor:'nvidia',model:'GPU-B',count:4,vramGiBPerDevice:48,vramGiBFreePerDevice:48}],
};
const cpuNode:ComputeNode={
  id:'cpu-media',provider:'homebase',zone:'home',status:'ready',
  cpuCoresFree:96,ramGiBFree:384,scratchGiBFree:8000,accelerators:[],
};

const storageBackends:StorageBackend[]=[
  {
    id:'cephfs-hot',provider:'homebase',kind:'shared-posix',status:'ready',zone:'home',
    durability:'durable',capacityGiBFree:100_000,throughputMBps:5000,latencyClass:'low',
    capabilities:{posix:true,readWriteMany:true,rangeReads:true,readOnlyFanout:true,snapshots:true},
  },
  {
    id:'ceph-rgw',provider:'homebase',kind:'object',status:'ready',zone:'home',
    durability:'durable',capacityGiBFree:300_000,throughputMBps:3500,latencyClass:'standard',
    capabilities:{objectApi:true,rangeReads:true,readOnlyFanout:true,snapshots:true,nativeHashes:true},
  },
  {
    id:'nvme-cache',provider:'homebase',kind:'local-nvme',status:'ready',zone:'home',
    durability:'ephemeral',capacityGiBFree:6000,throughputMBps:7000,latencyClass:'ultra-low',
    capabilities:{cache:true,sparseCache:true,offlinePinning:true,rangeReads:true},
  },
];

function queuePriority(queue:ComputeQueueClass):number{
  switch(queue){
    case 'interactive':return 1000;
    case 'creative':return 700;
    case 'render':return 500;
    case 'background':return 300;
    case 'maintenance':return 100;
  }
}

function makeWorkload(
  source:Cloud12RequiredSource,
  kind:ComputeWorkloadKind,
  queue:ComputeQueueClass,
  gpu:boolean,
):ComputeWorkload{
  const id=`${source}-task`;
  return {
    id,
    source,
    kind,
    queue,
    priority:queuePriority(queue),
    authority:{system:'jhadina-one-runtime',jobId:id,idempotencyKey:`idem-${id}`,projectId:'ws-cloud12'},
    resourceProfileId:`${source}.default`,
    resources:{
      cpuCores:gpu?8:6,
      ramGiB:gpu?24:12,
      scratchGiB:gpu?100:40,
      gpu:gpu?{vendor:'nvidia',count:1,minVramGiBPerDevice:16}:undefined,
      sensitiveData:true,
    },
    createdAt:'2026-09-27T05:00:00.000Z',
  };
}

function makeItem(
  source:Cloud12RequiredSource,
  kind:ComputeWorkloadKind,
  queue:ComputeQueueClass,
  gpu:boolean,
  stage:StorageLifecycleStage,
  accessPattern:StorageAccessPattern,
):Cloud12WorkItem{
  const workload=makeWorkload(source,kind,queue,gpu);
  const storageIntent:StorageIntent={
    id:`storage-${source}`,
    authority:{...workload.authority},
    stage,
    accessPattern,
    durability:'durable',
    sensitiveData:true,
    estimatedSizeGiB:source==='director'?500:20,
    createdAt:'2026-09-27T05:00:00.000Z',
  };
  return {workload,storageIntent};
}

const items:Cloud12WorkItem[]=[
  makeItem('jllm','llm-interactive','interactive',true,'serve','read-mostly-fanout'),
  makeItem('director','video-generation','creative',true,'media-edit','range-stream'),
  makeItem('social','video-generation','creative',true,'media-edit','range-stream'),
  makeItem('growth','image-generation','creative',true,'media-edit','range-stream'),
  makeItem('pupsonstuff','image-generation','creative',true,'media-edit','range-stream'),
  makeItem('pod','image-generation','creative',true,'media-edit','range-stream'),
  makeItem('music','audio-generation','creative',true,'media-ingest','sequential-large'),
  makeItem('memory','embedding','maintenance',false,'serve','read-mostly-fanout'),
  makeItem('money','batch-analysis','background',false,'prepare','sequential-large'),
  makeItem('shark','batch-analysis','background',false,'prepare','sequential-large'),
  makeItem('sports','batch-analysis','background',false,'prepare','sequential-large'),
  makeItem('opportunity','batch-analysis','background',false,'prepare','sequential-large'),
  makeItem('jhadina-tv','transcode','render',false,'media-delivery','range-stream'),
];

describe('CLOUD.12 end-to-end certification',()=>{
  it('passes source and simultaneous shadow-runtime certification while refusing to claim physical live certification',()=>{
    const result=certifyCloud12({
      nodes:[gpuA,gpuB,cpuNode],
      storageBackends,
      workItems:items,
    });
    expect(result.sourcePass).toBe(true);
    expect(result.shadowRuntimePass).toBe(true);
    expect(result.infrastructurePass).toBe(false);
    expect(result.liveRuntimePass).toBe(false);
    expect(result.fullCertification).toBe(false);
    expect(result.admission.admissions).toHaveLength(CLOUD12_REQUIRED_SOURCES.length);
    expect(result.admission.admissions.every(item=>item.admitted)).toBe(true);
    expect(result.blockers).toContain('CLOUD12_LIVE_HARDWARE_EVIDENCE_REQUIRED');
    expect(result.blockers).toContain('CLOUD12_LIVE_GPU_SMOKE_REQUIRED');
  });

  it('requires a real receipt for every required subsystem before the live gate can pass',()=>{
    const receipts=CLOUD12_REQUIRED_SOURCES.map(source=>({
      source,
      receiptRef:`live:${source}`,
      completedAt:'2026-09-27T05:10:00.000Z',
    }));
    const result=certifyCloud12({
      nodes:[gpuA,gpuB,cpuNode],
      storageBackends,
      workItems:items,
      physicalEvidence:{
        hardwareEvidenceRefs:['hardware:node-a','hardware:node-b'],
        k3sHealthRef:'k3s:ready',
        kueueHealthRef:'kueue:ready',
        gpuDeviceSmokeRef:'gpu:smoke',
        cephHealthRef:'ceph:healthy',
        storageRestartRecoveryRef:'drill:storage-restart',
        workerCrashRecoveryRef:'drill:worker-crash',
        telemetryRef:'telemetry:cloud12',
        cloudBurstDenialRef:'policy:private-burst-denied',
        costLimitDenialRef:'policy:over-budget-denied',
        workloadReceipts:receipts,
      },
    });
    expect(result.fullCertification).toBe(true);
    expect(result.blockers.filter(blocker=>blocker.startsWith('CLOUD12_LIVE_'))).toHaveLength(0);
  });

  it('fails source certification if any canonical subsystem is absent',()=>{
    const result=certifyCloud12({
      nodes:[gpuA,gpuB,cpuNode],
      storageBackends,
      workItems:items.filter(item=>item.workload.source!=='shark'),
    });
    expect(result.sourcePass).toBe(false);
    expect(result.blockers).toContain('CLOUD12_SOURCE_MISSING:shark');
  });
});
