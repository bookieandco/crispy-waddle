export type MocapCaptureMode = 'monocular' | 'multiview-single' | 'multiview-multi-person' | 'internet-video';
export type MocapChannel = 'body' | 'hands' | 'face';
export type RestPose = 't-pose' | 'a-pose' | 'custom';
export type MotionAxis = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';
export type MotionRotationOrder = 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX' | 'QUATERNION';
export type MotionCapture3dRoute = 'direct-blender' | 'normalize-then-blender' | 'learned-retarget-then-blender' | 'reject';

export interface MocapCaptureProfile {
  id: string;
  mode: MocapCaptureMode;
  sourceAssetIds: readonly string[];
  subjectIds: readonly string[];
  requiredChannels: readonly MocapChannel[];
  fullBodyVisible: boolean;
  feetVisible: boolean;
  calibrated: boolean;
  calibrationPose?: string;
  evidenceIds: readonly string[];
}

export interface MotionSkeletonProfile {
  id: string;
  topologyId: string;
  jointNames: readonly string[];
  parentByJoint: Readonly<Record<string, string | null>>;
  rootJoint: string;
  restPose: RestPose;
  forwardAxis: MotionAxis;
  upAxis: MotionAxis;
  rotationOrder: MotionRotationOrder;
  unitScaleMeters: number;
  fps: number;
  hasFingerJoints: boolean;
}

export interface LearnedRetargetProfile {
  id: string;
  runtimeRole: 'research-specialist' | 'production-admitted';
  allowedSourceTopologyIds: readonly string[];
  allowedTargetTopologyIds: readonly string[];
  requiredRestPose?: RestPose;
  evidenceIds: readonly string[];
}

export interface BlenderMotionCertificationPolicy {
  maxFootSlideCm: number;
  maxGroundPenetrationCm: number;
  maxRootDriftCm: number;
  maxJitterScore: number;
  requireContactPreservation: boolean;
  requireRoundTripExport: boolean;
}

export interface MotionCapture3dPlan {
  id: string;
  projectId: string;
  characterAssetId: string;
  capture: MocapCaptureProfile;
  sourceSkeleton: MotionSkeletonProfile;
  targetSkeleton: MotionSkeletonProfile;
  learnedRetarget?: LearnedRetargetProfile;
  certificationPolicy: BlenderMotionCertificationPolicy;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_MOTION_CAPTURE_3D_PLAN';
}

export interface MotionCapture3dDecision {
  admissible: boolean;
  route: MotionCapture3dRoute;
  blockers: readonly string[];
  notes: readonly string[];
  requiredSteps: readonly string[];
  blenderCertificationRequired: true;
  authority: 'DIRECTOR_MOTION_CAPTURE_3D_ROUTE';
}

export interface BlenderMotionCertification {
  planId: string;
  projectId: string;
  characterAssetId: string;
  blenderVersion: string;
  rigAssetId: string;
  animationAssetId: string;
  restPoseAligned: boolean;
  boneMapComplete: boolean;
  scaleNormalized: boolean;
  fpsNormalized: boolean;
  sideMappingCorrect: boolean;
  jointFlipCount: number;
  footSlideCm: number;
  groundPenetrationCm: number;
  rootDriftCm: number;
  jitterScore: number;
  contactPreserved: boolean;
  roundTripExported: boolean;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_BLENDER_MOTION_CERTIFICATION';
}

export interface BlenderMotionCertificationDecision {
  approved: boolean;
  reasons: readonly string[];
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_BLENDER_MOTION_CERTIFICATION_QC';
}

