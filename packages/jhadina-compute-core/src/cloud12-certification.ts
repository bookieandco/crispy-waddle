import { planBatchAdmission, type BatchAdmissionPlan } from './admission-planner.js';
import { validateComputeStorageLineage } from './data-path-lineage.js';
import type { ComputeNode, ComputeWorkload } from './resource-contract.js';
import type { StorageBackend, StorageIntent, StoragePlan } from './storage-contract.js';
import { planStoragePath } from './storage-planner.js';

export const CLOUD12_REQUIRED_SOURCES=Object.freeze([
  'jllm',
  'director',
  'social',
  'growth',
  'pupsonstuff',
  'pod',
  'music',
  'memory',
  'money',
  'shark',
  'sports',
  'opportunity',
  'jhadina-tv',
] as const);

export type Cloud12RequiredSource=(typeof CLOUD12_REQUIRED_SOURCES)[number];

export type Cloud12WorkItem={
  workload:ComputeWorkload;
  storageIntent:StorageIntent;
};

export type Cloud12LiveWorkloadReceipt={
  source:Cloud12RequiredSource;
  receiptRef:string;
  completedAt:string;
};

export type Cloud12PhysicalEvidence={
  hardwareEvidenceRefs:readonly string[];
  k3sHealthRef?:string;
  kueueHealthRef?:string;
  gpuDeviceSmokeRef?:string;
  cephHealthRef?:string;
  storageRestartRecoveryRef?:string;
  workerCrashRecoveryRef?:string;
  telemetryRef?:string;
  cloudBurstDenialRef?:string;
  costLimitDenialRef?:string;
  workloadReceipts?:readonly Cloud12LiveWorkloadReceipt[];
};

export type Cloud12CertificationInput={
  nodes:readonly ComputeNode[];
  storageBackends:readonly StorageBackend[];
  workItems:readonly Cloud12WorkItem[];
  physicalEvidence?:Cloud12PhysicalEvidence;
  requiredSources?:readonly Cloud12RequiredSource[];
};

export type Cloud12Certification={
  sourcePass:boolean;
  infrastructurePass:boolean;
  shadowRuntimePass:boolean;
  liveRuntimePass:boolean;
  fullCertification:boolean;
  admission:BatchAdmissionPlan;
  storagePlans:Readonly<Record<string,StoragePlan>>;
  blockers:readonly string[];
};

function present(value:string|undefined):boolean{return Boolean(value?.trim());}

export function certifyCloud12(input:Cloud12CertificationInput):Cloud12Certification{
  const required=input.requiredSources??CLOUD12_REQUIRED_SOURCES;
  const blockers:string[]=[];
  const sources=new Set(input.workItems.map(item=>item.workload.source));
  for(const source of required){
    if(!sources.has(source)){
      blockers.push(`CLOUD12_SOURCE_MISSING:${source}`);
    }
  }

  const storagePlans:Record<string,StoragePlan>={};
  for(const item of input.workItems){
    const lineage=validateComputeStorageLineage(item.workload,item.storageIntent);
    if(!lineage.admissible){
      blockers.push(...lineage.reasons.map(reason=>`CLOUD12_LINEAGE:${item.workload.id}:${reason}`));
    }
    const plan=planStoragePath([...input.storageBackends],item.storageIntent);
    storagePlans[item.workload.id]=plan;
    if(!plan.admissible){
      blockers.push(`CLOUD12_STORAGE_NOT_ADMISSIBLE:${item.workload.id}:${plan.blockingReasons.join('+')}`);
    }
  }

  const sourcePass=!blockers.some(reason=>
    reason.startsWith('CLOUD12_SOURCE_MISSING:')||
    reason.startsWith('CLOUD12_LINEAGE:')
  );
  const admission=planBatchAdmission(input.nodes,input.workItems.map(item=>item.workload));
  for(const item of admission.admissions){
    if(!item.admitted)blockers.push(`CLOUD12_SHADOW_NOT_ADMITTED:${item.workloadId}:${item.reasons.join('+')}`);
  }
  const shadowRuntimePass=
    sourcePass&&
    Object.values(storagePlans).every(plan=>plan.admissible)&&
    admission.admissions.length===input.workItems.length&&
    admission.admissions.every(item=>item.admitted);

  const evidence=input.physicalEvidence;
  if(!evidence||evidence.hardwareEvidenceRefs.length===0)blockers.push('CLOUD12_LIVE_HARDWARE_EVIDENCE_REQUIRED');
  if(!present(evidence?.k3sHealthRef))blockers.push('CLOUD12_LIVE_K3S_HEALTH_REQUIRED');
  if(!present(evidence?.kueueHealthRef))blockers.push('CLOUD12_LIVE_KUEUE_HEALTH_REQUIRED');
  if(!present(evidence?.gpuDeviceSmokeRef))blockers.push('CLOUD12_LIVE_GPU_SMOKE_REQUIRED');
  if(!present(evidence?.cephHealthRef))blockers.push('CLOUD12_LIVE_CEPH_HEALTH_REQUIRED');

  const infrastructurePass=Boolean(
    evidence&&
    evidence.hardwareEvidenceRefs.length>0&&
    present(evidence.k3sHealthRef)&&
    present(evidence.kueueHealthRef)&&
    present(evidence.gpuDeviceSmokeRef)&&
    present(evidence.cephHealthRef)
  );

  const receiptSources=new Set(
    (evidence?.workloadReceipts??[])
      .filter(receipt=>present(receipt.receiptRef)&&Number.isFinite(Date.parse(receipt.completedAt)))
      .map(receipt=>receipt.source),
  );
  for(const source of required){
    if(!receiptSources.has(source))blockers.push(`CLOUD12_LIVE_WORKLOAD_RECEIPT_REQUIRED:${source}`);
  }
  if(!present(evidence?.storageRestartRecoveryRef))blockers.push('CLOUD12_LIVE_STORAGE_RECOVERY_REQUIRED');
  if(!present(evidence?.workerCrashRecoveryRef))blockers.push('CLOUD12_LIVE_WORKER_RECOVERY_REQUIRED');
  if(!present(evidence?.telemetryRef))blockers.push('CLOUD12_LIVE_TELEMETRY_REQUIRED');
  if(!present(evidence?.cloudBurstDenialRef))blockers.push('CLOUD12_LIVE_PRIVATE_CLOUD_BURST_DENIAL_REQUIRED');
  if(!present(evidence?.costLimitDenialRef))blockers.push('CLOUD12_LIVE_COST_DENIAL_REQUIRED');

  const liveRuntimePass=
    infrastructurePass&&
    required.every(source=>receiptSources.has(source))&&
    present(evidence?.storageRestartRecoveryRef)&&
    present(evidence?.workerCrashRecoveryRef)&&
    present(evidence?.telemetryRef)&&
    present(evidence?.cloudBurstDenialRef)&&
    present(evidence?.costLimitDenialRef);

  return {
    sourcePass,
    infrastructurePass,
    shadowRuntimePass,
    liveRuntimePass,
    fullCertification:sourcePass&&infrastructurePass&&shadowRuntimePass&&liveRuntimePass,
    admission,
    storagePlans:Object.freeze({...storagePlans}),
    blockers:Object.freeze([...new Set(blockers)]),
  };
}
