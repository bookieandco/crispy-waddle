export type ShotNarrativeFunction =
  | 'emotion-change'
  | 'advance-action'
  | 'increase-pressure'
  | 'orient-viewer'
  | 'release-pressure'
  | 'transition';

export interface ShotDramaturgyEvidence {
  shotId: string;
  narrativeFunctions: readonly ShotNarrativeFunction[];
  motivatedCamera: boolean;
  readableSubjectGeometry: boolean;
  eyeTraceTarget?: string;
  physicalDetailCount: number;
  soundOrVisualAnchor?: string;
  intendedEmotion?: string;
  endingImageOrState?: string;
}

export interface ShotDramaturgyDecision {
  admissible: boolean;
  reasons: readonly string[];
}

/**
 * A lightweight craft gate: the shot must do a job, have observable physical
 * direction, and avoid unmotivated camera motion. It is deliberately not an
 * aesthetic score and does not claim one filmmaking school is universally best.
 */
export function evaluateShotDramaturgy(evidence: ShotDramaturgyEvidence): ShotDramaturgyDecision {
  const reasons: string[] = [];
  if (!evidence.shotId.trim()) reasons.push('DIRECTOR_DRAMATURGY_SHOT_REQUIRED');
  if (!evidence.narrativeFunctions.length) reasons.push('DIRECTOR_DRAMATURGY_FUNCTION_REQUIRED');
  if (evidence.physicalDetailCount < 1) reasons.push('DIRECTOR_DRAMATURGY_PHYSICAL_DETAIL_REQUIRED');
  if (!evidence.readableSubjectGeometry) reasons.push('DIRECTOR_DRAMATURGY_GEOMETRY_UNCLEAR');
  if (!evidence.motivatedCamera) reasons.push('DIRECTOR_DRAMATURGY_CAMERA_UNMOTIVATED');
  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}
