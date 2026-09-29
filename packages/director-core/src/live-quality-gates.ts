import {
  evaluateDirectedTakeQc,
  REALISTIC_CHARACTER_TAKE_QC,
  type DirectedTakeQcObservation,
  type DirectedTakeQcPolicy,
} from './directed-take-qc.js';
import {
  evaluateLocalizedVideoRepair,
  type LocalizedVideoRepairPlan,
} from './localized-video-repair.js';

export type DirectorLiveQualityTakePurpose='quality4-canary'|'quality5-stress';

export interface DirectorLiveTakeArtifactEvidence{
  providerId:string;
  modelId:string;
  modelVersion:string;
  providerJobId:string;
  providerRuntimeReceiptId:string;
  seed:number;
  referenceAssetId:string;
  referenceSha256:string;
  outputAssetId:string;
  outputSha256:string;
  contentType:string;
  measuredDurationSeconds:number;
  storageVerified:boolean;
  productionProvider:boolean;
  evidenceIds:readonly string[];
}

export interface DirectorLiveTakePerformanceEvidence{
  audioAssetId:string;
  voiceIdentityId:string;
  speakerFingerprintReceiptId:string;
  speakerFingerprintRef:string;
  speakerSimilarity:number;
  lipSyncScore:number;
  movedAwayFromChair:boolean;
  dialoguePerformed:boolean;
  interactionRefs:readonly string[];
  evidenceIds:readonly string[];
}

export interface DirectorLiveTakeReviewInput{
  purpose:DirectorLiveQualityTakePurpose;
  projectId:string;
  characterId:string;
  artifact:DirectorLiveTakeArtifactEvidence;
  performance:DirectorLiveTakePerformanceEvidence;
  observations:readonly DirectedTakeQcObservation[];
  evidenceIds:readonly string[];
}

export interface DirectorLiveTakeReviewDecision{
  admissible:boolean;
  expectedFailureObserved:boolean;
  reasons:readonly string[];
  qcPolicyId:string;
  authority:'DIRECTOR_LIVE_TAKE_QC';
}

const CANARY_POLICY:DirectedTakeQcPolicy=Object.freeze({
  ...REALISTIC_CHARACTER_TAKE_QC,
  id:'bonez-quality-live:v1',
  requiredMetrics:Object.freeze([
    ...REALISTIC_CHARACTER_TAKE_QC.requiredMetrics,
    'audio-sync',
  ]),
  minimumScoreByMetric:Object.freeze({
    ...REALISTIC_CHARACTER_TAKE_QC.minimumScoreByMetric,
    'audio-sync':0.84,
  }),
});

const FORBIDDEN_PROVIDERS=new Set(['director-certification-smoke','fixture','synthetic','mock','test']);

