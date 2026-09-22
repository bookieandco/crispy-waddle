export type ShortFormBeatKind =
  | 'hook'
  | 'setup'
  | 'quiz'
  | 'reveal'
  | 'twist'
  | 'loop'
  | 'payoff'
  | 'custom';

export interface ShortFormBeat {
  id: string;
  kind: ShortFormBeatKind;
  startSeconds: number;
  endSeconds: number;
  intent: string;
  evidenceIds: readonly string[];
}

export interface NormalizedSafeRegion {
  id: string;
  purpose: 'platform-ui' | 'caption' | 'brand' | 'custom';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShortFormProductionSpec {
  id: string;
  projectId: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  beats: readonly ShortFormBeat[];
  reservedRegions: readonly NormalizedSafeRegion[];
  frameZeroRole: 'thumbnail-candidate' | 'ordinary-frame';
  loopMode: 'none' | 'visual-loop' | 'exact-frame-loop';
}

export interface ShortFormProductionDecision {
  valid: boolean;
  reasons: readonly string[];
}

/**
 * Validates a short-form timing/layout template without prescribing one house
 * style. HOOK/SETUP/REVEAL/etc. are optional beat kinds, not universal rules.
 */
export function validateShortFormProductionSpec(
  spec: ShortFormProductionSpec,
): ShortFormProductionDecision {
  const reasons: string[] = [];
  if (!spec.id.trim() || !spec.projectId.trim()) reasons.push('DIRECTOR_SHORT_IDENTITY_REQUIRED');
  if (!Number.isFinite(spec.fps) || spec.fps <= 0) reasons.push('DIRECTOR_SHORT_FPS_INVALID');
  if (!Number.isFinite(spec.durationSeconds) || spec.durationSeconds <= 0) reasons.push('DIRECTOR_SHORT_DURATION_INVALID');
  if (!Number.isInteger(spec.width) || spec.width <= 0 || !Number.isInteger(spec.height) || spec.height <= 0) {
    reasons.push('DIRECTOR_SHORT_DIMENSIONS_INVALID');
  }

  const ordered = [...spec.beats].sort((a, b) => a.startSeconds - b.startSeconds);
  let lastEnd = 0;
  for (const beat of ordered) {
    if (!beat.id.trim() || !beat.intent.trim()) reasons.push(`DIRECTOR_SHORT_BEAT_INVALID:${beat.id || 'unknown'}`);
    if (
      !Number.isFinite(beat.startSeconds) ||
      !Number.isFinite(beat.endSeconds) ||
      beat.startSeconds < 0 ||
      beat.endSeconds <= beat.startSeconds ||
      beat.endSeconds > spec.durationSeconds
    ) reasons.push(`DIRECTOR_SHORT_BEAT_RANGE_INVALID:${beat.id}`);
    if (beat.startSeconds < lastEnd) reasons.push(`DIRECTOR_SHORT_BEAT_OVERLAP:${beat.id}`);
    lastEnd = Math.max(lastEnd, beat.endSeconds);
  }

  for (const region of spec.reservedRegions) {
    const values = [region.x, region.y, region.width, region.height];
    if (
      values.some((value) => !Number.isFinite(value)) ||
      region.x < 0 ||
      region.y < 0 ||
      region.width <= 0 ||
      region.height <= 0 ||
      region.x + region.width > 1 ||
      region.y + region.height > 1
    ) reasons.push(`DIRECTOR_SHORT_SAFE_REGION_INVALID:${region.id}`);
  }

  if (spec.loopMode === 'exact-frame-loop' && spec.frameZeroRole !== 'thumbnail-candidate') {
    reasons.push('DIRECTOR_SHORT_EXACT_LOOP_REQUIRES_FRAME_ZERO_CONTRACT');
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}
