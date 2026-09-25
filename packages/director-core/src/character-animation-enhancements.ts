export interface LipSyncTuningPlan {
  id: string;
  projectId: string;
  visemeDensity: number;
  audioGateDb?: number;
  visualMouthGateStrength?: number;
  algorithmProfile?: string;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_LIP_SYNC_TUNING';
}

export interface MotionLineEmitter {
  id: string;
  attachment: string;
  velocityThreshold: number;
  lifespanFrames: number;
  fade: boolean;
  opacity?: number;
}

export interface ParticleTrailEmitter {
  id: string;
  attachment: string;
  velocityThreshold: number;
  lifespanFrames: number;
  gravityScale: number;
  particleAssetId: string;
  followPointer?: boolean;
}

export interface CharacterMotionEffectsPlan {
  id: string;
  projectId: string;
  characterAssetId: string;
  motionLines: readonly MotionLineEmitter[];
  particleTrails: readonly ParticleTrailEmitter[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_CHARACTER_MOTION_EFFECTS';
}

export interface LocomotionKeyframe {
  id: string;
  timeSeconds: number;
  positionX: number;
  positionY: number;
  interpolation?: 'linear' | 'smooth' | 'hold' | 'ease-in' | 'ease-out';
}

export interface CharacterLocomotionPlan {
  id: string;
  projectId: string;
  characterAssetId: string;
  gait: 'walk' | 'run' | 'custom';
  fps: number;
  keyframes: readonly LocomotionKeyframe[];
  preserveFootPlant: boolean;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_CHARACTER_LOCOMOTION';
}

export function validateLipSyncTuningPlan(plan: LipSyncTuningPlan): readonly string[] {
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()) reasons.push('DIRECTOR_LIP_SYNC_TUNING_IDENTITY_REQUIRED');
  if(!Number.isFinite(plan.visemeDensity)||plan.visemeDensity<0||plan.visemeDensity>1) {
    reasons.push('DIRECTOR_LIP_SYNC_VISEME_DENSITY_INVALID');
  }
  if(plan.audioGateDb!==undefined&&(!Number.isFinite(plan.audioGateDb)||plan.audioGateDb>0||plan.audioGateDb<-120)) {
    reasons.push('DIRECTOR_LIP_SYNC_AUDIO_GATE_INVALID');
  }
  if(
    plan.visualMouthGateStrength!==undefined&&
    (!Number.isFinite(plan.visualMouthGateStrength)||plan.visualMouthGateStrength<0||plan.visualMouthGateStrength>1)
  ) reasons.push('DIRECTOR_LIP_SYNC_VISUAL_GATE_INVALID');
  if(plan.algorithmProfile!==undefined&&!plan.algorithmProfile.trim()) reasons.push('DIRECTOR_LIP_SYNC_ALGORITHM_PROFILE_INVALID');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_LIP_SYNC_TUNING_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function validateCharacterMotionEffectsPlan(plan: CharacterMotionEffectsPlan): readonly string[] {
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.characterAssetId.trim()) {
    reasons.push('DIRECTOR_MOTION_EFFECTS_IDENTITY_REQUIRED');
  }
  if(!plan.motionLines.length&&!plan.particleTrails.length) reasons.push('DIRECTOR_MOTION_EFFECTS_EMITTER_REQUIRED');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_MOTION_EFFECTS_EVIDENCE_REQUIRED');

