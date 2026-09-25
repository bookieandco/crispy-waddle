export type PerformanceMasterKind = 'video' | 'skeletal-motion';
export type PerformanceChannel = 'body' | 'hands' | 'face' | 'gaze' | 'speech-timing';
export type PerformanceRetargetMode = 'motion-retarget' | 'performer-replacement';
export type PreservationSource = 'source' | 'target' | 'regenerate' | 'none';

export interface PerformanceMaster {
  id: string;
  projectId: string;
  sourceAssetId: string;
  kind: PerformanceMasterKind;
  fps: number;
  durationSeconds: number;
  channels: readonly PerformanceChannel[];
  evidenceIds: readonly string[];
  approved: boolean;
  authority: 'DIRECTOR_PERFORMANCE_MASTER';
}

export interface PerformancePreservationMatrix {
  motion: PreservationSource;
  timing: PreservationSource;
  camera: PreservationSource;
  lighting: PreservationSource;
  environment: PreservationSource;
  voice: PreservationSource;
  wardrobe: PreservationSource;
}

export interface PerformanceRetargetPlan {
  id: string;
  projectId: string;
  sourcePerformanceMasterId: string;
  targetCharacterAssetId: string;
  mode: PerformanceRetargetMode;
  preservation: PerformancePreservationMatrix;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_PERFORMANCE_RETARGET_PLAN';
}

export function validatePerformanceMaster(master: PerformanceMaster): readonly string[] {
  const reasons: string[] = [];
  if (!master.id.trim() || !master.projectId.trim() || !master.sourceAssetId.trim()) {
    reasons.push('DIRECTOR_PERFORMANCE_MASTER_IDENTITY_REQUIRED');
  }
  if (!Number.isFinite(master.fps) || master.fps <= 0) reasons.push('DIRECTOR_PERFORMANCE_MASTER_FPS_INVALID');
  if (!Number.isFinite(master.durationSeconds) || master.durationSeconds <= 0) reasons.push('DIRECTOR_PERFORMANCE_MASTER_DURATION_INVALID');
  if (!master.channels.length) reasons.push('DIRECTOR_PERFORMANCE_MASTER_CHANNELS_REQUIRED');
  if (new Set(master.channels).size !== master.channels.length) reasons.push('DIRECTOR_PERFORMANCE_MASTER_CHANNEL_DUPLICATE');
  if (!master.evidenceIds.length) reasons.push('DIRECTOR_PERFORMANCE_MASTER_EVIDENCE_REQUIRED');
  if (!master.approved) reasons.push('DIRECTOR_PERFORMANCE_MASTER_APPROVAL_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function validatePerformanceRetargetPlan(
  master: PerformanceMaster,
  plan: PerformanceRetargetPlan,
): readonly string[] {
  const reasons = [...validatePerformanceMaster(master)];
  if (!plan.id.trim() || !plan.projectId.trim() || !plan.targetCharacterAssetId.trim()) {
    reasons.push('DIRECTOR_PERFORMANCE_RETARGET_IDENTITY_REQUIRED');
  }
  if (plan.projectId !== master.projectId) reasons.push('DIRECTOR_PERFORMANCE_RETARGET_PROJECT_MISMATCH');
  if (plan.sourcePerformanceMasterId !== master.id) reasons.push('DIRECTOR_PERFORMANCE_RETARGET_SOURCE_MISMATCH');
  if (!plan.evidenceIds.length) reasons.push('DIRECTOR_PERFORMANCE_RETARGET_EVIDENCE_REQUIRED');
  if (plan.preservation.motion !== 'source') reasons.push('DIRECTOR_PERFORMANCE_RETARGET_SOURCE_MOTION_REQUIRED');
  if (plan.preservation.timing !== 'source') reasons.push('DIRECTOR_PERFORMANCE_RETARGET_SOURCE_TIMING_REQUIRED');
  if (plan.mode === 'performer-replacement' && plan.preservation.camera !== 'source') {
    reasons.push('DIRECTOR_PERFORMANCE_REPLACEMENT_SOURCE_CAMERA_REQUIRED');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function performanceMasterEvidence(
  master: PerformanceMaster,
  plan?: PerformanceRetargetPlan,
): readonly string[] {
  const reasons = plan ? validatePerformanceRetargetPlan(master, plan) : validatePerformanceMaster(master);
  if (reasons.length) throw new Error(`DIRECTOR_PERFORMANCE_MASTER_INVALID: ${reasons.join(', ')}`);
  return Object.freeze([
    `performance-master:${master.id}:${master.kind}`,
    `performance-master-channels:${master.channels.join(',')}`,
    ...master.evidenceIds,
    ...(plan
      ? [
          `performance-retarget:${plan.id}:${plan.mode}`,
          `performance-retarget-target:${plan.targetCharacterAssetId}`,
          ...plan.evidenceIds,
        ]
      : []),
  ]);
}
