import type { RigChannel } from './studio-rig-animation.js';

export type LipSyncRepairStrategy = 'transcript-assisted' | 'audio-only';

export interface LipSyncRepairSegment {
  id: string;
  startMs: number;
  endMs: number;
  strategy: LipSyncRepairStrategy;
  reason: string;
  evidenceIds: readonly string[];
}

export interface LipSyncRepairPlan {
  id: string;
  projectId: string;
  audioAssetId: string;
  audioDurationMs: number;
  segments: readonly LipSyncRepairSegment[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_LIP_SYNC_REPAIR';
}

export type ShotRigFeature =
  | 'blinks'
  | 'dangle'
  | 'eyebrow-poses'
  | 'arm-ik'
  | 'head-turns'
  | 'automated-lights';

export interface ShotRigScopePlan {
  id: string;
  projectId: string;
  characterAssetId: string;
  shotIds: readonly string[];
  requiredChannels: readonly RigChannel[];
  mouthMode: 'none' | 'jaw-only' | 'full-viseme';
  features: readonly ShotRigFeature[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_SHOT_RIG_SCOPE';
}

export interface SpriteSequencePlan {
  id: string;
  projectId: string;
  targetAssetId: string;
  mode: 'triggered' | 'loop';
  frameAssetIds: readonly string[];
  framesPerStep: number;
  startFrame?: number;
  trigger?: string;
  blendMode?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_SPRITE_SEQUENCE';
}

export interface PreRenderCachePlan {
  id: string;
  projectId: string;
  sourceVersionId: string;
  fps: number;
  frameStart: number;
  frameEnd: number;
  width: number;
  height: number;
  imageFormat: 'png' | 'exr';
  transparent: boolean;
  includeAudio: boolean;
  audioFormat?: 'wav';
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_PRE_RENDER_CACHE';
}

export interface MasterSceneScalePlan {
  id: string;
  projectId: string;
  workingWidth: number;
  workingHeight: number;
  deliveryWidth: number;
  deliveryHeight: number;
  maximumRasterScale: number;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_MASTER_SCENE_SCALE';
}

export function validateLipSyncRepairPlan(plan:LipSyncRepairPlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.audioAssetId.trim()) {
    reasons.push('DIRECTOR_LIP_SYNC_REPAIR_IDENTITY_REQUIRED');
  }
  if(!Number.isFinite(plan.audioDurationMs)||plan.audioDurationMs<=0) {
    reasons.push('DIRECTOR_LIP_SYNC_REPAIR_AUDIO_DURATION_INVALID');
  }
  if(!plan.segments.length) reasons.push('DIRECTOR_LIP_SYNC_REPAIR_SEGMENTS_REQUIRED');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_LIP_SYNC_REPAIR_EVIDENCE_REQUIRED');
  const ids=new Set<string>();
  let previousEnd=-1;
  for(const segment of plan.segments){
    if(!segment.id.trim()||ids.has(segment.id)) reasons.push(`DIRECTOR_LIP_SYNC_REPAIR_SEGMENT_ID_INVALID:${segment.id||'unknown'}`);
    ids.add(segment.id);
    if(
      !Number.isInteger(segment.startMs)||!Number.isInteger(segment.endMs)||
      segment.startMs<0||segment.endMs<=segment.startMs
    ) reasons.push(`DIRECTOR_LIP_SYNC_REPAIR_SEGMENT_RANGE_INVALID:${segment.id}`);
    if(segment.startMs<previousEnd) reasons.push(`DIRECTOR_LIP_SYNC_REPAIR_SEGMENT_OVERLAP:${segment.id}`);
    if(segment.endMs>plan.audioDurationMs) reasons.push(`DIRECTOR_LIP_SYNC_REPAIR_SEGMENT_OUTSIDE_AUDIO:${segment.id}`);
    if(!segment.reason.trim()||!segment.evidenceIds.length) {
      reasons.push(`DIRECTOR_LIP_SYNC_REPAIR_SEGMENT_EVIDENCE_REQUIRED:${segment.id}`);
    }
    previousEnd=Math.max(previousEnd,segment.endMs);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function validateShotRigScopePlan(plan:ShotRigScopePlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.characterAssetId.trim()) {
    reasons.push('DIRECTOR_SHOT_RIG_SCOPE_IDENTITY_REQUIRED');
  }
  if(!plan.shotIds.length||plan.shotIds.some(id=>!id.trim())) reasons.push('DIRECTOR_SHOT_RIG_SCOPE_SHOTS_REQUIRED');
  if(!plan.requiredChannels.length&&plan.mouthMode==='none'&&!plan.features.length) {
    reasons.push('DIRECTOR_SHOT_RIG_SCOPE_EMPTY');
  }
  if(new Set(plan.requiredChannels).size!==plan.requiredChannels.length) reasons.push('DIRECTOR_SHOT_RIG_SCOPE_CHANNEL_DUPLICATE');
  if(new Set(plan.features).size!==plan.features.length) reasons.push('DIRECTOR_SHOT_RIG_SCOPE_FEATURE_DUPLICATE');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_SHOT_RIG_SCOPE_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function validateSpriteSequencePlan(plan:SpriteSequencePlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.targetAssetId.trim()) {
    reasons.push('DIRECTOR_SPRITE_SEQUENCE_IDENTITY_REQUIRED');
  }
  if(plan.frameAssetIds.length<2||plan.frameAssetIds.some(id=>!id.trim())) {
    reasons.push('DIRECTOR_SPRITE_SEQUENCE_FRAMES_REQUIRED');
  }
  if(new Set(plan.frameAssetIds).size!==plan.frameAssetIds.length) reasons.push('DIRECTOR_SPRITE_SEQUENCE_FRAME_DUPLICATE');
  if(!Number.isInteger(plan.framesPerStep)||plan.framesPerStep<1) reasons.push('DIRECTOR_SPRITE_SEQUENCE_STEP_INVALID');
  if(plan.startFrame!==undefined&&(!Number.isInteger(plan.startFrame)||plan.startFrame<0)) {
    reasons.push('DIRECTOR_SPRITE_SEQUENCE_START_INVALID');
  }
  if(plan.mode==='triggered'&&!plan.trigger?.trim()) reasons.push('DIRECTOR_SPRITE_SEQUENCE_TRIGGER_REQUIRED');
  if(plan.mode==='loop'&&plan.trigger?.trim()) reasons.push('DIRECTOR_SPRITE_SEQUENCE_LOOP_TRIGGER_FORBIDDEN');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_SPRITE_SEQUENCE_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function validatePreRenderCachePlan(plan:PreRenderCachePlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.sourceVersionId.trim()) {
    reasons.push('DIRECTOR_PRE_RENDER_CACHE_IDENTITY_REQUIRED');
  }
  if(!Number.isFinite(plan.fps)||plan.fps<=0) reasons.push('DIRECTOR_PRE_RENDER_CACHE_FPS_INVALID');
  if(!Number.isInteger(plan.frameStart)||!Number.isInteger(plan.frameEnd)||plan.frameStart<0||plan.frameEnd<plan.frameStart) {
    reasons.push('DIRECTOR_PRE_RENDER_CACHE_RANGE_INVALID');
  }
  if(!Number.isInteger(plan.width)||!Number.isInteger(plan.height)||plan.width<=0||plan.height<=0) {
    reasons.push('DIRECTOR_PRE_RENDER_CACHE_DIMENSIONS_INVALID');
  }
  if(plan.includeAudio&&plan.audioFormat!=='wav') reasons.push('DIRECTOR_PRE_RENDER_CACHE_AUDIO_FORMAT_INVALID');
  if(!plan.includeAudio&&plan.audioFormat!==undefined) reasons.push('DIRECTOR_PRE_RENDER_CACHE_AUDIO_WITHOUT_AUDIO');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_PRE_RENDER_CACHE_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function validateMasterSceneScalePlan(plan:MasterSceneScalePlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()) reasons.push('DIRECTOR_MASTER_SCENE_IDENTITY_REQUIRED');
  for(const [name,value] of Object.entries({
    workingWidth:plan.workingWidth,
    workingHeight:plan.workingHeight,
    deliveryWidth:plan.deliveryWidth,
    deliveryHeight:plan.deliveryHeight,
  })){
    if(!Number.isInteger(value)||value<=0) reasons.push(`DIRECTOR_MASTER_SCENE_DIMENSION_INVALID:${name}`);
  }
  if(plan.workingWidth<plan.deliveryWidth||plan.workingHeight<plan.deliveryHeight) {
    reasons.push('DIRECTOR_MASTER_SCENE_WORKING_CANVAS_TOO_SMALL');
  }
  if(!Number.isFinite(plan.maximumRasterScale)||plan.maximumRasterScale<=0||plan.maximumRasterScale>1) {
    reasons.push('DIRECTOR_MASTER_SCENE_RASTER_UPSCALE_RISK');
  }
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_MASTER_SCENE_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function cartoonProductionEvidence(input:{
  repairPlan?:LipSyncRepairPlan;
  rigScopePlan?:ShotRigScopePlan;
  spriteSequences?:readonly SpriteSequencePlan[];
  cachePlan?:PreRenderCachePlan;
  scalePlan?:MasterSceneScalePlan;
}):readonly string[]{
  const evidence:string[]=[];
  if(input.repairPlan){
    const reasons=validateLipSyncRepairPlan(input.repairPlan);
    if(reasons.length) throw new Error(`DIRECTOR_LIP_SYNC_REPAIR_INVALID: ${reasons.join(', ')}`);
    evidence.push(
      `lip-sync-repair:${input.repairPlan.id}`,
      ...input.repairPlan.segments.map(segment=>`lip-sync-repair-segment:${segment.id}:${segment.strategy}:${segment.startMs}-${segment.endMs}`),
      ...input.repairPlan.evidenceIds,
      ...input.repairPlan.segments.flatMap(segment=>segment.evidenceIds),
    );
  }
  if(input.rigScopePlan){
    const reasons=validateShotRigScopePlan(input.rigScopePlan);
    if(reasons.length) throw new Error(`DIRECTOR_SHOT_RIG_SCOPE_INVALID: ${reasons.join(', ')}`);
    evidence.push(
      `shot-rig-scope:${input.rigScopePlan.id}`,
      `shot-rig-mouth:${input.rigScopePlan.mouthMode}`,
      `shot-rig-channels:${input.rigScopePlan.requiredChannels.join(',')}`,
      ...input.rigScopePlan.evidenceIds,
    );
  }
  for(const sequence of input.spriteSequences??[]){
    const reasons=validateSpriteSequencePlan(sequence);
    if(reasons.length) throw new Error(`DIRECTOR_SPRITE_SEQUENCE_INVALID: ${reasons.join(', ')}`);
    evidence.push(
      `sprite-sequence:${sequence.id}:${sequence.mode}`,
      `sprite-sequence-step:${sequence.framesPerStep}`,
      ...sequence.evidenceIds,
    );
  }
  if(input.cachePlan){
    const reasons=validatePreRenderCachePlan(input.cachePlan);
    if(reasons.length) throw new Error(`DIRECTOR_PRE_RENDER_CACHE_INVALID: ${reasons.join(', ')}`);
    evidence.push(
      `pre-render-cache:${input.cachePlan.id}`,
      `pre-render-cache-fps:${input.cachePlan.fps}`,
      `pre-render-cache-format:${input.cachePlan.imageFormat}`,
      ...(input.cachePlan.includeAudio?[`pre-render-cache-audio:${input.cachePlan.audioFormat}`]:[]),
      ...input.cachePlan.evidenceIds,
    );
  }
  if(input.scalePlan){
    const reasons=validateMasterSceneScalePlan(input.scalePlan);
    if(reasons.length) throw new Error(`DIRECTOR_MASTER_SCENE_SCALE_INVALID: ${reasons.join(', ')}`);
    evidence.push(
      `master-scene-scale:${input.scalePlan.id}`,
      `master-scene-working:${input.scalePlan.workingWidth}x${input.scalePlan.workingHeight}`,
      `master-scene-delivery:${input.scalePlan.deliveryWidth}x${input.scalePlan.deliveryHeight}`,
      `master-scene-max-raster-scale:${input.scalePlan.maximumRasterScale}`,
      ...input.scalePlan.evidenceIds,
    );
  }
  return Object.freeze(evidence);
}
