import type {
  DirectorHumanMediaExecutionReceipt,
  DirectorHumanMediaHealthReceipt,
  DirectorHumanMediaJobRequest,
  DirectorHumanMediaRuntimeBundle,
} from './human-media-worker-contract.js';
import {
  evaluateDirectorHumanMediaHealth,
  validateDirectorHumanMediaExecutionReceipt,
  validateDirectorHumanMediaJob,
} from './human-media-worker-contract.js';
import type {DirectorHumanMediaQcInput} from './human-media-qc.js';
import {evaluateDirectorHumanMediaQc} from './human-media-qc.js';
import type {DirectorHumanMediaAttemptEconomicsReceipt} from './human-media-economics.js';
import {summarizeDirectorHumanMediaAttemptCost} from './human-media-economics.js';
import type {DirectorUgcVariantOutcomeReceipt} from './ugc-batch-experiment.js';
import type {
  DirectorLocalUgcFinalCertification,
  DirectorLocalUgcSocialEvidence,
} from './local-ugc-final.js';
import {certifyDirectorLocalUgcFinal} from './local-ugc-final.js';

export type DirectorLocalUgcCanaryBoundary=
  | 'RUNTIME_HEALTH_REQUIRED'
  | 'HUMAN_MEDIA_JOB_REQUIRED'
  | 'HUMAN_MEDIA_EXECUTION_REQUIRED'
  | 'HUMAN_MEDIA_QC_REQUIRED'
  | 'ACCEPTED_OUTPUT_ECONOMICS_REQUIRED'
  | 'UGC_OUTCOME_REQUIRED'
  | 'SOCIAL_HANDOFF_REQUIRED'
  | 'FINAL_CERTIFICATION_REQUIRED'
  | 'COMPLETE';

export type DirectorLocalUgcCanaryState=Readonly<{
  canaryId:string;
  projectId:string;
  runtimeBundle:DirectorHumanMediaRuntimeBundle;
  healthReceipt?:DirectorHumanMediaHealthReceipt;
  jobRequest?:DirectorHumanMediaJobRequest;
  executionReceipt?:DirectorHumanMediaExecutionReceipt;
  qcInput?:DirectorHumanMediaQcInput;
  economicsReceipt?:DirectorHumanMediaAttemptEconomicsReceipt;
  ugcOutcome?:DirectorUgcVariantOutcomeReceipt;
  socialHandoff?:DirectorLocalUgcSocialEvidence;
  finalCertification?:DirectorLocalUgcFinalCertification;
  evidenceIds:readonly string[];
}>;

export type DirectorLocalUgcCanaryCommissioningDecision=Readonly<{
  canaryId:string;
  projectId:string;
  admissibleToAdvance:boolean;
  complete:boolean;
  nextBoundary:DirectorLocalUgcCanaryBoundary;
  blockers:readonly string[];
  evidenceIds:readonly string[];
  realizedAcceptedOutputCostUsd?:number;
  authority:'DIRECTOR_LOCAL_UGC_CANARY_COMMISSIONER';
  canCreateCompute:false;
  canSpend:false;
  canApproveCreative:false;
  canPublish:false;
}>;

const uniq=(values:readonly string[])=>[
  ...new Set(values.map(value=>String(value).trim()).filter(Boolean)),
];
const marker=(canaryId:string)=>`ugc-canary:${canaryId}`;
const has=(values:readonly string[],value:string)=>values.some(item=>item.trim()===value);

function identityReasons(state:DirectorLocalUgcCanaryState):string[]{
  const reasons:string[]=[];
  if(!state.canaryId.trim()||!state.projectId.trim()){
    reasons.push('DIRECTOR_LOCAL_UGC_CANARY_IDENTITY_REQUIRED');
  }
  if(!has(state.evidenceIds,marker(state.canaryId))){
    reasons.push('DIRECTOR_LOCAL_UGC_CANARY_ROOT_LINEAGE_REQUIRED');
  }
  if(state.runtimeBundle.engine!=='musetalk'){
    reasons.push('DIRECTOR_LOCAL_UGC_CANARY_MUSETALK_RUNTIME_REQUIRED');
  }
  return reasons;
}

