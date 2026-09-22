export type VisualAnnotationKind =
  | 'box'
  | 'polygon'
  | 'mask'
  | 'keypoints'
  | 'track'
  | 'tag';

export type ProtectedVisualRegionKind =
  | 'face'
  | 'person'
  | 'product'
  | 'logo'
  | 'subtitle'
  | 'text'
  | 'ui'
  | 'critical-object';

export interface MediaTimebase {
  fps: number;
  durationSeconds: number;
  width: number;
  height: number;
}

export interface VisualRegion {
  id: string;
  kind: ProtectedVisualRegionKind;
  startSeconds: number;
  endSeconds: number;
  /** Normalized 0..1 coordinates relative to the source frame. */
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
  trackId?: string;
}

export interface VisualAnnotationEvidence {
  id: string;
  projectId: string;
  assetId: string;
  annotationKind: VisualAnnotationKind;
  observedAt: string;
  provider: string;
  frameStart: number;
  frameEnd: number;
  confidence: number;
  evidenceRefs: readonly string[];
  limitations: readonly string[];
  protectedRegions: readonly VisualRegion[];
}

export type VisualEditKind =
  | 'zoom'
  | 'crop'
  | 'reframe'
  | 'overlay'
  | 'caption-layout'
  | 'broll-replacement'
  | 'cutaway';

export interface VisualEditEvidenceRequest {
  editKind: VisualEditKind;
  startSeconds: number;
  endSeconds: number;
  timebase: MediaTimebase;
  observations: readonly VisualAnnotationEvidence[];
}

export interface VisualEditEvidenceDecision {
  admissible: boolean;
  reasons: readonly string[];
  evidenceIds: readonly string[];
  protectedRegions: readonly VisualRegion[];
}

/**
 * Visual edits fail closed unless frame-derived evidence covers the requested
 * interval. Transcript/audio evidence can still support non-visual cleanup,
 * but it is not a substitute for seeing the frames being changed.
 */
export function evaluateVisualEditEvidence(input: VisualEditEvidenceRequest): VisualEditEvidenceDecision {
  const reasons: string[] = [];
  if (!Number.isFinite(input.startSeconds) || !Number.isFinite(input.endSeconds) || input.startSeconds < 0 || input.endSeconds <= input.startSeconds) {
    reasons.push('DIRECTOR_VISUAL_EDIT_INTERVAL_INVALID');
  }
  if (input.endSeconds > input.timebase.durationSeconds) reasons.push('DIRECTOR_VISUAL_EDIT_OUTSIDE_MEDIA');
  if (input.timebase.fps <= 0 || input.timebase.width <= 0 || input.timebase.height <= 0) {
    reasons.push('DIRECTOR_VISUAL_TIMEBASE_INVALID');
  }

  const startFrame = Math.floor(input.startSeconds * input.timebase.fps);
  const endFrame = Math.ceil(input.endSeconds * input.timebase.fps);
  const covering = input.observations.filter((observation) =>
    observation.frameStart <= startFrame &&
    observation.frameEnd >= endFrame &&
    observation.confidence > 0 &&
    observation.evidenceRefs.length > 0,
  );

  if (!covering.length) reasons.push('DIRECTOR_FRAME_EVIDENCE_REQUIRED');

  const evidenceIds = [...new Set(covering.map((item) => item.id))];
  const protectedRegions = covering.flatMap((item) => item.protectedRegions);
  if (protectedRegions.some((region) => !validNormalizedRegion(region))) {
    reasons.push('DIRECTOR_VISUAL_REGION_INVALID');
  }

  return Object.freeze({
    admissible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    evidenceIds: Object.freeze(evidenceIds),
    protectedRegions: Object.freeze(protectedRegions),
  });
}

export interface OverlayCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
  startSeconds: number;
  endSeconds: number;
}

/** Reject an overlay if it intersects a protected region during its lifetime. */
export function overlayAvoidsProtectedRegions(
  candidate: OverlayCandidate,
  regions: readonly VisualRegion[],
): boolean {
  return !regions.some((region) => {
    const overlapsTime = candidate.startSeconds < region.endSeconds && candidate.endSeconds > region.startSeconds;
    if (!overlapsTime) return false;
    return rectanglesOverlap(candidate, region.bounds);
  });
}

function validNormalizedRegion(region: VisualRegion): boolean {
  const { x, y, width, height } = region.bounds;
  return Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1 &&
    y + height <= 1 &&
    region.startSeconds >= 0 &&
    region.endSeconds > region.startSeconds &&
    region.confidence >= 0 &&
    region.confidence <= 1;
}

function rectanglesOverlap(
  a: Pick<OverlayCandidate, 'x' | 'y' | 'width' | 'height'>,
  b: VisualRegion['bounds'],
): boolean {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}
