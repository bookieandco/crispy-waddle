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