export function evaluateDirectorLiveTake(input:DirectorLiveTakeReviewInput):DirectorLiveTakeReviewDecision{
  const reasons:string[]=[];
  const artifact=input.artifact;
  if(!input.projectId.trim()||!input.characterId.trim()||!input.evidenceIds.length){
    reasons.push('DIRECTOR_LIVE_TAKE_IDENTITY_OR_EVIDENCE_REQUIRED');
  }
  if(
    !artifact.providerId.trim()||!artifact.modelId.trim()||!artifact.modelVersion.trim()||
    !artifact.providerJobId.trim()||!artifact.providerRuntimeReceiptId.trim()||
    !artifact.referenceAssetId.trim()||!artifact.outputAssetId.trim()||!artifact.evidenceIds.length
  ) reasons.push('DIRECTOR_LIVE_TAKE_PROVIDER_PROVENANCE_REQUIRED');
  if(FORBIDDEN_PROVIDERS.has(artifact.providerId.toLowerCase())) {
    reasons.push('DIRECTOR_LIVE_TAKE_SMOKE_PROVIDER_FORBIDDEN');
  }
  if(!artifact.productionProvider) reasons.push('DIRECTOR_LIVE_TAKE_PRODUCTION_PROVIDER_REQUIRED');
  if(!artifact.storageVerified) reasons.push('DIRECTOR_LIVE_TAKE_STORAGE_VERIFICATION_REQUIRED');
  if(!/^[a-f0-9]{64}$/i.test(artifact.referenceSha256)) reasons.push('DIRECTOR_LIVE_TAKE_REFERENCE_HASH_INVALID');
  if(!/^[a-f0-9]{64}$/i.test(artifact.outputSha256)) reasons.push('DIRECTOR_LIVE_TAKE_OUTPUT_HASH_INVALID');
  if(!artifact.contentType.toLowerCase().startsWith('video/')) reasons.push('DIRECTOR_LIVE_TAKE_VIDEO_REQUIRED');
  if(!Number.isInteger(artifact.seed)||artifact.seed<0) reasons.push('DIRECTOR_LIVE_TAKE_SEED_INVALID');
  if(
    !Number.isFinite(artifact.measuredDurationSeconds)||
    artifact.measuredDurationSeconds<5||
    artifact.measuredDurationSeconds>10
  ) reasons.push('DIRECTOR_LIVE_TAKE_DURATION_OUT_OF_RANGE');

  const performance=input.performance;
  if(
    !performance.audioAssetId.trim()||!performance.voiceIdentityId.trim()||
    !performance.speakerFingerprintReceiptId.trim()||!performance.speakerFingerprintRef.trim()||
    !performance.evidenceIds.length
  ) reasons.push('DIRECTOR_LIVE_TAKE_PERFORMANCE_PROVENANCE_REQUIRED');
  if(!Number.isFinite(performance.speakerSimilarity)||performance.speakerSimilarity<0.80||performance.speakerSimilarity>1){
    reasons.push('DIRECTOR_LIVE_TAKE_SPEAKER_SIMILARITY_LOW');
  }
  if(!Number.isFinite(performance.lipSyncScore)||performance.lipSyncScore<0.84||performance.lipSyncScore>1){
    reasons.push('DIRECTOR_LIVE_TAKE_LIP_SYNC_LOW');
  }
  if(!performance.movedAwayFromChair) reasons.push('DIRECTOR_BONEZ_MOVEMENT_AWAY_FROM_CHAIR_REQUIRED');
  if(!performance.dialoguePerformed) reasons.push('DIRECTOR_BONEZ_DIALOGUE_PERFORMANCE_REQUIRED');
  const interactions=new Set(performance.interactionRefs);
  for(const required of ['chair','microphone','set']){
    if(!interactions.has(required)) reasons.push('DIRECTOR_BONEZ_INTERACTION_REQUIRED:'+required);
  }

  const qc=evaluateDirectedTakeQc(input.observations,CANARY_POLICY);
  reasons.push(...qc.reasons);

  const expectedFailureObserved=input.purpose==='quality5-stress'&&!qc.admissible&&
    input.observations.some(observation=>
      observation.hardFailure===true||
      qc.reasons.some(reason=>reason.endsWith(':'+observation.metric))
    );

  if(input.purpose==='quality5-stress'){
    if(!expectedFailureObserved) reasons.push('DIRECTOR_QUALITY_5_REAL_FAILURE_REQUIRED');
    return Object.freeze({
      admissible:false,
      expectedFailureObserved,
      reasons:Object.freeze([...new Set(reasons)]),
      qcPolicyId:CANARY_POLICY.id,
      authority:'DIRECTOR_LIVE_TAKE_QC',
    });
  }

  return Object.freeze({
    admissible:reasons.length===0,
    expectedFailureObserved:false,
    reasons:Object.freeze([...new Set(reasons)]),
    qcPolicyId:CANARY_POLICY.id,
    authority:'DIRECTOR_LIVE_TAKE_QC',
  });
}

export interface DirectorLocalizedRepairArtifactEvidence{
  providerId:string;
  modelId:string;
  modelVersion:string;
  providerJobId:string;
  providerRuntimeReceiptId:string;
  assetId:string;
  sha256:string;
  contentType:string;
  storageVerified:boolean;
  evidenceIds:readonly string[];
}

export interface DirectorLocalizedRepairPreservationEvidence{
  identityPreserved:boolean;
  cameraTimingPreserved:boolean;
  unaffectedRegionsPreserved:boolean;
  preservedDirectiveIds:readonly string[];
  evidenceIds:readonly string[];
}

export interface DirectorQuality5RepairInput{
  projectId:string;
  characterId:string;
  failureTakeReceiptId:string;
  failureAssetId:string;
  failureAssetSha256:string;
  failureQcReasons:readonly string[];
  failureObservations:readonly DirectedTakeQcObservation[];
  plan:LocalizedVideoRepairPlan;
  repairedArtifact:DirectorLocalizedRepairArtifactEvidence;
  postRepairObservations:readonly DirectedTakeQcObservation[];
  preservation:DirectorLocalizedRepairPreservationEvidence;
  evidenceIds:readonly string[];
}

export interface DirectorQuality5RepairDecision{
  admissible:boolean;
  reasons:readonly string[];
  repairDurationSeconds:number;
  authority:'DIRECTOR_QUALITY_5_LOCALIZED_REPAIR_QC';
}