  const ids=new Set<string>();
  for(const emitter of [...plan.motionLines,...plan.particleTrails]){
    if(!emitter.id.trim()||ids.has(emitter.id)) reasons.push(`DIRECTOR_MOTION_EFFECTS_EMITTER_ID_INVALID:${emitter.id||'unknown'}`);
    ids.add(emitter.id);
    if(!emitter.attachment.trim()) reasons.push(`DIRECTOR_MOTION_EFFECTS_ATTACHMENT_REQUIRED:${emitter.id}`);
    if(!Number.isFinite(emitter.velocityThreshold)||emitter.velocityThreshold<0) {
      reasons.push(`DIRECTOR_MOTION_EFFECTS_VELOCITY_INVALID:${emitter.id}`);
    }
    if(!Number.isInteger(emitter.lifespanFrames)||emitter.lifespanFrames<1) {
      reasons.push(`DIRECTOR_MOTION_EFFECTS_LIFESPAN_INVALID:${emitter.id}`);
    }
  }
  for(const line of plan.motionLines){
    if(line.opacity!==undefined&&(!Number.isFinite(line.opacity)||line.opacity<0||line.opacity>1)) {
      reasons.push(`DIRECTOR_MOTION_EFFECTS_OPACITY_INVALID:${line.id}`);
    }
  }
  for(const particle of plan.particleTrails){
    if(!Number.isFinite(particle.gravityScale)||particle.gravityScale<-10||particle.gravityScale>10) {
      reasons.push(`DIRECTOR_MOTION_EFFECTS_GRAVITY_INVALID:${particle.id}`);
    }
    if(!particle.particleAssetId.trim()) reasons.push(`DIRECTOR_MOTION_EFFECTS_PARTICLE_ASSET_REQUIRED:${particle.id}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function validateCharacterLocomotionPlan(plan: CharacterLocomotionPlan): readonly string[] {
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()||!plan.characterAssetId.trim()) {
    reasons.push('DIRECTOR_LOCOMOTION_IDENTITY_REQUIRED');
  }
  if(!Number.isFinite(plan.fps)||plan.fps<=0) reasons.push('DIRECTOR_LOCOMOTION_FPS_INVALID');
  if(plan.keyframes.length<2) reasons.push('DIRECTOR_LOCOMOTION_KEYFRAMES_REQUIRED');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_LOCOMOTION_EVIDENCE_REQUIRED');

  const ids=new Set<string>();
  let previous=-1;
  for(const keyframe of plan.keyframes){
    if(!keyframe.id.trim()||ids.has(keyframe.id)) reasons.push(`DIRECTOR_LOCOMOTION_KEYFRAME_ID_INVALID:${keyframe.id||'unknown'}`);
    ids.add(keyframe.id);
    if(!Number.isFinite(keyframe.timeSeconds)||keyframe.timeSeconds<0) {
      reasons.push(`DIRECTOR_LOCOMOTION_KEYFRAME_TIME_INVALID:${keyframe.id}`);
    }
    if(keyframe.timeSeconds<previous) reasons.push('DIRECTOR_LOCOMOTION_KEYFRAMES_UNSORTED');
    previous=keyframe.timeSeconds;
    if(!Number.isFinite(keyframe.positionX)||!Number.isFinite(keyframe.positionY)) {
      reasons.push(`DIRECTOR_LOCOMOTION_POSITION_INVALID:${keyframe.id}`);
    }
  }
  return Object.freeze([...new Set(reasons)]);
}

export function lipSyncTuningEvidence(plan:LipSyncTuningPlan):readonly string[]{
  const reasons=validateLipSyncTuningPlan(plan);
  if(reasons.length) throw new Error(`DIRECTOR_LIP_SYNC_TUNING_INVALID: ${reasons.join(', ')}`);
  return Object.freeze([
    `lip-sync-tuning:${plan.id}`,
    `lip-sync-viseme-density:${plan.visemeDensity}`,
    ...(plan.audioGateDb!==undefined?[`lip-sync-audio-gate-db:${plan.audioGateDb}`]:[]),
    ...(plan.visualMouthGateStrength!==undefined?[`lip-sync-visual-gate:${plan.visualMouthGateStrength}`]:[]),
    ...(plan.algorithmProfile?[`lip-sync-algorithm-profile:${plan.algorithmProfile}`]:[]),
    ...plan.evidenceIds,
  ]);
}

export function characterAnimationEnhancementEvidence(input:{
  motionEffectsPlan?:CharacterMotionEffectsPlan;
  locomotionPlan?:CharacterLocomotionPlan;
}):readonly string[]{
  const evidence:string[]=[];
  if(input.motionEffectsPlan){
    const reasons=validateCharacterMotionEffectsPlan(input.motionEffectsPlan);
    if(reasons.length) throw new Error(`DIRECTOR_MOTION_EFFECTS_INVALID: ${reasons.join(', ')}`);
    evidence.push(
      `motion-effects:${input.motionEffectsPlan.id}`,
      `motion-lines:${input.motionEffectsPlan.motionLines.length}`,
      `particle-trails:${input.motionEffectsPlan.particleTrails.length}`,
      ...input.motionEffectsPlan.evidenceIds,
    );
  }
  if(input.locomotionPlan){
    const reasons=validateCharacterLocomotionPlan(input.locomotionPlan);
    if(reasons.length) throw new Error(`DIRECTOR_LOCOMOTION_INVALID: ${reasons.join(', ')}`);
    evidence.push(
      `locomotion:${input.locomotionPlan.id}`,
      `locomotion-gait:${input.locomotionPlan.gait}`,
      `locomotion-keyframes:${input.locomotionPlan.keyframes.length}`,
      `locomotion-foot-plant:${input.locomotionPlan.preserveFootPlant}`,
      ...input.locomotionPlan.evidenceIds,
    );
  }
  return Object.freeze(evidence);
}
