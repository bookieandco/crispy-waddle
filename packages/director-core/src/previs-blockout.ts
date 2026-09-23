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

export interface PrevisShotBlock {
  id: string;
  order: number;
  startFrame: number;
  endFrameExclusive: number;
  purpose: string;
  cameraPlan: DirectorCameraPlan;
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
    | 'PREVIS_CAMERA_INVALID';
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
    if (shot.startFrame > cursor) {
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
    const visible = shot.visibleObjectIds.map((id) => objects.get(id)!).filter(Boolean);

    const semantics = visible.map((object) => {
      for (const assetId of object.referenceAssetIds) pushUnique(usedReferences, assetId);
      return `${object.primitive} ${object.id} = ${object.semanticRole}${object.materialCue ? ` (${object.materialCue})` : ''}`;
    });

    for (const gap of shot.generationGaps) {
      for (const assetId of gap.requiredReferenceAssetIds) pushUnique(usedReferences, assetId);
    }

    lines.push(
      '',
      `SHOT ${shot.order} [frames ${shot.startFrame}-${shot.endFrameExclusive - 1}; ${format(startSeconds)}-${format(endSeconds)}s]`,
      `Purpose: ${shot.purpose}`,
      semantics.length ? `Blockout semantics: ${semantics.join('; ')}` : 'Blockout semantics: intentionally empty',
      compileDirectorCameraDirective(shot.cameraPlan),
      shot.generationGaps.length
        ? `MODEL-FILL ONLY: ${shot.generationGaps.map((gap) => `${gap.description} — ${gap.purpose}`).join(' | ')}`
        : 'MODEL-FILL ONLY: none; preserve authored staging',
      shot.holdFrames ? `End hold: ${shot.holdFrames} frames` : undefined,
      shot.cutStyle ? `Cut: ${shot.cutStyle}` : undefined,
    );
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

function issue(code: PrevisIssue['code'], path: string, message: string): PrevisIssue {
  return { code, path, message };
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
