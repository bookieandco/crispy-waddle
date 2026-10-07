import type {
  DirectorHumanMediaExecutionReceipt,DirectorHumanMediaHealthReceipt,
  DirectorHumanMediaJobRequest,DirectorHumanMediaRuntimeBundle,
} from './human-media-worker-contract.js';
import {
  evaluateDirectorHumanMediaHealth,validateDirectorHumanMediaExecutionReceipt,
  validateDirectorHumanMediaJob,
} from './human-media-worker-contract.js';
import type {DirectorHumanMediaQcInput} from './human-media-qc.js';
import {evaluateDirectorHumanMediaQc} from './human-media-qc.js';
import type {DirectorHumanMediaAttemptEconomicsReceipt} from './human-media-economics.js';
import {summarizeDirectorHumanMediaAttemptCost} from './human-media-economics.js';
import type {DirectorUgcVariantOutcomeReceipt} from './ugc-batch-experiment.js';

export type DirectorLocalUgcSocialEvidence=Readonly<{
  projectId:string;productionReadyForSocialProposal:boolean;socialHandoffVerified:boolean;
  finalMasterAssetId:string;evidenceIds:readonly string[];observedAt:string;
}>;

export type DirectorLocalUgcFinalInput=Readonly<{
  canaryId:string;projectId:string;runtimeBundle:DirectorHumanMediaRuntimeBundle;
  healthReceipt:DirectorHumanMediaHealthReceipt;jobRequest:DirectorHumanMediaJobRequest;
  executionReceipt:DirectorHumanMediaExecutionReceipt;qcInput:DirectorHumanMediaQcInput;
  economicsReceipt:DirectorHumanMediaAttemptEconomicsReceipt;ugcOutcome:DirectorUgcVariantOutcomeReceipt;
  socialHandoff:DirectorLocalUgcSocialEvidence;evidenceIds:readonly string[];
}>;

export type DirectorLocalUgcFinalCertification=Readonly<{
  schema:'director.local-ugc-final-certification.v1';canaryId:string;projectId:string;
  admissible:boolean;reasons:readonly string[];evidenceIds:readonly string[];
  authority:'DIRECTOR_LOCAL_UGC_FINAL_CERTIFICATION';
  canApproveCreative:false;canPublish:false;canSpend:false;
}>;

const SHA=/^(?:sha256:)?[a-f0-9]{64}$/i;
const uniq=(v:readonly string[])=>[...new Set(v.map(x=>String(x).trim()).filter(Boolean))];
const norm=(v:string)=>v.trim().toLowerCase().replace(/^sha256:/,'');
const iso=(v:string)=>Number.isFinite(Date.parse(v));
const has=(v:readonly string[],m:string)=>v.some(x=>x.trim()===m);
const mark=(r:string[],v:readonly string[],m:string,c:string)=>{if(!has(v,m))r.push(c)};
const outcomeEvidence=(o:DirectorUgcVariantOutcomeReceipt)=>[
  ...o.costEvidenceIds,...o.reviewEvidenceIds,...o.experimentEvidenceIds,
];

