import type { DirectorCameraPlan } from './camera-language.js';

export type PrevisPrimitiveKind = 'cube' | 'cylinder' | 'sphere' | 'plane' | 'cone' | 'custom';

export interface PrevisPrimitive {
  id: string;
  kind: PrevisPrimitiveKind;
  semanticRole: string;
  colorToken?: string;
  visible: boolean;
  notes?: string;
}

export interface PrevisShot {
  id: string;
  order: number;
  startFrame: number;
  endFrameExclusive: number;
  markerFrame: number;
  purpose: string;
  cameraPlan: DirectorCameraPlan;
  primitives: readonly PrevisPrimitive[];
  /**
   * Explicitly marks content that the generation model should invent because
   * gray-box geometry is intentionally insufficient (e.g. liquid macro/bubbles).
   */
  modelFill?: {
    allowed: boolean;
    description: string;
  };
}

export interface DirectorPrevisBlockingPlan {
  id: string;
  projectId: string;
  fps: number;
  width: number;
  height: number;
  frameCount: number;
  background: string;
  floor?: string;
  shots: readonly PrevisShot[];
  authority: 'DIRECTOR_PREVIS_PLAN';
}

export interface PrevisValidationDecision {
  valid: boolean;
  reasons: readonly string[];
}

export interface PrevisObservedShot {
  shotId: string;
  observedStartFrame: number;
  observedEndFrameExclusive: number;
  observedCameraMove?: string;
  observedSemanticRoles: readonly string[];
  confidence: number;
  evidenceIds: readonly string[];
}

export interface PrevisCoverageDecision {
  valid: boolean;
  reasons: readonly string[];
}

export function validatePrevisBlockingPlan(plan: DirectorPrevisBlockingPlan): PrevisValidationDecision {
  const reasons: string[] = [];
  if (!plan.id.trim() || !plan.projectId.trim()) reasons.push('DIRECTOR_PREVIS_IDENTITY_REQUIRED');
  if (!Number.isFinite(plan.fps) || plan.fps <= 0) reasons.push('DIRECTOR_PREVIS_FPS_INVALID');
  if (!Number.isInteger(plan.width) || plan.width <= 0 || !Number.isInteger(plan.height) || plan.height <= 0) {
    reasons.push('DIRECTOR_PREVIS_DIMENSIONS_INVALID');
  }
  if (!Number.isInteger(plan.frameCount) || plan.frameCount <= 0) reasons.push('DIRECTOR_PREVIS_FRAME_COUNT_INVALID');
  if (!plan.shots.length) reasons.push('DIRECTOR_PREVIS_SHOTS_REQUIRED');

  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  let cursor = 0;
  const ids = new Set<string>();

  for (const shot of shots) {
    if (ids.has(shot.id)) reasons.push(`DIRECTOR_PREVIS_SHOT_DUPLICATE:${shot.id}`);
    ids.add(shot.id);
    if (!shot.id.trim() || !shot.purpose.trim()) reasons.push(`DIRECTOR_PREVIS_SHOT_IDENTITY_INVALID:${shot.id || 'unknown'}`);
    if (
      !Number.isInteger(shot.startFrame) ||
      !Number.isInteger(shot.endFrameExclusive) ||
      shot.startFrame < 0 ||
      shot.endFrameExclusive <= shot.startFrame ||
      shot.endFrameExclusive > plan.frameCount
    ) reasons.push(`DIRECTOR_PREVIS_SHOT_RANGE_INVALID:${shot.id}`);
    if (shot.startFrame !== cursor) {
      reasons.push(shot.startFrame < cursor
        ? `DIRECTOR_PREVIS_SHOT_OVERLAP:${shot.id}`
        : `DIRECTOR_PREVIS_SHOT_GAP:${shot.id}`);
    }
    if (shot.markerFrame !== shot.startFrame) reasons.push(`DIRECTOR_PREVIS_MARKER_MISMATCH:${shot.id}`);
    if (!shot.primitives.length && !shot.modelFill?.allowed) {
      reasons.push(`DIRECTOR_PREVIS_EMPTY_SHOT_NOT_EXPLICIT:${shot.id}`);
    }
    if (shot.modelFill?.allowed && !shot.modelFill.description.trim()) {
      reasons.push(`DIRECTOR_PREVIS_MODEL_FILL_DESCRIPTION_REQUIRED:${shot.id}`);
    }
    for (const primitive of shot.primitives) {
      if (!primitive.id.trim() || !primitive.semanticRole.trim()) {
        reasons.push(`DIRECTOR_PREVIS_PRIMITIVE_INVALID:${shot.id}`);
      }
    }
    cursor = Math.max(cursor, shot.endFrameExclusive);
  }

  if (cursor !== plan.frameCount) reasons.push('DIRECTOR_PREVIS_DURATION_DRIFT');
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export function compilePrevisShotMap(plan: DirectorPrevisBlockingPlan): string {
  const decision = validatePrevisBlockingPlan(plan);
  if (!decision.valid) throw new Error(decision.reasons.join(';'));

  return [...plan.shots]
    .sort((a, b) => a.order - b.order)
    .map((shot) => {
      const start = shot.startFrame / plan.fps;
      const end = shot.endFrameExclusive / plan.fps;
      const roles = shot.primitives.filter((primitive) => primitive.visible).map((primitive) =>
        primitive.colorToken
          ? `${primitive.colorToken} ${primitive.semanticRole}`
          : primitive.semanticRole,
      );
      return [
        `SHOT ${String(shot.order).padStart(2, '0')} ${start.toFixed(3)}-${end.toFixed(3)}s [frames ${shot.startFrame}-${shot.endFrameExclusive - 1}]`,
        `Purpose: ${shot.purpose}`,
        roles.length ? `Blocking objects: ${roles.join(', ')}` : undefined,
        shot.modelFill?.allowed ? `MODEL FILL: ${shot.modelFill.description}` : undefined,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

/**
 * Verifies that a vision/frame-reading pass actually covered the blocking shot
 * structure instead of sampling a few frames and inventing missing timing.
 */
export function evaluatePrevisObservationCoverage(
  plan: DirectorPrevisBlockingPlan,
  observations: readonly PrevisObservedShot[],
  minimumConfidence = 0.6,
): PrevisCoverageDecision {
  const reasons: string[] = [];
  const byShot = new Map(observations.map((observation) => [observation.shotId, observation]));

  for (const shot of plan.shots) {
    const observation = byShot.get(shot.id);
    if (!observation) {
      reasons.push(`DIRECTOR_PREVIS_OBSERVATION_MISSING:${shot.id}`);
      continue;
    }
    if (!observation.evidenceIds.length) reasons.push(`DIRECTOR_PREVIS_OBSERVATION_EVIDENCE_REQUIRED:${shot.id}`);
    if (!Number.isFinite(observation.confidence) || observation.confidence < minimumConfidence) {
      reasons.push(`DIRECTOR_PREVIS_OBSERVATION_CONFIDENCE_LOW:${shot.id}`);
    }
    if (observation.observedStartFrame !== shot.startFrame || observation.observedEndFrameExclusive !== shot.endFrameExclusive) {
      reasons.push(`DIRECTOR_PREVIS_TIMING_MISMATCH:${shot.id}`);
    }
    const requiredRoles = new Set(shot.primitives.filter((primitive) => primitive.visible).map((primitive) => primitive.semanticRole));
    const observedRoles = new Set(observation.observedSemanticRoles);
    for (const role of requiredRoles) {
      if (!observedRoles.has(role)) reasons.push(`DIRECTOR_PREVIS_ROLE_MISSING:${shot.id}:${role}`);
    }
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}