function result(
  state:DirectorLocalUgcCanaryState,
  nextBoundary:DirectorLocalUgcCanaryBoundary,
  blockers:readonly string[],
  extraEvidence:readonly string[]=[],
  realizedAcceptedOutputCostUsd?:number,
):DirectorLocalUgcCanaryCommissioningDecision{
  const uniqueBlockers=uniq(blockers);
  return Object.freeze({
    canaryId:state.canaryId.trim(),
    projectId:state.projectId.trim(),
    admissibleToAdvance:uniqueBlockers.length===0&&nextBoundary!=='COMPLETE',
    complete:nextBoundary==='COMPLETE'&&uniqueBlockers.length===0,
    nextBoundary,
    blockers:Object.freeze(uniqueBlockers),
    evidenceIds:Object.freeze(uniq([...state.evidenceIds,...extraEvidence])),
    ...(realizedAcceptedOutputCostUsd!==undefined?{realizedAcceptedOutputCostUsd}:{}),
    authority:'DIRECTOR_LOCAL_UGC_CANARY_COMMISSIONER',
    canCreateCompute:false,
    canSpend:false,
    canApproveCreative:false,
    canPublish:false,
  });
}

export function inspectDirectorLocalUgcCanaryCommissioning(
  state:DirectorLocalUgcCanaryState,
):DirectorLocalUgcCanaryCommissioningDecision{
  const base=identityReasons(state);
  if(base.length)return result(state,'RUNTIME_HEALTH_REQUIRED',base);

  if(!state.healthReceipt){
    return result(state,'RUNTIME_HEALTH_REQUIRED',[]);
  }
  const healthReasons=evaluateDirectorHumanMediaHealth(
    state.runtimeBundle,
    state.healthReceipt,
  ).map(reason=>`DIRECTOR_LOCAL_UGC_CANARY_HEALTH:${reason}`);
  if(healthReasons.length){
    return result(
      state,
      'RUNTIME_HEALTH_REQUIRED',
      healthReasons,
      [`human-media-health:${state.healthReceipt.runtimeInstanceId}`],
    );
  }

  if(!state.jobRequest){
    return result(
      state,
      'HUMAN_MEDIA_JOB_REQUIRED',
      [],
      [`human-media-health:${state.healthReceipt.runtimeInstanceId}`],
    );
  }
  const jobReasons=[
    ...validateDirectorHumanMediaJob(state.jobRequest)
      .map(reason=>`DIRECTOR_LOCAL_UGC_CANARY_JOB:${reason}`),
  ];
  if(state.jobRequest.projectId!==state.projectId){
    jobReasons.push('DIRECTOR_LOCAL_UGC_CANARY_JOB_PROJECT_MISMATCH');
  }
  if(state.jobRequest.engine!=='musetalk'||state.jobRequest.task!=='lip-sync'){
    jobReasons.push('DIRECTOR_LOCAL_UGC_CANARY_MUSETALK_LIPSYNC_JOB_REQUIRED');
  }
  if(!has(state.jobRequest.evidenceIds,marker(state.canaryId))){
    jobReasons.push('DIRECTOR_LOCAL_UGC_CANARY_JOB_LINEAGE_REQUIRED');
  }
  if(jobReasons.length){
    return result(state,'HUMAN_MEDIA_JOB_REQUIRED',jobReasons,state.jobRequest.evidenceIds);
  }

  if(!state.executionReceipt){
    return result(state,'HUMAN_MEDIA_EXECUTION_REQUIRED',[],state.jobRequest.evidenceIds);
  }
  const executionReasons=validateDirectorHumanMediaExecutionReceipt(
    state.jobRequest,
    state.runtimeBundle,
    state.executionReceipt,
  ).map(reason=>`DIRECTOR_LOCAL_UGC_CANARY_EXECUTION:${reason}`);
  if(state.executionReceipt.status!=='ready'||!state.executionReceipt.output){
    executionReasons.push('DIRECTOR_LOCAL_UGC_CANARY_READY_EXECUTION_REQUIRED');
  }
  if(state.executionReceipt.runtimeInstanceId!==state.healthReceipt.runtimeInstanceId){
    executionReasons.push('DIRECTOR_LOCAL_UGC_CANARY_RUNTIME_INSTANCE_MISMATCH');
  }
  if(executionReasons.length){
    return result(
      state,
      'HUMAN_MEDIA_EXECUTION_REQUIRED',
      executionReasons,
      [
        ...state.jobRequest.evidenceIds,
        `human-media-execution:${state.executionReceipt.providerJobId}`,
      ],
    );
  }

  if(!state.qcInput){
    return result(
      state,
      'HUMAN_MEDIA_QC_REQUIRED',
      [],
      [`human-media-execution:${state.executionReceipt.providerJobId}`],
    );
  }
  const qcDecision=evaluateDirectorHumanMediaQc(state.qcInput);
  const qcReasons:string[]=[];
  if(state.qcInput.projectId!==state.projectId||state.qcInput.jobId!==state.jobRequest.id){
    qcReasons.push('DIRECTOR_LOCAL_UGC_CANARY_QC_LINEAGE_MISMATCH');
  }
  if(state.qcInput.executionReceipt.providerJobId!==state.executionReceipt.providerJobId){
    qcReasons.push('DIRECTOR_LOCAL_UGC_CANARY_QC_EXECUTION_MISMATCH');
  }
  if(!has(state.qcInput.evidenceIds,marker(state.canaryId))){
    qcReasons.push('DIRECTOR_LOCAL_UGC_CANARY_QC_CANARY_LINEAGE_REQUIRED');
  }
  if(!qcDecision.admissible||qcDecision.action!=='accept'){
    qcReasons.push('DIRECTOR_LOCAL_UGC_CANARY_QC_ACCEPTANCE_REQUIRED');
    qcReasons.push(...qcDecision.reasons.map(reason=>`DIRECTOR_LOCAL_UGC_CANARY_QC:${reason}`));
  }
  if(qcReasons.length){
    return result(
      state,
      'HUMAN_MEDIA_QC_REQUIRED',
      qcReasons,
      [...state.qcInput.evidenceIds,...qcDecision.evidenceIds],
    );
  }

  if(!state.economicsReceipt){
    return result(
      state,
      'ACCEPTED_OUTPUT_ECONOMICS_REQUIRED',
      [],
      [...state.qcInput.evidenceIds,...qcDecision.evidenceIds],
    );
  }
  const economicsReasons:string[]=[];
  const economics=state.economicsReceipt;
  if(economics.projectId!==state.projectId){
    economicsReasons.push('DIRECTOR_LOCAL_UGC_CANARY_ECONOMICS_PROJECT_MISMATCH');
  }
  if(economics.engine!==state.executionReceipt.engine||economics.task!==state.executionReceipt.task){
    economicsReasons.push('DIRECTOR_LOCAL_UGC_CANARY_ECONOMICS_WORKLOAD_MISMATCH');
  }
  if(economics.attemptNumber!==state.qcInput.attempt){
    economicsReasons.push('DIRECTOR_LOCAL_UGC_CANARY_ECONOMICS_ATTEMPT_MISMATCH');
  }
  if(!economics.accepted||economics.qcAction!=='accept'){
    economicsReasons.push('DIRECTOR_LOCAL_UGC_CANARY_ECONOMICS_ACCEPTANCE_REQUIRED');
  }
  if(!has(economics.evidenceIds,marker(state.canaryId))){
    economicsReasons.push('DIRECTOR_LOCAL_UGC_CANARY_ECONOMICS_LINEAGE_REQUIRED');
  }
  const realized=summarizeDirectorHumanMediaAttemptCost(economics).totalCostUsd;
  if(!Number.isFinite(realized)||realized<0){
    economicsReasons.push('DIRECTOR_LOCAL_UGC_CANARY_ECONOMICS_COST_INVALID');
  }
  if(economicsReasons.length){
    return result(
      state,
      'ACCEPTED_OUTPUT_ECONOMICS_REQUIRED',
      economicsReasons,
      [...economics.evidenceIds,...economics.pricingSourceRefs],
    );
  }

  if(!state.ugcOutcome){
    return result(
      state,
      'UGC_OUTCOME_REQUIRED',
      [],
      [
        ...economics.evidenceIds,
        ...economics.pricingSourceRefs,
        `human-media-attempt-economics:${economics.id}`,
      ],
      realized,
    );
  }
  const outcome=state.ugcOutcome;
  const outcomeEvidence=[
    ...outcome.costEvidenceIds,
    ...outcome.reviewEvidenceIds,
    ...outcome.experimentEvidenceIds,
  ];
  const outcomeReasons:string[]=[];
  if(outcome.projectId!==state.projectId){
    outcomeReasons.push('DIRECTOR_LOCAL_UGC_CANARY_UGC_OUTCOME_PROJECT_MISMATCH');
  }
  if(outcome.generationJobId!==state.executionReceipt.providerJobId&&outcome.generationJobId!==state.jobRequest.id){
    outcomeReasons.push('DIRECTOR_LOCAL_UGC_CANARY_UGC_OUTCOME_EXECUTION_MISMATCH');
  }
  if(!has(outcomeEvidence,marker(state.canaryId))){
    outcomeReasons.push('DIRECTOR_LOCAL_UGC_CANARY_UGC_OUTCOME_LINEAGE_REQUIRED');
  }
  if(!outcome.costEvidenceIds.includes(`human-media-attempt-economics:${economics.id}`)){
    outcomeReasons.push('DIRECTOR_LOCAL_UGC_CANARY_UGC_COST_LINK_REQUIRED');
  }
  if(Math.abs(outcome.acceptedOutputCostUsd-realized)>.01){
    outcomeReasons.push('DIRECTOR_LOCAL_UGC_CANARY_REALIZED_COST_MISMATCH');
  }
  if(outcomeReasons.length){
    return result(state,'UGC_OUTCOME_REQUIRED',outcomeReasons,outcomeEvidence,realized);
  }

  if(!state.socialHandoff){
    return result(
      state,
      'SOCIAL_HANDOFF_REQUIRED',
      [],
      [...outcomeEvidence,`ugc-variant-outcome:${outcome.id}`],
      realized,
    );
  }
  const socialReasons:string[]=[];
  if(state.socialHandoff.projectId!==state.projectId){
    socialReasons.push('DIRECTOR_LOCAL_UGC_CANARY_SOCIAL_PROJECT_MISMATCH');
  }
  if(!state.socialHandoff.productionReadyForSocialProposal||!state.socialHandoff.socialHandoffVerified){
    socialReasons.push('DIRECTOR_LOCAL_UGC_CANARY_SOCIAL_HANDOFF_REQUIRED');
  }
  if(!has(state.socialHandoff.evidenceIds,marker(state.canaryId))){
    socialReasons.push('DIRECTOR_LOCAL_UGC_CANARY_SOCIAL_LINEAGE_REQUIRED');
  }
  if(
    !state.socialHandoff.finalMasterAssetId.trim()||
    !state.socialHandoff.evidenceIds.includes(
      `qc-admitted-final-master:${state.socialHandoff.finalMasterAssetId}`,
    )
  ){
    socialReasons.push('DIRECTOR_LOCAL_UGC_CANARY_SOCIAL_MASTER_QC_LINK_REQUIRED');
  }
  if(socialReasons.length){
    return result(
      state,
      'SOCIAL_HANDOFF_REQUIRED',
      socialReasons,
      state.socialHandoff.evidenceIds,
      realized,
    );
  }

  if(!state.finalCertification){
    return result(
      state,
      'FINAL_CERTIFICATION_REQUIRED',
      [],
      state.socialHandoff.evidenceIds,
      realized,
    );
  }

  const recomputed=certifyDirectorLocalUgcFinal({
    canaryId:state.canaryId,
    projectId:state.projectId,
    runtimeBundle:state.runtimeBundle,
    healthReceipt:state.healthReceipt,
    jobRequest:state.jobRequest,
    executionReceipt:state.executionReceipt,
    qcInput:state.qcInput,
    economicsReceipt:state.economicsReceipt,
    ugcOutcome:state.ugcOutcome,
    socialHandoff:state.socialHandoff,
    evidenceIds:state.evidenceIds,
  });
  const finalReasons:string[]=[];
  if(!recomputed.admissible){
    finalReasons.push(...recomputed.reasons.map(reason=>`DIRECTOR_LOCAL_UGC_CANARY_FINAL:${reason}`));
  }
  if(
    state.finalCertification.canaryId!==recomputed.canaryId||
    state.finalCertification.projectId!==recomputed.projectId||
    state.finalCertification.admissible!==recomputed.admissible
  ){
    finalReasons.push('DIRECTOR_LOCAL_UGC_CANARY_FINAL_RECEIPT_MISMATCH');
  }
  if(finalReasons.length){
    return result(
      state,
      'FINAL_CERTIFICATION_REQUIRED',
      finalReasons,
      recomputed.evidenceIds,
      realized,
    );
  }

  return result(
    state,
    'COMPLETE',
    [],
    recomputed.evidenceIds,
    realized,
  );
}
