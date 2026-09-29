import type {SupabaseClient} from '@supabase/supabase-js';
import {
  evaluateDirectorLiveTake,
  evaluateDirectorQuality5Repair,
  type DirectorLiveTakeReviewInput,
  type DirectorQuality5RepairInput,
} from '@jhadina/director-core/live-quality-gates';

export async function recordDirectorLiveTakeQc(
  client:SupabaseClient,
  input:{id:string;review:DirectorLiveTakeReviewInput},
){
  const decision=evaluateDirectorLiveTake(input.review);
  if(input.review.purpose==='quality4-canary'&&!decision.admissible){
    throw new Error(`DIRECTOR_QUALITY_4_QC_FAILED:${decision.reasons.join(',')}`);
  }
  if(input.review.purpose==='quality5-stress'&&!decision.expectedFailureObserved){
    throw new Error(`DIRECTOR_QUALITY_5_REAL_FAILURE_REQUIRED:${decision.reasons.join(',')}`);
  }

  const {artifact,performance}=input.review;
  const {data,error}=await client.from('director_live_take_qc_receipts').insert({
    id:input.id,
    project_id:input.review.projectId,
    character_id:input.review.characterId,
    purpose:input.review.purpose,
    reference_asset_id:artifact.referenceAssetId,
    reference_sha256:artifact.referenceSha256.toLowerCase(),
    audio_asset_id:performance.audioAssetId,
    voice_identity_id:performance.voiceIdentityId,
    speaker_fingerprint_receipt_id:performance.speakerFingerprintReceiptId,
    speaker_fingerprint_ref:performance.speakerFingerprintRef,
    provider_id:artifact.providerId,
    model_id:artifact.modelId,
    model_version:artifact.modelVersion,
    provider_job_id:artifact.providerJobId,
    provider_runtime_receipt_id:artifact.providerRuntimeReceiptId,
    seed:artifact.seed,
    output_asset_id:artifact.outputAssetId,
    output_sha256:artifact.outputSha256.toLowerCase(),
    content_type:artifact.contentType,
    measured_duration_seconds:artifact.measuredDurationSeconds,
    storage_verified:artifact.storageVerified,
    production_provider:artifact.productionProvider,
    performance_evidence:performance,
    observations:input.review.observations,
    qc_policy_id:decision.qcPolicyId,
    qc_admissible:decision.admissible,
    expected_failure_observed:decision.expectedFailureObserved,
    qc_reasons:[...decision.reasons],
    evidence_ids:[...input.review.evidenceIds],
  }).select('*').single();
  if(error) throw new Error(`DIRECTOR_LIVE_TAKE_RECEIPT_WRITE_FAILED:${error.message}`);
  return data;
}

export async function recordDirectorQuality5Repair(
  client:SupabaseClient,
  input:{id:string;repair:DirectorQuality5RepairInput},
){
  const decision=evaluateDirectorQuality5Repair(input.repair);
  if(!decision.admissible){
    throw new Error(`DIRECTOR_QUALITY_5_REPAIR_QC_FAILED:${decision.reasons.join(',')}`);
  }
  const repaired=input.repair.repairedArtifact;
  const {data,error}=await client.from('director_quality5_localized_repair_receipts').insert({
    id:input.id,
    project_id:input.repair.projectId,
    character_id:input.repair.characterId,
    failure_take_receipt_id:input.repair.failureTakeReceiptId,
    source_asset_id:input.repair.failureAssetId,
    source_sha256:input.repair.failureAssetSha256.toLowerCase(),
    repaired_asset_id:repaired.assetId,
    repaired_sha256:repaired.sha256.toLowerCase(),
    provider_id:repaired.providerId,
    model_id:repaired.modelId,
    model_version:repaired.modelVersion,
    provider_job_id:repaired.providerJobId,
    provider_runtime_receipt_id:repaired.providerRuntimeReceiptId,
    repair_plan:input.repair.plan,
    post_repair_observations:input.repair.postRepairObservations,
    preservation_evidence:input.repair.preservation,
    repair_duration_seconds:decision.repairDurationSeconds,
    qc_admissible:true,
    qc_reasons:[],
    evidence_ids:[...input.repair.evidenceIds],
  }).select('*').single();
  if(error) throw new Error(`DIRECTOR_QUALITY_5_REPAIR_RECEIPT_WRITE_FAILED:${error.message}`);
  return data;
}
