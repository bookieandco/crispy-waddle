import {
  assertDirectorCameraPlan,
  compileDirectorCameraDirective,
  type DirectorCameraPlan,
} from './camera-language.js';

export type PrevisPrimitiveKind =
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'plane'
  | 'cone'
  | 'text'
  | 'custom';

export interface PrevisObject {
  id: string;
  primitive: PrevisPrimitiveKind;
  semanticRole: string;
  materialCue?: string;
  referenceAssetIds: readonly string[];
}

export interface PrevisGenerationGap {
  id: string;
  description: string;
  purpose: string;
  requiredReferenceAssetIds: readonly string[];
}

export type PrevisInterpolation = 'linear' | 'smooth' | 'hold' | 'ease-in' | 'ease-out';

export interface PrevisTransformKeyframe {
  frame: number;
  position?: { x: number; y: number; z: number };
  rotationDegrees?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  interpolation?: PrevisInterpolation;
}

export interface PrevisPoseKeyframe {
  frame: number;
  actorId: string;
  poseRef?: string;
  action?: string;
  phase?: number;
  lookAtObjectId?: string;
  footLock?: boolean;
  interpolation?: PrevisInterpolation;
}

export interface PrevisCameraRail {
  points: readonly { x: number; y: number; z: number }[];
  startFrame: number;
  endFrameExclusive: number;
  interpolation?: PrevisInterpolation;
  heightMeters?: number;
  craneMeters?: number;
};

export interface PrevisShotBlock {
  id: string;
  order: number;
  startFrame: number;
  endFrameExclusive: number;
  purpose: string;
  cameraPlan: DirectorCameraPlan;
  cameraControl?: 'keyframes' | 'rail' | 'locked' | 'free';
  cameraRail?: PrevisCameraRail;
  objectTracks?: Readonly<Record<string, readonly PrevisTransformKeyframe[]>>;
  actorPoseTracks?: readonly PrevisPoseKeyframe[];
  visibleObjectIds: readonly string[];
  generationGaps: readonly PrevisGenerationGap[];
  holdFrames?: number;
  cutStyle?: 'hard' | 'match' | 'whip' | 'flash' | 'custom';
}

export interface PrevisReferenceBinding {
  assetId: string;
  semanticRole: string;
  usage: 'identity' | 'appearance' | 'texture' | 'environment' | 'style';
}

export interface PrevisBlockoutPlan {
  id: string;
  projectId: string;
  fps: number;
  frameCount: number;
  width: number;
  height: number;
  objects: readonly PrevisObject[];
  shots: readonly PrevisShotBlock[];
  referenceBindings: readonly PrevisReferenceBinding[];
  timelineCoverage?: 'continuous' | 'allow-gaps';
  authority: 'DIRECTOR_PREVIS_PLAN';
}

export interface PrevisIssue {
  code:
    | 'PREVIS_IDENTITY_REQUIRED'
    | 'PREVIS_FPS_INVALID'
    | 'PREVIS_FRAME_COUNT_INVALID'
    | 'PREVIS_SIZE_INVALID'
    | 'PREVIS_SHOTS_REQUIRED'
    | 'PREVIS_SHOT_RANGE_INVALID'
    | 'PREVIS_SHOT_ORDER_INVALID'
    | 'PREVIS_TIMELINE_GAP'
    | 'PREVIS_TIMELINE_OVERLAP'
    | 'PREVIS_TIMELINE_END_MISMATCH'
    | 'PREVIS_OBJECT_UNKNOWN'
    | 'PREVIS_REFERENCE_UNKNOWN'
    | 'PREVIS_OBJECT_SEMANTIC_ROLE_REQUIRED'
    | 'PREVIS_GENERATION_GAP_INVALID'
    | 'PREVIS_CAMERA_INVALID'
    | 'PREVIS_CAMERA_RAIL_INVALID'
    | 'PREVIS_TRACK_KEYFRAME_INVALID'
    | 'PREVIS_POSE_ACTOR_REQUIRED';
  path: string;
  message: string;
}

export type PrevisConditioningPass = 'plate' | 'depth' | 'normal' | 'mask';

export interface PrevisShotPackage {
  shotId: string;
  projectId: string;
  frameRange: { startFrame: number; endFrameExclusive: number };
  fps: number;
  resolution: { width: number; height: number };
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
  greyboxClipAssetId?: string;
  cameraMetadataAssetId?: string;
  promptAssetId?: string;
  conditioningPasses: Readonly<Partial<Record<PrevisConditioningPass, string>>>;
  referenceAssetIds: readonly string[];
  provenanceEvidenceIds: readonly string[];
}

