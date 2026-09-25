export type PerformancePoseControl = 'eyes' | 'eyebrows';
export type PerformanceRecordingPass = 'eyes' | 'eyebrows' | 'hands' | 'body' | 'head' | 'face';

export interface PerformancePose {
  id: string;
  x?: number;
  y?: number;
  rotationDegrees?: number;
  scale?: number;
}

export interface PerformancePoseSet {
  id: string;
  control: PerformancePoseControl;
  defaultPoseId: string;
  poses: readonly PerformancePose[];
  blendInFrames: number;
  blendOutFrames: number;
  latchNonDefault: boolean;
}

export interface JawFollowPlan {
  enabled: boolean;
  amount: number;
  fixedAnchorId?: string;
  jawAnchorId?: string;
}

export interface HeadBodyDecouplingPlan {
  enabled: boolean;
  bodyPositionStrength: number;
  bodyTiltStrength: number;
  headPositionStrength: number;
  headTiltStrength: number;
}

export interface PerformanceRecordingPolicy {
  passOrder: readonly PerformanceRecordingPass[];
  defaultsOnlyForActivePass: boolean;
  hideCompletedPasses: boolean;
}

export interface CharacterPerformanceRigPlan {
  id: string;
  characterAssetId: string;
  eyePoses?: PerformancePoseSet;
  eyebrowPoses?: PerformancePoseSet;
  jawFollow?: JawFollowPlan;
  headBody?: HeadBodyDecouplingPlan;
  recording?: PerformanceRecordingPolicy;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_CHARACTER_PERFORMANCE_RIG';
}

export interface CharacterPerformanceRigDecision {
  valid: boolean;
  reasons: readonly string[];
}

export function validateCharacterPerformanceRigPlan(
  plan: CharacterPerformanceRigPlan,
): CharacterPerformanceRigDecision {
  const reasons: string[] = [];
  if (!plan.id.trim() || !plan.characterAssetId.trim()) {
    reasons.push('DIRECTOR_PERFORMANCE_RIG_IDENTITY_REQUIRED');
  }
  if (!plan.evidenceIds.length) reasons.push('DIRECTOR_PERFORMANCE_RIG_EVIDENCE_REQUIRED');

  if (plan.eyePoses) validatePoseSet(plan.eyePoses, 'eyes', reasons);
  if (plan.eyebrowPoses) validatePoseSet(plan.eyebrowPoses, 'eyebrows', reasons);

  if (plan.jawFollow) {
    const jaw = plan.jawFollow;
    if (!Number.isFinite(jaw.amount) || jaw.amount < 0 || jaw.amount > 1) {
      reasons.push('DIRECTOR_PERFORMANCE_RIG_JAW_AMOUNT_INVALID');
    }
    if (jaw.enabled && (!jaw.fixedAnchorId?.trim() || !jaw.jawAnchorId?.trim())) {
      reasons.push('DIRECTOR_PERFORMANCE_RIG_JAW_ANCHORS_REQUIRED');
    }
  }

  if (plan.headBody) {
    const headBody = plan.headBody;
    for (const [name, value] of Object.entries({
      bodyPositionStrength: headBody.bodyPositionStrength,
      bodyTiltStrength: headBody.bodyTiltStrength,
      headPositionStrength: headBody.headPositionStrength,
      headTiltStrength: headBody.headTiltStrength,
    })) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        reasons.push(`DIRECTOR_PERFORMANCE_RIG_STRENGTH_INVALID:${name}`);
      }
    }
  }

  if (plan.recording) {
    const ids = new Set<PerformanceRecordingPass>();
    if (!plan.recording.passOrder.length) reasons.push('DIRECTOR_PERFORMANCE_RIG_RECORDING_PASSES_REQUIRED');
    for (const pass of plan.recording.passOrder) {
      if (ids.has(pass)) reasons.push(`DIRECTOR_PERFORMANCE_RIG_RECORDING_PASS_DUPLICATE:${pass}`);
      ids.add(pass);
    }
  }

  if (!plan.eyePoses && !plan.eyebrowPoses && !plan.jawFollow && !plan.headBody && !plan.recording) {
    reasons.push('DIRECTOR_PERFORMANCE_RIG_CONTROLS_REQUIRED');
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export function performanceRigEvidence(plan: CharacterPerformanceRigPlan): readonly string[] {
  const decision = validateCharacterPerformanceRigPlan(plan);
  if (!decision.valid) {
    throw new Error(`DIRECTOR_PERFORMANCE_RIG_INVALID: ${decision.reasons.join(', ')}`);
  }
  return Object.freeze([
    `performance-rig:${plan.id}`,
    ...(plan.eyePoses ? [`performance-rig-eyes:${plan.eyePoses.poses.length}`] : []),
    ...(plan.eyebrowPoses ? [`performance-rig-eyebrows:${plan.eyebrowPoses.poses.length}`] : []),
    ...(plan.jawFollow?.enabled ? [`performance-rig-jaw:${plan.jawFollow.amount}`] : []),
    ...(plan.headBody?.enabled ? ['performance-rig-head-body:decoupled'] : []),
    ...(plan.recording ? [`performance-rig-recording:${plan.recording.passOrder.join(',')}`] : []),
    ...plan.evidenceIds,
  ]);
}

function validatePoseSet(
  set: PerformancePoseSet,
  expectedControl: PerformancePoseControl,
  reasons: string[],
): void {
  if (!set.id.trim() || set.control !== expectedControl || !set.poses.length) {
    reasons.push(`DIRECTOR_PERFORMANCE_RIG_POSE_SET_INVALID:${expectedControl}`);
    return;
  }
  if (!Number.isInteger(set.blendInFrames) || set.blendInFrames < 0) {
    reasons.push(`DIRECTOR_PERFORMANCE_RIG_BLEND_IN_INVALID:${set.id}`);
  }
  if (!Number.isInteger(set.blendOutFrames) || set.blendOutFrames < 0) {
    reasons.push(`DIRECTOR_PERFORMANCE_RIG_BLEND_OUT_INVALID:${set.id}`);
  }

  const ids = new Set<string>();
  for (const pose of set.poses) {
    if (!pose.id.trim() || ids.has(pose.id)) reasons.push(`DIRECTOR_PERFORMANCE_RIG_POSE_ID_INVALID:${pose.id || 'unknown'}`);
    ids.add(pose.id);
    if (pose.x !== undefined && (!Number.isFinite(pose.x) || pose.x < -1 || pose.x > 1)) {
      reasons.push(`DIRECTOR_PERFORMANCE_RIG_POSE_X_INVALID:${pose.id}`);
    }
    if (pose.y !== undefined && (!Number.isFinite(pose.y) || pose.y < -1 || pose.y > 1)) {
      reasons.push(`DIRECTOR_PERFORMANCE_RIG_POSE_Y_INVALID:${pose.id}`);
    }
    if (
      pose.rotationDegrees !== undefined &&
      (!Number.isFinite(pose.rotationDegrees) || pose.rotationDegrees < -180 || pose.rotationDegrees > 180)
    ) reasons.push(`DIRECTOR_PERFORMANCE_RIG_POSE_ROTATION_INVALID:${pose.id}`);
    if (pose.scale !== undefined && (!Number.isFinite(pose.scale) || pose.scale <= 0 || pose.scale > 4)) {
      reasons.push(`DIRECTOR_PERFORMANCE_RIG_POSE_SCALE_INVALID:${pose.id}`);
    }
  }
  if (!ids.has(set.defaultPoseId)) reasons.push(`DIRECTOR_PERFORMANCE_RIG_DEFAULT_POSE_MISSING:${set.id}`);
}
