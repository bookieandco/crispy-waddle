import { validateAnimationPrinciplesPlan, type AnimationPrinciplesPlan } from './animation-principles.js';

export interface AnimationPerformanceRun {
  id: string;
  frameStart: number;
  frameEndExclusive: number;
  characterAssetId: string;
  head?: string;
  eyes?: string;
  expression?: string;
  gesture?: string;
  viseme?: string;
  mouthEmotion?: string;
  background?: string;
  zoom?: number;
  word?: string;
  phoneme?: string;
  evidenceIds: readonly string[];
}

export interface AnimationPerformanceState {
  id: string;
  projectId: string;
  fps: number;
  frameCount: number;
  runs: readonly AnimationPerformanceRun[];
  audioDurationSeconds?: number;
  rigAssetId?: string;
  seed?: string;
  principlesPlan?: AnimationPrinciplesPlan;
}

export interface AnimationPerformanceDecision {
  valid: boolean;
  reasons: readonly string[];
}

/**
 * Compact deterministic animation timeline.
 *
 * Runs are half-open frame intervals and must exactly cover frameCount without
 * overlaps or inserted-frame drift. Blinks/gestures change state; they do not
 * extend the movie unless the canonical timeline duration changes.
 */
export function validateAnimationPerformanceState(
  state: AnimationPerformanceState,
): AnimationPerformanceDecision {
  const reasons: string[] = [];
  if (!Number.isFinite(state.fps) || state.fps <= 0) reasons.push('DIRECTOR_ANIMATION_FPS_INVALID');
  if (!Number.isInteger(state.frameCount) || state.frameCount <= 0) reasons.push('DIRECTOR_ANIMATION_FRAME_COUNT_INVALID');
  if (!state.runs.length) reasons.push('DIRECTOR_ANIMATION_RUNS_REQUIRED');
  if (state.principlesPlan) {
    for (const issue of validateAnimationPrinciplesPlan(state.principlesPlan)) {
      reasons.push(`DIRECTOR_ANIMATION_PRINCIPLES:${issue.code}`);
    }
    if (Math.abs(state.principlesPlan.timing.fps - state.fps) > 1e-6) {
      reasons.push('DIRECTOR_ANIMATION_PRINCIPLES_FPS_MISMATCH');
    }
  }

  const ordered = [...state.runs].sort((a, b) => a.frameStart - b.frameStart || a.frameEndExclusive - b.frameEndExclusive);
  let cursor = 0;
  for (const run of ordered) {
    if (!run.characterAssetId.trim()) reasons.push(`DIRECTOR_ANIMATION_CHARACTER_REQUIRED:${run.id}`);
    if (!run.evidenceIds.length) reasons.push(`DIRECTOR_ANIMATION_EVIDENCE_REQUIRED:${run.id}`);
    if (!Number.isInteger(run.frameStart) || !Number.isInteger(run.frameEndExclusive) || run.frameEndExclusive <= run.frameStart) {
      reasons.push(`DIRECTOR_ANIMATION_RANGE_INVALID:${run.id}`);
      continue;
    }
    if (run.frameStart !== cursor) {
      reasons.push(run.frameStart < cursor
        ? `DIRECTOR_ANIMATION_RUN_OVERLAP:${run.id}`
        : `DIRECTOR_ANIMATION_RUN_GAP:${run.id}`);
    }
    cursor = Math.max(cursor, run.frameEndExclusive);
  }

  if (cursor !== state.frameCount) reasons.push('DIRECTOR_ANIMATION_DURATION_DRIFT');

  if (state.audioDurationSeconds !== undefined && state.fps > 0 && state.frameCount > 0) {
    const pictureDuration = state.frameCount / state.fps;
    const frameTolerance = 1 / state.fps;
    if (Math.abs(pictureDuration - state.audioDurationSeconds) > frameTolerance) {
      reasons.push('DIRECTOR_ANIMATION_AUDIO_PICTURE_DRIFT');
    }
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}