export interface PrevisCompiledPrompt {
  shotList: string;
  orderedReferenceAssetIds: readonly string[];
  cutFrames: readonly number[];
}

export function validatePrevisBlockout(plan: PrevisBlockoutPlan): PrevisIssue[] {
  const issues: PrevisIssue[] = [];
  if (!plan.id.trim() || !plan.projectId.trim()) {
    issues.push(issue('PREVIS_IDENTITY_REQUIRED', 'id/projectId', 'Previs requires stable project identity.'));
  }
  if (!Number.isFinite(plan.fps) || plan.fps <= 0) {
    issues.push(issue('PREVIS_FPS_INVALID', 'fps', 'FPS must be a positive finite number.'));
  }
  if (!Number.isInteger(plan.frameCount) || plan.frameCount <= 0) {
    issues.push(issue('PREVIS_FRAME_COUNT_INVALID', 'frameCount', 'Frame count must be a positive integer.'));
  }
  if (![plan.width, plan.height].every((value) => Number.isInteger(value) && value > 0)) {
    issues.push(issue('PREVIS_SIZE_INVALID', 'width/height', 'Output width and height must be positive integers.'));
  }
  if (!plan.shots.length) {
    issues.push(issue('PREVIS_SHOTS_REQUIRED', 'shots', 'At least one previs shot is required.'));
    return issues;
  }

  const objectIds = new Set(plan.objects.map((object) => object.id));
  const referenceIds = new Set(plan.referenceBindings.map((binding) => binding.assetId));

  plan.objects.forEach((object, index) => {
    if (!object.semanticRole.trim()) {
      issues.push(issue('PREVIS_OBJECT_SEMANTIC_ROLE_REQUIRED', `objects[${index}].semanticRole`, 'Every primitive needs an explicit semantic identity.'));
    }
    for (const assetId of object.referenceAssetIds) {
      if (!referenceIds.has(assetId)) {
        issues.push(issue('PREVIS_REFERENCE_UNKNOWN', `objects[${index}].referenceAssetIds`, `Unknown reference: ${assetId}`));
      }
    }
  });

  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  let cursor = 0;
  shots.forEach((shot, index) => {
    if (shot.order !== index + 1) {
      issues.push(issue('PREVIS_SHOT_ORDER_INVALID', `shots[${index}].order`, 'Shot order must be contiguous and one-based.'));
    }
    if (
      !Number.isInteger(shot.startFrame) ||
      !Number.isInteger(shot.endFrameExclusive) ||
      shot.startFrame < 0 ||
      shot.endFrameExclusive <= shot.startFrame
    ) {
      issues.push(issue('PREVIS_SHOT_RANGE_INVALID', `shots[${index}]`, 'Shot frame range is invalid.'));
      return;
    }
    if (shot.startFrame > cursor && (plan.timelineCoverage ?? 'continuous') === 'continuous') {
      issues.push(issue('PREVIS_TIMELINE_GAP', `shots[${index}].startFrame`, 'Previs timeline has an uncovered frame gap.'));
    }
    if (shot.startFrame < cursor) {
      issues.push(issue('PREVIS_TIMELINE_OVERLAP', `shots[${index}].startFrame`, 'Previs shots overlap.'));
    }
    cursor = Math.max(cursor, shot.endFrameExclusive);

    for (const objectId of shot.visibleObjectIds) {
      if (!objectIds.has(objectId)) {
        issues.push(issue('PREVIS_OBJECT_UNKNOWN', `shots[${index}].visibleObjectIds`, `Unknown blockout object: ${objectId}`));
      }
    }

    validateCameraRail(shot, index, issues);
    validateObjectTracks(shot, index, issues);
    validatePoseTracks(shot, index, issues);

    shot.generationGaps.forEach((gap, gapIndex) => {
      if (!gap.id.trim() || !gap.description.trim() || !gap.purpose.trim()) {
        issues.push(issue('PREVIS_GENERATION_GAP_INVALID', `shots[${index}].generationGaps[${gapIndex}]`, 'Intentional model-filled gaps must be explicitly described.'));
      }
      for (const assetId of gap.requiredReferenceAssetIds) {
        if (!referenceIds.has(assetId)) {
          issues.push(issue('PREVIS_REFERENCE_UNKNOWN', `shots[${index}].generationGaps[${gapIndex}]`, `Unknown reference: ${assetId}`));
        }
      }
    });

    try {
      assertDirectorCameraPlan(shot.cameraPlan);
    } catch (error) {
      issues.push(issue(
        'PREVIS_CAMERA_INVALID',
        `shots[${index}].cameraPlan`,
        error instanceof Error ? error.message : 'Camera plan is invalid.',
      ));
    }
  });

  if (cursor !== plan.frameCount) {
    issues.push(issue('PREVIS_TIMELINE_END_MISMATCH', 'frameCount', `Shots end at frame ${cursor}, project ends at frame ${plan.frameCount}.`));
  }

  return issues;
}

