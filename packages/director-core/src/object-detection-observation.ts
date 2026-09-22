import type { VisualAnnotationEvidence, VisualRegion } from './visual-observation-evidence';

export interface ObjectDetectionPrediction {
  className: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObjectDetectionObservationInput {
  id: string;
  projectId: string;
  assetId: string;
  provider: string;
  modelId: string;
  observedAt: string;
  frame: number;
  fps: number;
  imageWidth: number;
  imageHeight: number;
  predictions: readonly ObjectDetectionPrediction[];
  allowedClasses?: readonly string[];
  evidenceRefs: readonly string[];
  limitations?: readonly string[];
}

function normalizedBounds(
  prediction: ObjectDetectionPrediction,
  imageWidth: number,
  imageHeight: number,
): VisualRegion['bounds'] | undefined {
  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    prediction.width <= 0 ||
    prediction.height <= 0 ||
    !Number.isFinite(prediction.x) ||
    !Number.isFinite(prediction.y)
  ) return undefined;

  const left = (prediction.x - prediction.width / 2) / imageWidth;
  const top = (prediction.y - prediction.height / 2) / imageHeight;
  const width = prediction.width / imageWidth;
  const height = prediction.height / imageHeight;
  if (left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > 1 || top + height > 1) return undefined;
  return { x: left, y: top, width, height };
}

/** Maps a narrow object detector into generic Director visual evidence. */
export function objectDetectionsToVisualEvidence(
  input: ObjectDetectionObservationInput,
): VisualAnnotationEvidence {
  if (!Number.isFinite(input.fps) || input.fps <= 0) throw new Error('DIRECTOR_OBJECT_DETECTION_FPS_INVALID');
  if (!Number.isInteger(input.frame) || input.frame < 0) throw new Error('DIRECTOR_OBJECT_DETECTION_FRAME_INVALID');
  const allow = input.allowedClasses ? new Set(input.allowedClasses) : undefined;
  const protectedRegions: VisualRegion[] = input.predictions.flatMap((prediction, index) => {
    if (!prediction.className.trim()) return [];
    if (!Number.isFinite(prediction.confidence) || prediction.confidence <= 0 || prediction.confidence > 1) return [];
    if (allow && !allow.has(prediction.className)) return [];
    const bounds = normalizedBounds(prediction, input.imageWidth, input.imageHeight);
    if (!bounds) return [];
    return [{
      id: `${input.id}:prediction:${index}`,
      kind: 'critical-object',
      startSeconds: input.frame / input.fps,
      endSeconds: (input.frame + 1) / input.fps,
      bounds,
      confidence: prediction.confidence,
      trackId: `${input.modelId}:${prediction.className}`,
    }];
  });

  const confidence = protectedRegions.length
    ? protectedRegions.reduce((sum, region) => sum + region.confidence, 0) / protectedRegions.length
    : 0;

  return Object.freeze({
    id: input.id,
    projectId: input.projectId,
    assetId: input.assetId,
    annotationKind: 'box',
    observedAt: input.observedAt,
    provider: `${input.provider}:${input.modelId}`,
    frameStart: input.frame,
    frameEnd: input.frame,
    confidence,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    limitations: Object.freeze([...(input.limitations ?? [])]),
    protectedRegions: Object.freeze(protectedRegions),
  });
}
