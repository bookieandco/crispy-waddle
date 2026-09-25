export type MusicLipSyncTransportMedia='audio'|'video';

export interface MusicLipSyncProviderPolicy {
  id:string;
  providerId:string;
  modelId:string;
  modelVersion:string;
  recommendedMinSeconds?:number;
  recommendedMaxSeconds?:number;
  hardMaxSeconds?:number;
  requiresVocalStemOnly:boolean;
  requiredTransportMedia?:MusicLipSyncTransportMedia;
  requiresExactDurationMatch:boolean;
  evidenceIds:readonly string[];
  authority:'PROVIDER_MUSIC_LIP_SYNC_POLICY';
}

export interface MusicLipSyncSegmentPlan {
  id:string;
  projectId:string;
  characterId:string;
  voiceIdentityId?:string;
  sourceSongAssetId:string;
  vocalStemAssetId:string;
  transportAssetId:string;
  transportMedia:MusicLipSyncTransportMedia;
  sourceStartSeconds:number;
  sourceEndSeconds:number;
  targetVideoDurationSeconds:number;
  referenceAssetIds:readonly string[];
  vocalStemOnly:boolean;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_MUSIC_LIP_SYNC_SEGMENT';
}

export interface MusicLipSyncSegmentDecision {
  valid:boolean;
  warnings:readonly string[];
  reasons:readonly string[];
  segmentDurationSeconds:number;
  authority:'DIRECTOR_MUSIC_LIP_SYNC_QC';
}

export function validateMusicLipSyncSegment(
  plan:MusicLipSyncSegmentPlan,
  policy:MusicLipSyncProviderPolicy,
):MusicLipSyncSegmentDecision{
  const reasons:string[]=[];
  const warnings:string[]=[];
  if(
    !plan.id.trim()||
    !plan.projectId.trim()||
    !plan.characterId.trim()||
    !plan.sourceSongAssetId.trim()||
    !plan.vocalStemAssetId.trim()||
    !plan.transportAssetId.trim()
  ) reasons.push('DIRECTOR_MUSIC_LIP_SYNC_IDENTITY_REQUIRED');
  if(!plan.evidenceIds.length||!policy.evidenceIds.length){
    reasons.push('DIRECTOR_MUSIC_LIP_SYNC_EVIDENCE_REQUIRED');
  }
  if(
    !Number.isFinite(plan.sourceStartSeconds)||
    !Number.isFinite(plan.sourceEndSeconds)||
    plan.sourceStartSeconds<0||
    plan.sourceEndSeconds<=plan.sourceStartSeconds
  ) reasons.push('DIRECTOR_MUSIC_LIP_SYNC_SOURCE_RANGE_INVALID');

  const duration=Math.max(0,plan.sourceEndSeconds-plan.sourceStartSeconds);
  if(!Number.isFinite(plan.targetVideoDurationSeconds)||plan.targetVideoDurationSeconds<=0){
    reasons.push('DIRECTOR_MUSIC_LIP_SYNC_TARGET_DURATION_INVALID');
  }
  if(policy.requiresExactDurationMatch&&Math.abs(duration-plan.targetVideoDurationSeconds)>.001){
    reasons.push('DIRECTOR_MUSIC_LIP_SYNC_DURATION_MISMATCH');
  }
  if(policy.hardMaxSeconds!==undefined&&duration>policy.hardMaxSeconds){
    reasons.push('DIRECTOR_MUSIC_LIP_SYNC_DURATION_EXCEEDS_MODEL_MAX');
  }
  if(policy.recommendedMinSeconds!==undefined&&duration<policy.recommendedMinSeconds){
    warnings.push('DIRECTOR_MUSIC_LIP_SYNC_BELOW_RECOMMENDED_DURATION');
  }
  if(policy.recommendedMaxSeconds!==undefined&&duration>policy.recommendedMaxSeconds){
    warnings.push('DIRECTOR_MUSIC_LIP_SYNC_ABOVE_RECOMMENDED_DURATION');
  }
  if(policy.requiresVocalStemOnly&&!plan.vocalStemOnly){
    reasons.push('DIRECTOR_MUSIC_LIP_SYNC_VOCAL_STEM_REQUIRED');
  }
  if(policy.requiredTransportMedia&&plan.transportMedia!==policy.requiredTransportMedia){
    reasons.push('DIRECTOR_MUSIC_LIP_SYNC_TRANSPORT_MEDIA_MISMATCH');
  }
  if(!plan.referenceAssetIds.length){
    warnings.push('DIRECTOR_MUSIC_LIP_SYNC_NO_VISUAL_REFERENCE');
  }

  return Object.freeze({
    valid:reasons.length===0,
    warnings:Object.freeze([...new Set(warnings)]),
    reasons:Object.freeze([...new Set(reasons)]),
    segmentDurationSeconds:duration,
    authority:'DIRECTOR_MUSIC_LIP_SYNC_QC',
  });
}

/**
 * Source-demonstrated Seedance music lip-sync envelope.
 * The 4-10s range is treated as a recommendation from the supplied workflow,
 * while 15s is the demonstrated model-generation ceiling. Neither is promoted
 * to a universal Director rule.
 */
export const SOURCE_SEEDANCE_MUSIC_LIP_SYNC_POLICY:MusicLipSyncProviderPolicy=Object.freeze({
  id:'source:seedance-music-lip-sync',
  providerId:'seedance',
  modelId:'seedance-video',
  modelVersion:'source-demonstrated',
  recommendedMinSeconds:4,
  recommendedMaxSeconds:10,
  hardMaxSeconds:15,
  requiresVocalStemOnly:true,
  requiredTransportMedia:'video',
  requiresExactDurationMatch:true,
  evidenceIds:Object.freeze(['source:ai-cinematic-story-workflow']),
  authority:'PROVIDER_MUSIC_LIP_SYNC_POLICY',
});