export function assertPrevisBlockout(plan: PrevisBlockoutPlan): PrevisBlockoutPlan {
  const issues = validatePrevisBlockout(plan);
  if (issues.length) {
    throw new Error(`DIRECTOR_PREVIS_INVALID: ${issues.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  return plan;
}

/**
 * Converts the blockout to an exact shot-by-shot provider brief.
 * It does not "watch a vague video and guess"; timings and semantics come
 * from Director's authored blockout contract.
 */
export function compilePrevisShotList(plan: PrevisBlockoutPlan): PrevisCompiledPrompt {
  assertPrevisBlockout(plan);
  const objects = new Map(plan.objects.map((object) => [object.id, object]));
  const usedReferences: string[] = [];
  const lines: string[] = [
    `PROJECT: ${plan.frameCount} frames at ${format(plan.fps)} fps, ${plan.width}x${plan.height}.`,
    'Follow the authored cut frames and camera plans exactly. Do not invent extra cuts.',
  ];

  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  for (const shot of shots) {
    const startSeconds = shot.startFrame / plan.fps;
    const endSeconds = shot.endFrameExclusive / plan.fps;
    const visible = shot.visibleObjectIds
      .map((id) => objects.get(id))
      .filter((object): object is PrevisObject => Boolean(object));

    const semantics = visible.map((object) => {
      for (const assetId of object.referenceAssetIds) pushUnique(usedReferences, assetId);
      return `${object.primitive} ${object.id} = ${object.semanticRole}${object.materialCue ? ` (${object.materialCue})` : ''}`;
    });

    for (const gap of shot.generationGaps) {
      for (const assetId of gap.requiredReferenceAssetIds) pushUnique(usedReferences, assetId);
    }

    const authoredTracks = [
      shot.cameraControl && `Camera control: ${shot.cameraControl}`,
      shot.cameraRail && `Camera rail: frames ${shot.cameraRail.startFrame}-${shot.cameraRail.endFrameExclusive - 1}, ${shot.cameraRail.points.length} points`,
      shot.objectTracks && Object.keys(shot.objectTracks).length
        ? `Object tracks: ${Object.entries(shot.objectTracks).map(([id, keys]) => `${id}(${keys.length} keys)`).join(', ')}`
        : undefined,
      shot.actorPoseTracks?.length
        ? `Actor pose keys: ${shot.actorPoseTracks.map((key) => `${key.actorId}@${key.frame}${key.poseRef ? `:${key.poseRef}` : ''}`).join(', ')}`
        : undefined,
    ].filter((line): line is string => Boolean(line));

    const shotLines = [
      '',
      `SHOT ${shot.order} [frames ${shot.startFrame}-${shot.endFrameExclusive - 1}; ${format(startSeconds)}-${format(endSeconds)}s]`,
      `Purpose: ${shot.purpose}`,
      semantics.length ? `Blockout semantics: ${semantics.join('; ')}` : 'Blockout semantics: intentionally empty',
      ...authoredTracks,
      compileDirectorCameraDirective(shot.cameraPlan),
      shot.generationGaps.length
        ? `MODEL-FILL ONLY: ${shot.generationGaps.map((gap) => `${gap.description} — ${gap.purpose}`).join(' | ')}`
        : 'MODEL-FILL ONLY: none; preserve authored staging',
      shot.holdFrames ? `End hold: ${shot.holdFrames} frames` : undefined,
      shot.cutStyle ? `Cut: ${shot.cutStyle}` : undefined,
    ].filter((line): line is string => Boolean(line));

    lines.push(...shotLines);
  }

  return Object.freeze({
    shotList: lines.filter((line): line is string => Boolean(line)).join('\n'),
    orderedReferenceAssetIds: Object.freeze(usedReferences),
    cutFrames: Object.freeze(shots.slice(1).map((shot) => shot.startFrame)),
  });
}

export function validatePrevisShotPackage(
  plan: PrevisBlockoutPlan,
  shotId: string,
  pkg: PrevisShotPackage,
): readonly string[] {
  const reasons: string[] = [];
  const shot = plan.shots.find((candidate) => candidate.id === shotId);

  if (!shot) return Object.freeze(['DIRECTOR_PREVIS_PACKAGE_SHOT_UNKNOWN']);
  if (pkg.shotId !== shot.id || pkg.projectId !== plan.projectId) {
    reasons.push('DIRECTOR_PREVIS_PACKAGE_IDENTITY_MISMATCH');
  }
  if (
    pkg.frameRange.startFrame !== shot.startFrame ||
    pkg.frameRange.endFrameExclusive !== shot.endFrameExclusive
  ) reasons.push('DIRECTOR_PREVIS_PACKAGE_FRAME_RANGE_MISMATCH');
  if (pkg.fps !== plan.fps) reasons.push('DIRECTOR_PREVIS_PACKAGE_FPS_MISMATCH');
  if (pkg.resolution.width !== plan.width || pkg.resolution.height !== plan.height) {
    reasons.push('DIRECTOR_PREVIS_PACKAGE_RESOLUTION_MISMATCH');
  }
  if (!pkg.greyboxClipAssetId?.trim()) reasons.push('DIRECTOR_PREVIS_PACKAGE_GREYBOX_REQUIRED');
  if (!pkg.cameraMetadataAssetId?.trim()) reasons.push('DIRECTOR_PREVIS_PACKAGE_CAMERA_METADATA_REQUIRED');
  if (!pkg.promptAssetId?.trim()) reasons.push('DIRECTOR_PREVIS_PACKAGE_PROMPT_REQUIRED');
  if (!pkg.provenanceEvidenceIds.length) reasons.push('DIRECTOR_PREVIS_PACKAGE_PROVENANCE_REQUIRED');

  const expectedReferences = new Set<string>();
  for (const objectId of shot.visibleObjectIds) {
    const object = plan.objects.find((candidate) => candidate.id === objectId);
    for (const assetId of object?.referenceAssetIds ?? []) expectedReferences.add(assetId);
  }
  for (const gap of shot.generationGaps) {
    for (const assetId of gap.requiredReferenceAssetIds) expectedReferences.add(assetId);
  }
  for (const assetId of expectedReferences) {
    if (!pkg.referenceAssetIds.includes(assetId)) {
      reasons.push(`DIRECTOR_PREVIS_PACKAGE_REFERENCE_MISSING:${assetId}`);
    }
  }

  return Object.freeze([...new Set(reasons)]);
}

export function secondsToFrames(seconds: number, fps: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('DIRECTOR_PREVIS_SECONDS_INVALID');
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('DIRECTOR_PREVIS_FPS_INVALID');
  const frames = seconds * fps;
  if (!Number.isInteger(frames)) throw new Error('DIRECTOR_PREVIS_NON_INTEGER_FRAME_BOUNDARY');
  return frames;
}

function validateCameraRail(shot: PrevisShotBlock, index: number, issues: PrevisIssue[]): void {
  if (shot.cameraControl !== 'rail' && !shot.cameraRail) return;
  const rail = shot.cameraRail;
  if (
    !rail ||
    rail.points.length < 2 ||
    rail.points.some((point) => ![point.x, point.y, point.z].every(Number.isFinite)) ||
    !Number.isInteger(rail.startFrame) ||
    !Number.isInteger(rail.endFrameExclusive) ||
    rail.startFrame < shot.startFrame ||
    rail.endFrameExclusive > shot.endFrameExclusive ||
    rail.endFrameExclusive <= rail.startFrame
  ) {
    issues.push(issue('PREVIS_CAMERA_RAIL_INVALID', `shots[${index}].cameraRail`, 'Rail camera control requires at least two finite points and a valid authored frame range inside the shot.'));
  }
}

function validateObjectTracks(shot: PrevisShotBlock, index: number, issues: PrevisIssue[]): void {
  for (const [objectId, keys] of Object.entries(shot.objectTracks ?? {})) {
    let previous = -Infinity;
    for (const key of keys) {
      if (
        !Number.isInteger(key.frame) ||
        key.frame < shot.startFrame ||
        key.frame >= shot.endFrameExclusive ||
        key.frame < previous
      ) {
        issues.push(issue('PREVIS_TRACK_KEYFRAME_INVALID', `shots[${index}].objectTracks.${objectId}`, 'Object keyframes must be ordered integer frames inside the shot.'));
        break;
      }
      previous = key.frame;
    }
  }
}

function validatePoseTracks(shot: PrevisShotBlock, index: number, issues: PrevisIssue[]): void {
  let previous = -Infinity;
  for (const key of shot.actorPoseTracks ?? []) {
    if (!key.actorId.trim()) {
      issues.push(issue('PREVIS_POSE_ACTOR_REQUIRED', `shots[${index}].actorPoseTracks`, 'Actor pose keyframes require a stable actor ID.'));
    }
    if (
      !Number.isInteger(key.frame) ||
      key.frame < shot.startFrame ||
      key.frame >= shot.endFrameExclusive ||
      key.frame < previous
    ) {
      issues.push(issue('PREVIS_TRACK_KEYFRAME_INVALID', `shots[${index}].actorPoseTracks`, 'Actor pose keyframes must be ordered integer frames inside the shot.'));
      break;
    }
    previous = key.frame;
  }
}

function issue(code: PrevisIssue['code'], path: string, message: string): PrevisIssue {
  return { code, path, message };
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}


export type PrevisExecutorFeature =
  | 'scene-primitives'
  | 'multi-shot'
  | 'character-posing'
  | 'ik-posing'
  | 'camera-keyframes'
  | 'object-keyframes'
  | 'focal-length-control'
  | 'camera-rails'
  | 'reference-image-overlay'
  | 'reference-clip-export'
  | 'first-last-frame-export'
  | 'depth-pass'
  | 'normal-pass'
  | 'storyboard-export'
  | 'otio-export'
  | 'project-export'
  | 'mcp-control'
  | 'live-readback'
  | 'undo-receipts';

export interface PrevisExecutorProfile {
  id: string;
  name: string;
  runtime: 'browser' | 'desktop' | 'blender' | 'headless';
  features: readonly PrevisExecutorFeature[];
  maxShotSeconds?: number;
  supportedAspectRatios?: readonly string[];
  provenanceRefs: readonly string[];
}

export interface PrevisExecutionRequirements {
  features: readonly PrevisExecutorFeature[];
  longestShotSeconds: number;
  aspectRatio: string;
}

export interface PrevisExecutorDecision {
  admissible: boolean;
  reasons: readonly string[];
}

export interface PrevisObservedShot {
  shotId: string;
  observedStartFrame: number;
  observedEndFrameExclusive: number;
  observedSemanticRoles: readonly string[];
  confidence: number;
  evidenceIds: readonly string[];
}

export interface PrevisObservationDecision {
  valid: boolean;
  reasons: readonly string[];
}

export type PrevisExportKind =
  | 'reference-clip'
  | 'first-frame'
  | 'last-frame'
  | 'camera-json'
  | 'prompt'
  | 'depth-pass'
  | 'normal-pass'
  | 'storyboard'
  | 'otio'
  | 'project';

export interface PrevisExportArtifact {
  kind: PrevisExportKind;
  assetId: string;
  sha256: string;
  sourcePlanId: string;
  evidenceIds: readonly string[];
}

export function inferPrevisExecutionRequirements(
  plan: PrevisBlockoutPlan,
): PrevisExecutionRequirements {
  assertPrevisBlockout(plan);
  const features = new Set<PrevisExecutorFeature>([
    'scene-primitives',
    'multi-shot',
    'focal-length-control',
    'reference-clip-export',
  ]);

  if (plan.shots.some((shot) => shot.cameraPlan.keyframes?.length)) {
    features.add('camera-keyframes');
  }
  if (plan.shots.some((shot) => shot.cameraPlan.movements.some((movement) =>
    ['dolly-in', 'dolly-out', 'truck', 'orbit', 'tracking', 'pov-travel'].includes(movement.kind)
  ))) {
    features.add('camera-keyframes');
  }
  if (plan.objects.some((object) => /character|person|actor|human/i.test(object.semanticRole))) {
    features.add('character-posing');
  }

  const longestShotSeconds = Math.max(
    ...plan.shots.map((shot) => (shot.endFrameExclusive - shot.startFrame) / plan.fps),
  );
  const aspectRatio = aspect(plan.width, plan.height);

  return Object.freeze({
    features: Object.freeze([...features]),
    longestShotSeconds,
    aspectRatio,
  });
}

export function evaluatePrevisExecutor(
  plan: PrevisBlockoutPlan,
  executor: PrevisExecutorProfile,
): PrevisExecutorDecision {
  const requirements = inferPrevisExecutionRequirements(plan);
  const supported = new Set(executor.features);
  const reasons: string[] = [];

  for (const feature of requirements.features) {
    if (!supported.has(feature)) reasons.push(`DIRECTOR_PREVIS_EXECUTOR_FEATURE_MISSING:${feature}`);
  }
  if (
    executor.maxShotSeconds !== undefined &&
    requirements.longestShotSeconds > executor.maxShotSeconds + 1e-6
  ) {
    reasons.push('DIRECTOR_PREVIS_EXECUTOR_SHOT_DURATION_UNSUPPORTED');
  }
  if (
    executor.supportedAspectRatios?.length &&
    !executor.supportedAspectRatios.includes(requirements.aspectRatio)
  ) {
    reasons.push('DIRECTOR_PREVIS_EXECUTOR_ASPECT_UNSUPPORTED');
  }
  if (!executor.provenanceRefs.length) reasons.push('DIRECTOR_PREVIS_EXECUTOR_PROVENANCE_REQUIRED');

  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

/**
 * Ensures the frame-reading/vision pass covered the authored previs instead of
 * sampling a few frames and inventing the missing shot timing or semantics.
 */
export function evaluatePrevisObservationCoverage(
  plan: PrevisBlockoutPlan,
  observations: readonly PrevisObservedShot[],
  minimumConfidence = 0.6,
): PrevisObservationDecision {
  assertPrevisBlockout(plan);
  const reasons: string[] = [];
  const byShot = new Map(observations.map((observation) => [observation.shotId, observation]));
  const objects = new Map(plan.objects.map((object) => [object.id, object]));

  for (const shot of plan.shots) {
    const observation = byShot.get(shot.id);
    if (!observation) {
      reasons.push(`DIRECTOR_PREVIS_OBSERVATION_MISSING:${shot.id}`);
      continue;
    }
    if (!observation.evidenceIds.length) {
      reasons.push(`DIRECTOR_PREVIS_OBSERVATION_EVIDENCE_REQUIRED:${shot.id}`);
    }
    if (!Number.isFinite(observation.confidence) || observation.confidence < minimumConfidence) {
      reasons.push(`DIRECTOR_PREVIS_OBSERVATION_CONFIDENCE_LOW:${shot.id}`);
    }
    if (
      observation.observedStartFrame !== shot.startFrame ||
      observation.observedEndFrameExclusive !== shot.endFrameExclusive
    ) {
      reasons.push(`DIRECTOR_PREVIS_TIMING_MISMATCH:${shot.id}`);
    }

    const requiredRoles = shot.visibleObjectIds
      .map((id) => objects.get(id)?.semanticRole)
      .filter((role): role is string => Boolean(role));
    const observed = new Set(observation.observedSemanticRoles);
    for (const role of requiredRoles) {
      if (!observed.has(role)) reasons.push(`DIRECTOR_PREVIS_ROLE_MISSING:${shot.id}:${role}`);
    }
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export function validatePrevisExports(
  plan: PrevisBlockoutPlan,
  artifacts: readonly PrevisExportArtifact[],
  requiredKinds: readonly PrevisExportKind[],
): readonly string[] {
  const reasons: string[] = [];
  const byKind = new Map<PrevisExportKind, PrevisExportArtifact[]>();
  for (const artifact of artifacts) {
    const list = byKind.get(artifact.kind) ?? [];
    list.push(artifact);
    byKind.set(artifact.kind, list);
    if (!artifact.assetId.trim() || !artifact.sha256.trim() || !artifact.evidenceIds.length) {
      reasons.push(`DIRECTOR_PREVIS_EXPORT_PROVENANCE_REQUIRED:${artifact.kind}`);
    }
    if (artifact.sourcePlanId !== plan.id) {
      reasons.push(`DIRECTOR_PREVIS_EXPORT_PLAN_MISMATCH:${artifact.kind}`);
    }
  }
  for (const kind of requiredKinds) {
    if (!byKind.get(kind)?.length) reasons.push(`DIRECTOR_PREVIS_EXPORT_REQUIRED:${kind}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

function aspect(width: number, height: number): string {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function gcd(a: number, b: number): number {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left || 1;
}