export function evaluateDirectorQuality5Repair(input:DirectorQuality5RepairInput):DirectorQuality5RepairDecision{
  const reasons:string[]=[];
  if(
    !input.projectId.trim()||!input.characterId.trim()||!input.failureTakeReceiptId.trim()||
    !input.failureAssetId.trim()||!input.evidenceIds.length
  ) reasons.push('DIRECTOR_QUALITY_5_IDENTITY_OR_EVIDENCE_REQUIRED');
  if(!/^[a-f0-9]{64}$/i.test(input.failureAssetSha256)) reasons.push('DIRECTOR_QUALITY_5_FAILURE_HASH_INVALID');

  const failureQc=evaluateDirectedTakeQc(input.failureObservations,CANARY_POLICY);
  if(failureQc.admissible||!input.failureQcReasons.length){
    reasons.push('DIRECTOR_QUALITY_5_REAL_FAILURE_REQUIRED');
  }
  const suppliedFailureReasons=new Set(input.failureQcReasons);
  if(failureQc.reasons.some(reason=>!suppliedFailureReasons.has(reason))){
    reasons.push('DIRECTOR_QUALITY_5_FAILURE_REASON_MISMATCH');
  }

  const planDecision=evaluateLocalizedVideoRepair(input.plan);
  reasons.push(...planDecision.reasons.map(reason=>'DIRECTOR_QUALITY_5_PLAN:'+reason));
  if(input.plan.projectId!==input.projectId) reasons.push('DIRECTOR_QUALITY_5_PLAN_PROJECT_MISMATCH');
  if(input.plan.sourceAssetId!==input.failureAssetId) reasons.push('DIRECTOR_QUALITY_5_PLAN_SOURCE_MISMATCH');
  if(!['remove-object','replace-region','cleanup'].includes(input.plan.operation)){
    reasons.push('DIRECTOR_QUALITY_5_OPERATION_UNSUPPORTED');
  }
  if(
    !Number.isFinite(input.plan.repairStartSeconds)||!Number.isFinite(input.plan.repairEndSeconds)||
    input.plan.repairEndSeconds<=input.plan.repairStartSeconds
  ) reasons.push('DIRECTOR_QUALITY_5_LOCALIZED_RANGE_REQUIRED');
  const rangedFailure=input.failureObservations.some(observation=>
    observation.startSeconds!==undefined&&observation.endSeconds!==undefined&&
    observation.endSeconds>observation.startSeconds&&
    failureQc.reasons.some(reason=>reason.endsWith(':'+observation.metric))
  );
  if(!rangedFailure) reasons.push('DIRECTOR_QUALITY_5_LOCALIZED_FAILURE_EVIDENCE_REQUIRED');

  const repaired=input.repairedArtifact;
  if(
    !repaired.providerId.trim()||!repaired.modelId.trim()||!repaired.modelVersion.trim()||
    !repaired.providerJobId.trim()||!repaired.providerRuntimeReceiptId.trim()||
    !repaired.assetId.trim()||!repaired.evidenceIds.length
  ) reasons.push('DIRECTOR_QUALITY_5_REPAIR_PROVIDER_PROVENANCE_REQUIRED');
  if(!/^[a-f0-9]{64}$/i.test(repaired.sha256)) reasons.push('DIRECTOR_QUALITY_5_REPAIR_HASH_INVALID');
  if(repaired.sha256.toLowerCase()===input.failureAssetSha256.toLowerCase()){
    reasons.push('DIRECTOR_QUALITY_5_REPAIR_OUTPUT_MUST_CHANGE');
  }
  if(!repaired.contentType.toLowerCase().startsWith('video/')) reasons.push('DIRECTOR_QUALITY_5_REPAIR_VIDEO_REQUIRED');
  if(!repaired.storageVerified) reasons.push('DIRECTOR_QUALITY_5_REPAIR_STORAGE_VERIFICATION_REQUIRED');

  const post=evaluateDirectedTakeQc(input.postRepairObservations,CANARY_POLICY);
  if(!post.admissible) reasons.push(...post.reasons.map(reason=>'DIRECTOR_QUALITY_5_POST_REPAIR:'+reason));

  const preservation=input.preservation;
  if(!preservation.identityPreserved) reasons.push('DIRECTOR_QUALITY_5_IDENTITY_NOT_PRESERVED');
  if(!preservation.cameraTimingPreserved) reasons.push('DIRECTOR_QUALITY_5_CAMERA_TIMING_NOT_PRESERVED');
  if(!preservation.unaffectedRegionsPreserved) reasons.push('DIRECTOR_QUALITY_5_UNAFFECTED_REGIONS_NOT_PRESERVED');
  if(!preservation.preservedDirectiveIds.length||!preservation.evidenceIds.length){
    reasons.push('DIRECTOR_QUALITY_5_PRESERVATION_EVIDENCE_REQUIRED');
  }

  return Object.freeze({
    admissible:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    repairDurationSeconds:planDecision.repairDurationSeconds,
    authority:'DIRECTOR_QUALITY_5_LOCALIZED_REPAIR_QC',
  });
}