export function certifyDirectorLocalUgcFinal(x:DirectorLocalUgcFinalInput):DirectorLocalUgcFinalCertification{
  const r:string[]=[];
  const canaryId=x.canaryId.trim(),projectId=x.projectId.trim(),marker=`ugc-canary:${canaryId}`;
  if(!canaryId||!projectId)r.push('DIRECTOR_LOCAL_UGC_FINAL_IDENTITY_REQUIRED');
  mark(r,x.evidenceIds,marker,'DIRECTOR_LOCAL_UGC_FINAL_ROOT_CANARY_LINEAGE_REQUIRED');

  if(x.runtimeBundle.engine!=='musetalk')r.push('DIRECTOR_LOCAL_UGC_FINAL_MUSETALK_RUNTIME_REQUIRED');
  r.push(...evaluateDirectorHumanMediaHealth(x.runtimeBundle,x.healthReceipt)
    .map(v=>`DIRECTOR_LOCAL_UGC_FINAL_HEALTH:${v}`));

  if(x.jobRequest.projectId!==projectId)r.push('DIRECTOR_LOCAL_UGC_FINAL_JOB_PROJECT_MISMATCH');
  if(x.jobRequest.engine!=='musetalk'||x.jobRequest.task!=='lip-sync')
    r.push('DIRECTOR_LOCAL_UGC_FINAL_MUSETALK_LIPSYNC_JOB_REQUIRED');
  r.push(...validateDirectorHumanMediaJob(x.jobRequest).map(v=>`DIRECTOR_LOCAL_UGC_FINAL_JOB:${v}`));
  mark(r,x.jobRequest.evidenceIds,marker,'DIRECTOR_LOCAL_UGC_FINAL_JOB_CANARY_LINEAGE_REQUIRED');

  r.push(...validateDirectorHumanMediaExecutionReceipt(
    x.jobRequest,x.runtimeBundle,x.executionReceipt,
  ).map(v=>`DIRECTOR_LOCAL_UGC_FINAL_EXECUTION:${v}`));
  if(x.executionReceipt.status!=='ready'||!x.executionReceipt.output)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_READY_EXECUTION_REQUIRED');
  if(x.executionReceipt.runtimeInstanceId!==x.healthReceipt.runtimeInstanceId)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_RUNTIME_INSTANCE_MISMATCH');

  if(x.qcInput.projectId!==projectId||x.qcInput.jobId!==x.jobRequest.id)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_QC_LINEAGE_MISMATCH');
  if(x.qcInput.executionReceipt.providerJobId!==x.executionReceipt.providerJobId)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_QC_EXECUTION_MISMATCH');
  mark(r,x.qcInput.evidenceIds,marker,'DIRECTOR_LOCAL_UGC_FINAL_QC_CANARY_LINEAGE_REQUIRED');
  const qc=evaluateDirectorHumanMediaQc(x.qcInput);
  if(!qc.admissible||qc.action!=='accept'){
    r.push('DIRECTOR_LOCAL_UGC_FINAL_QC_ACCEPTANCE_REQUIRED');
    r.push(...qc.reasons.map(v=>`DIRECTOR_LOCAL_UGC_FINAL_QC:${v}`));
  }

  const e=x.economicsReceipt;
  if(e.projectId!==projectId)r.push('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_PROJECT_MISMATCH');
  if(e.engine!==x.executionReceipt.engine||e.task!==x.executionReceipt.task)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_WORKLOAD_MISMATCH');
  if(e.attemptNumber!==x.qcInput.attempt)r.push('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_ATTEMPT_MISMATCH');
  if(!e.accepted||e.qcAction!=='accept'||qc.action!=='accept')
    r.push('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_ACCEPTANCE_REQUIRED');
  if(!e.pricingSourceRefs.length||!e.evidenceIds.length||!iso(e.observedAt))
    r.push('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_EVIDENCE_INVALID');
  if([e.generationCostUsd,e.repairCostUsd,e.humanReviewMinutes,e.humanLaborRateUsdPerHour]
    .some(v=>!Number.isFinite(v)||v<0))r.push('DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_COST_INVALID');
  mark(r,e.evidenceIds,marker,'DIRECTOR_LOCAL_UGC_FINAL_ECONOMICS_CANARY_LINEAGE_REQUIRED');

  const o=x.ugcOutcome,oe=outcomeEvidence(o);
  if(o.projectId!==projectId)r.push('DIRECTOR_LOCAL_UGC_FINAL_UGC_OUTCOME_PROJECT_MISMATCH');
  if(!o.artifactId.trim()||!SHA.test(o.artifactSha256))
    r.push('DIRECTOR_LOCAL_UGC_FINAL_UGC_OUTCOME_ARTIFACT_INVALID');
  if(o.generationJobId!==x.executionReceipt.providerJobId&&o.generationJobId!==x.jobRequest.id)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_UGC_OUTCOME_EXECUTION_MISMATCH');
  mark(r,oe,marker,'DIRECTOR_LOCAL_UGC_FINAL_UGC_OUTCOME_CANARY_LINEAGE_REQUIRED');

  const outSha=x.executionReceipt.output?.sha256??'';
  if(outSha&&norm(outSha)!==norm(x.qcInput.outputSha256))
    r.push('DIRECTOR_LOCAL_UGC_FINAL_EXECUTION_QC_HASH_MISMATCH');
  if(outSha&&norm(outSha)!==norm(o.artifactSha256))
    r.push('DIRECTOR_LOCAL_UGC_FINAL_EXECUTION_OUTCOME_HASH_MISMATCH');

  const realized=summarizeDirectorHumanMediaAttemptCost(e).totalCostUsd;
  if(Math.abs(realized-o.acceptedOutputCostUsd)>.01)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_REALIZED_COST_MISMATCH');
  if(!o.costEvidenceIds.includes(`human-media-attempt-economics:${e.id}`))
    r.push('DIRECTOR_LOCAL_UGC_FINAL_UGC_COST_RECEIPT_LINK_REQUIRED');

  const s=x.socialHandoff;
  if(s.projectId!==projectId)r.push('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_PROJECT_MISMATCH');
  if(!iso(s.observedAt))r.push('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_TIME_INVALID');
  if(!s.productionReadyForSocialProposal||!s.socialHandoffVerified)
    r.push('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_HANDOFF_REQUIRED');
  if(!s.finalMasterAssetId.trim())r.push('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_MASTER_REQUIRED');
  mark(r,s.evidenceIds,marker,'DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_CANARY_LINEAGE_REQUIRED');
  if(s.finalMasterAssetId&&!s.evidenceIds.includes(`qc-admitted-final-master:${s.finalMasterAssetId}`))
    r.push('DIRECTOR_LOCAL_UGC_FINAL_SOCIAL_MASTER_QC_LINK_REQUIRED');

  return Object.freeze({
    schema:'director.local-ugc-final-certification.v1',canaryId,projectId,
    admissible:r.length===0,reasons:Object.freeze(uniq(r)),
    evidenceIds:Object.freeze(uniq([
      ...x.evidenceIds,...x.jobRequest.evidenceIds,...x.qcInput.evidenceIds,...qc.evidenceIds,
      ...e.evidenceIds,...e.pricingSourceRefs,...oe,...s.evidenceIds,
      `human-media-health:${x.healthReceipt.runtimeInstanceId}`,
      `human-media-execution:${x.executionReceipt.providerJobId}`,
      `human-media-attempt-economics:${e.id}`,`ugc-variant-outcome:${o.id}`,
    ])),
    authority:'DIRECTOR_LOCAL_UGC_FINAL_CERTIFICATION',
    canApproveCreative:false,canPublish:false,canSpend:false,
  });
}