function validateSkeleton(profile: MotionSkeletonProfile, role: 'source' | 'target'): string[] {
  const reasons: string[] = [];
  if (!profile.id.trim() || !profile.topologyId.trim() || !profile.rootJoint.trim()) {
    reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_SKELETON_IDENTITY_REQUIRED`);
  }
  if (!profile.jointNames.length || new Set(profile.jointNames).size !== profile.jointNames.length) {
    reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_JOINTS_INVALID`);
  }
  const joints = new Set(profile.jointNames);
  if (!joints.has(profile.rootJoint) || profile.parentByJoint[profile.rootJoint] !== null) {
    reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_ROOT_INVALID`);
  }
  for (const joint of profile.jointNames) {
    if (!(joint in profile.parentByJoint)) reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_PARENT_MISSING:${joint}`);
    const parent = profile.parentByJoint[joint];
    if (parent !== null && parent !== undefined && !joints.has(parent)) {
      reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_PARENT_UNKNOWN:${joint}`);
    }
  }
  if (profile.forwardAxis === profile.upAxis) reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_AXES_INVALID`);
  if (!Number.isFinite(profile.unitScaleMeters) || profile.unitScaleMeters <= 0) reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_SCALE_INVALID`);
  if (!Number.isFinite(profile.fps) || profile.fps <= 0) reasons.push(`DIRECTOR_MOCAP_${role.toUpperCase()}_FPS_INVALID`);
  return reasons;
}

export function validateMotionCapture3dPlan(plan: MotionCapture3dPlan): readonly string[] {
  const reasons: string[] = [];
  if (!plan.id.trim() || !plan.projectId.trim() || !plan.characterAssetId.trim()) reasons.push('DIRECTOR_MOCAP_IDENTITY_REQUIRED');
  if (!plan.evidenceIds.length) reasons.push('DIRECTOR_MOCAP_EVIDENCE_REQUIRED');
  const capture = plan.capture;
  if (!capture.id.trim() || !capture.sourceAssetIds.length || !capture.subjectIds.length) reasons.push('DIRECTOR_MOCAP_CAPTURE_INPUT_REQUIRED');
  if (!capture.requiredChannels.length) reasons.push('DIRECTOR_MOCAP_CAPTURE_CHANNELS_REQUIRED');
  if (!capture.evidenceIds.length) reasons.push('DIRECTOR_MOCAP_CAPTURE_EVIDENCE_REQUIRED');
  if (capture.mode.startsWith('multiview') && capture.sourceAssetIds.length < 2) reasons.push('DIRECTOR_MOCAP_MULTIVIEW_SOURCES_REQUIRED');
  if (capture.mode.startsWith('multiview') && !capture.calibrated) reasons.push('DIRECTOR_MOCAP_MULTIVIEW_CALIBRATION_REQUIRED');
  if (capture.requiredChannels.includes('body') && !capture.fullBodyVisible) reasons.push('DIRECTOR_MOCAP_FULL_BODY_VISIBILITY_REQUIRED');
  if (capture.requiredChannels.includes('body') && !capture.feetVisible) reasons.push('DIRECTOR_MOCAP_FEET_VISIBILITY_REQUIRED');
  if (capture.requiredChannels.includes('hands') && !plan.sourceSkeleton.hasFingerJoints) reasons.push('DIRECTOR_MOCAP_SOURCE_FINGERS_REQUIRED');

  reasons.push(...validateSkeleton(plan.sourceSkeleton, 'source'));
  reasons.push(...validateSkeleton(plan.targetSkeleton, 'target'));

  const policy = plan.certificationPolicy;
  for (const [key, value] of Object.entries({
    maxFootSlideCm: policy.maxFootSlideCm,
    maxGroundPenetrationCm: policy.maxGroundPenetrationCm,
    maxRootDriftCm: policy.maxRootDriftCm,
    maxJitterScore: policy.maxJitterScore,
  })) {
    if (!Number.isFinite(value) || value < 0) reasons.push(`DIRECTOR_MOCAP_CERTIFICATION_POLICY_INVALID:${key}`);
  }
  if (plan.learnedRetarget && !plan.learnedRetarget.evidenceIds.length) reasons.push('DIRECTOR_MOCAP_LEARNED_RETARGET_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function planMotionCapture3dRoute(plan: MotionCapture3dPlan): MotionCapture3dDecision {
  const blockers = [...validateMotionCapture3dPlan(plan)];
  if (blockers.length) {
    return Object.freeze({
      admissible: false,
      route: 'reject',
      blockers: Object.freeze(blockers),
      notes: Object.freeze([]),
      requiredSteps: Object.freeze([]),
      blenderCertificationRequired: true,
      authority: 'DIRECTOR_MOTION_CAPTURE_3D_ROUTE',
    });
  }

  const notes: string[] = [];
  const requiredSteps: string[] = [];
  const source = plan.sourceSkeleton;
  const target = plan.targetSkeleton;
  const normalizationRequired =
    source.forwardAxis !== target.forwardAxis ||
    source.upAxis !== target.upAxis ||
    source.rotationOrder !== target.rotationOrder ||
    Math.abs(source.unitScaleMeters - target.unitScaleMeters) > 1e-9 ||
    Math.abs(source.fps - target.fps) > 1e-9 ||
    source.restPose !== target.restPose;

  let route: MotionCapture3dRoute = normalizationRequired ? 'normalize-then-blender' : 'direct-blender';
  if (normalizationRequired) requiredSteps.push('normalize-skeleton-conventions');

  const learned = plan.learnedRetarget;
  if (learned) {
    const topologyCompatible =
      learned.allowedSourceTopologyIds.includes(source.topologyId) &&
      learned.allowedTargetTopologyIds.includes(target.topologyId);
    const poseCompatible = !learned.requiredRestPose || (
      source.restPose === learned.requiredRestPose &&
      target.restPose === learned.requiredRestPose
    );
    if (learned.runtimeRole !== 'production-admitted') {
      notes.push('DIRECTOR_MOCAP_LEARNED_RETARGET_NOT_PRODUCTION_ADMITTED');
    } else if (!topologyCompatible) {
      notes.push('DIRECTOR_MOCAP_LEARNED_RETARGET_TOPOLOGY_UNSUPPORTED');
    } else if (!poseCompatible) {
      notes.push('DIRECTOR_MOCAP_LEARNED_RETARGET_REST_POSE_UNSUPPORTED');
    } else {
      route = 'learned-retarget-then-blender';
      requiredSteps.push('learned-retarget');
    }
  }

  requiredSteps.push('blender-retarget', 'blender-contact-cleanup', 'blender-motion-certification');
  return Object.freeze({
    admissible: true,
    route,
    blockers: Object.freeze([]),
    notes: Object.freeze(notes),
    requiredSteps: Object.freeze([...new Set(requiredSteps)]),
    blenderCertificationRequired: true,
    authority: 'DIRECTOR_MOTION_CAPTURE_3D_ROUTE',
  });
}

export function evaluateBlenderMotionCertification(
  plan: MotionCapture3dPlan,
  receipt: BlenderMotionCertification,
): BlenderMotionCertificationDecision {
  const reasons = [...validateMotionCapture3dPlan(plan)];
  if (receipt.planId !== plan.id || receipt.projectId !== plan.projectId || receipt.characterAssetId !== plan.characterAssetId) {
    reasons.push('DIRECTOR_BLENDER_CERTIFICATION_LINEAGE_MISMATCH');
  }
  if (!receipt.blenderVersion.trim() || !receipt.rigAssetId.trim() || !receipt.animationAssetId.trim() || !receipt.evidenceIds.length) {
    reasons.push('DIRECTOR_BLENDER_CERTIFICATION_PROVENANCE_REQUIRED');
  }
  if (!receipt.restPoseAligned) reasons.push('DIRECTOR_BLENDER_REST_POSE_ALIGNMENT_REQUIRED');
  if (!receipt.boneMapComplete) reasons.push('DIRECTOR_BLENDER_BONE_MAP_INCOMPLETE');
  if (!receipt.scaleNormalized) reasons.push('DIRECTOR_BLENDER_SCALE_NOT_NORMALIZED');
  if (!receipt.fpsNormalized) reasons.push('DIRECTOR_BLENDER_FPS_NOT_NORMALIZED');
  if (!receipt.sideMappingCorrect) reasons.push('DIRECTOR_BLENDER_SIDE_MAPPING_INVALID');
  if (!Number.isInteger(receipt.jointFlipCount) || receipt.jointFlipCount < 0) reasons.push('DIRECTOR_BLENDER_JOINT_FLIP_COUNT_INVALID');
  else if (receipt.jointFlipCount > 0) reasons.push('DIRECTOR_BLENDER_JOINT_FLIP_DETECTED');

  const numericChecks: Array<[string, number, number]> = [
    ['FOOT_SLIDE', receipt.footSlideCm, plan.certificationPolicy.maxFootSlideCm],
    ['GROUND_PENETRATION', receipt.groundPenetrationCm, plan.certificationPolicy.maxGroundPenetrationCm],
    ['ROOT_DRIFT', receipt.rootDriftCm, plan.certificationPolicy.maxRootDriftCm],
    ['JITTER', receipt.jitterScore, plan.certificationPolicy.maxJitterScore],
  ];
  for (const [label, value, max] of numericChecks) {
    if (!Number.isFinite(value) || value < 0) reasons.push(`DIRECTOR_BLENDER_${label}_INVALID`);
    else if (value > max) reasons.push(`DIRECTOR_BLENDER_${label}_EXCEEDED`);
  }
  if (plan.certificationPolicy.requireContactPreservation && !receipt.contactPreserved) {
    reasons.push('DIRECTOR_BLENDER_CONTACT_PRESERVATION_REQUIRED');
  }
  if (plan.certificationPolicy.requireRoundTripExport && !receipt.roundTripExported) {
    reasons.push('DIRECTOR_BLENDER_ROUND_TRIP_EXPORT_REQUIRED');
  }
  return Object.freeze({
    approved: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    evidenceIds: Object.freeze([...new Set([...plan.evidenceIds, ...plan.capture.evidenceIds, ...receipt.evidenceIds])]),
    authority: 'DIRECTOR_BLENDER_MOTION_CERTIFICATION_QC',
  });
}

export function motionCapture3dEvidence(plan: MotionCapture3dPlan): readonly string[] {
  const decision = planMotionCapture3dRoute(plan);
  if (!decision.admissible) throw new Error(`DIRECTOR_MOTION_CAPTURE_3D_INVALID: ${decision.blockers.join(', ')}`);
  return Object.freeze([
    `mocap-plan:${plan.id}`,
    `mocap-capture-mode:${plan.capture.mode}`,
    `mocap-route:${decision.route}`,
    `mocap-source-topology:${plan.sourceSkeleton.topologyId}`,
    `mocap-target-topology:${plan.targetSkeleton.topologyId}`,
    ...plan.evidenceIds,
    ...plan.capture.evidenceIds,
    ...(plan.learnedRetarget?.evidenceIds ?? []),
  ]);
}
